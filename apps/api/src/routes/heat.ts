import type { FastifyInstance } from 'fastify';
import type {
  HeatBreakdown,
  HeatDetail,
  HeatLevel,
  HeatListPage,
  HeatListRow,
  HeatLockedRow,
  HeatScore,
} from '@robinchan/shared';
import {
  HEAT_PAGE_SIZE,
  HEAT_SYMBOLS,
  HEAT_VISIBLE_ROWS,
  SYMBOL_NAMES,
  symbolKind,
} from '@robinchan/shared';
import { heatFullQuery, symbolParam, type HeatFullQuery } from '@robinchan/shared/schemas';
import { cacheKey, getCache, getDb, type HeatRow } from '@robinchan/store';
import { z } from 'zod';

import { atLeast, flag, resolveLevel } from '../lib/access.js';
import { ApiFailure, envelope, readCached } from '../lib/envelope.js';
import { livePrice, weekSpark } from '../lib/prices.js';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

/** Matches the worker's heat TTL; the page cache is also dropped on every recompute. */
const PAGE_TTL_SEC = 600;

/**
 * Gating (brief §13): without a wallet, only the top five symbols are
 * returned, scores rounded to the nearest 10 and without component detail.
 *
 * Real tier verification only lands in M3 — until then, every request is
 * treated as anonymous. This is deliberate: returning the full score because
 * a client claims to have a tier would make the gating fake.
 */
function toPublic(row: HeatRow): HeatScore {
  return {
    symbol: row.symbol,
    name: SYMBOL_NAMES[row.symbol] ?? row.symbol,
    score: Math.round(row.score / 10) * 10,
    components: null,
    rounded: true,
    computedAt: row.computedAt,
  };
}

/** How many rows (by score rank) each level may see; `full` sees everything. */
function visibleCount(level: HeatLevel): number {
  if (level === 'public') return HEAT_VISIBLE_ROWS.public;
  if (level === 'wallet') return HEAT_VISIBLE_ROWS.wallet;
  return Number.POSITIVE_INFINITY;
}

/** The next level up — what a locked row asks the caller to reach. */
function nextLevel(level: HeatLevel): HeatLockedRow['requiredLevel'] {
  return level === 'public' ? 'wallet' : 'full';
}

/** Rows ranked by score, from the worker's cache first and Postgres second. */
async function rankedRows(): Promise<{ rows: HeatRow[]; stale: boolean; asOf?: string }> {
  const hit = await readCached<HeatRow[]>('heat', 'top');
  if (hit) return { rows: hit.data, stale: hit.stale, asOf: hit.asOf };
  const rows = await getDb().listHeat(HEAT_SYMBOLS.length);
  return { rows, stale: rows.length === 0 };
}

/**
 * The gated skeleton of one page: which ranks are visible, in what order.
 * Cached per `filter:sort:page:level` (plan §4) and invalidated by the worker
 * on every recompute. Prices and sparklines are *not* part of it — they move
 * every 20 seconds, so they're joined per request instead of freezing in a
 * cache that lives for minutes.
 */
type PageSkeleton = {
  entries: Array<{ rank: number; row: HeatRow } | { rank: number; locked: true }>;
  page: number;
  pageCount: number;
  total: number;
  computedAt: string | null;
};

async function buildSkeleton(q: HeatFullQuery, level: HeatLevel): Promise<PageSkeleton> {
  const { rows } = await rankedRows();
  const filtered = rows
    .filter((r) => (q.filter === 'all' || q.filter === 'watchlist' ? true : symbolKind(r.symbol) === q.filter))
    .sort((a, b) => b.score - a.score);

  const visible = visibleCount(level);
  const ranked = filtered.map((row, i) => ({ rank: i + 1, row }));
  const open = ranked.slice(0, visible);
  const locked = ranked.slice(visible);

  // Sorting only reorders what the caller can see. Locked rows stay behind,
  // in rank order, so the sort can't be used to probe their values.
  const prices = q.sort === 'change' ? await Promise.all(open.map((e) => livePrice(e.row.symbol))) : [];
  const sortedOpen =
    q.sort === 'score'
      ? open
      : q.sort === 'volume'
        ? [...open].sort(
            (a, b) => (b.row.detail?.volumeRatio ?? -1) - (a.row.detail?.volumeRatio ?? -1),
          )
        : open
            .map((e, i) => ({ e, change: prices[i]?.changePct ?? Number.NEGATIVE_INFINITY }))
            .sort((a, b) => b.change - a.change)
            .map((x) => x.e);

  const entries: PageSkeleton['entries'] = [
    ...sortedOpen,
    ...locked.map((e) => ({ rank: e.rank, locked: true as const })),
  ];

  const total = entries.length;
  const pageCount = Math.max(1, Math.ceil(total / HEAT_PAGE_SIZE));
  const page = Math.min(q.page, pageCount);
  const start = (page - 1) * HEAT_PAGE_SIZE;

  return {
    entries: entries.slice(start, start + HEAT_PAGE_SIZE),
    page,
    pageCount,
    total,
    computedAt: rows[0]?.computedAt ?? null,
  };
}

async function toListRow(rank: number, row: HeatRow, level: HeatLevel): Promise<HeatListRow> {
  const [live, spark] = await Promise.all([livePrice(row.symbol), weekSpark(row.symbol)]);
  const isPublic = level === 'public';
  return {
    locked: false,
    rank,
    symbol: row.symbol,
    name: SYMBOL_NAMES[row.symbol] ?? row.symbol,
    kind: symbolKind(row.symbol),
    score: isPublic ? Math.round(row.score / 10) * 10 : row.score,
    rounded: isPublic,
    components: isPublic ? null : row.components,
    price: live?.price ?? null,
    changePct: live?.changePct ?? null,
    spark,
    // Rows only expand for a signed-in wallet (plan §4 no-wallet view).
    expandable: !isPublic,
  };
}

function breakdown(row: HeatRow): HeatBreakdown {
  const notes = row.detail?.notes;
  return {
    onchain: { score: row.components.onchain, note: notes?.onchain ?? '' },
    news: { score: row.components.news, note: notes?.news ?? '' },
    social:
      row.components.social == null
        ? { score: null, note: notes?.social ?? 'Not active yet', reason: 'not_active' }
        : { score: row.components.social, note: notes?.social ?? '' },
  };
}

export async function heatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/heat', async (request) => {
    const parsed = query.safeParse(request.query);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid limit');

    const limit = Math.min(parsed.data.limit, 5);

    const hit = await readCached<HeatRow[]>('heat', 'top');
    if (hit) return envelope(hit.data.slice(0, limit).map(toPublic), hit);

    const rows = await getDb().listHeat(limit);
    return envelope(rows.map(toPublic), { stale: rows.length === 0 });
  });

  /** The `/heat` page's board (plan §4). 404 while the page flag is off. */
  app.get('/api/heat/full', async (request) => {
    if (!flag('FEATURE_HEAT_PAGE')) throw new ApiFailure('NOT_FOUND', 'unknown endpoint', 404);

    const parsed = heatFullQuery.safeParse(request.query);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid filter, sort, or page');
    const q = parsed.data;
    const level = await resolveLevel(request);

    // A watchlist belongs to a wallet (M3); there is nothing to filter by yet.
    if (q.filter === 'watchlist' && !atLeast(level, 'wallet')) {
      throw new ApiFailure('WALLET_REQUIRED', 'connect a wallet to filter by watchlist', 401);
    }

    const key = `full:${q.filter}:${q.sort}:${q.page}:${level}`;
    const cached = await readCached<PageSkeleton>('heat', key);
    const skeleton = cached?.data ?? (await buildSkeleton(q, level));
    if (!cached) await getCache().set(cacheKey('heat', key), skeleton, PAGE_TTL_SEC);

    const source = await readCached<HeatRow[]>('heat', 'top');
    const rows: HeatListPage['rows'] = await Promise.all(
      skeleton.entries.map((e) =>
        'locked' in e
          ? ({ locked: true, rank: e.rank, requiredLevel: nextLevel(level) } satisfies HeatLockedRow)
          : toListRow(e.rank, e.row, level),
      ),
    );

    const page: HeatListPage = {
      level,
      rows,
      page: skeleton.page,
      pageCount: skeleton.pageCount,
      total: skeleton.total,
      computedAt: skeleton.computedAt,
    };
    return envelope(page, {
      stale: source ? source.stale : skeleton.total === 0,
      ...(source ? { asOf: source.asOf } : {}),
    });
  });

  /**
   * One symbol's breakdown (plan §4/§6). Needs a wallet: public rows don't
   * expand. Drivers and the read are the `full` level's (H2); a `wallet`
   * caller gets the bars and notes only, for symbols inside their visible
   * rows. Never calls the LLM — the read is precomputed by the worker.
   */
  app.get('/api/heat/:symbol', async (request) => {
    if (!flag('FEATURE_HEAT_PAGE')) throw new ApiFailure('NOT_FOUND', 'unknown endpoint', 404);

    const parsed = symbolParam.safeParse(request.params);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid symbol');
    const { symbol } = parsed.data;

    const level = await resolveLevel(request);
    if (!atLeast(level, 'wallet')) {
      throw new ApiFailure('WALLET_REQUIRED', 'connect a wallet to open a heat row', 401);
    }

    const { rows, stale, asOf } = await rankedRows();
    const index = rows.findIndex((r) => r.symbol === symbol);
    const row = rows[index];
    if (!row) throw new ApiFailure('NOT_FOUND', `no heat score for ${symbol}`, 404);
    if (index >= visibleCount(level)) {
      throw new ApiFailure('TIER_REQUIRED', 'this row needs a higher tier', 403);
    }

    const full = atLeast(level, 'full');
    const drivers = full ? await getDb().getNewsByIds(row.detail?.drivers ?? []) : [];

    const detail: HeatDetail = {
      symbol,
      name: SYMBOL_NAMES[symbol] ?? symbol,
      score: row.score,
      breakdown: breakdown(row),
      drivers: drivers.map((n) => ({
        id: n.id,
        title: n.title,
        publishedAt: n.publishedAt,
        url: n.url,
        source: n.source,
      })),
      // Robinchan reads ship in H2 (`heat_reads`); until then there is none.
      read: null,
      computedAt: row.computedAt,
    };
    return envelope(detail, { stale, ...(asOf ? { asOf } : {}) });
  });
}
