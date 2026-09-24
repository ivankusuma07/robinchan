'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ApiEnvelope,
  HeatFilter,
  HeatListPage,
  HeatListRow,
  HeatLockedRow,
  HeatSort,
} from '@robinchan/shared';
import { POLL_MS, direction, formatPct, formatPrice, relativeTime } from '@robinchan/shared';

import { DataBlock, type DataState } from '@/components/DataBlock';
import { WalletGate, TierGate } from '@/components/gates';
import { Sparkline } from '@/components/Sparkline';
import { LockIcon } from '@/components/icons';
import { Skeleton, StaleBadge, cx } from '@/components/ui';
import { getEnvelope, isUnset } from '@/lib/api';
import { useNow } from '@/lib/usePoll';
import { useTier } from '@/lib/useTier';

import { HeatBar, MiniBar } from './HeatBar';
import { HeatRowDetail } from './HeatRowDetail';

const FILTERS: Array<{ id: HeatFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tokenized', label: 'Tokenized stocks' },
  { id: 'rh_token', label: 'RH Chain tokens' },
  { id: 'watchlist', label: 'Watchlist' },
];

const SORTS: Array<{ id: HeatSort; label: string }> = [
  { id: 'score', label: 'Score' },
  { id: 'change', label: '24h change' },
  { id: 'volume', label: 'Volume' },
];

/** Desktop column template, shared by the header row and every data row. */
const COLS =
  'grid grid-cols-[28px_minmax(0,1fr)_52px] items-center gap-x-4 md:grid-cols-[32px_minmax(150px,1.3fr)_minmax(110px,1fr)_52px_minmax(96px,0.8fr)_112px] xl:grid-cols-[32px_minmax(150px,1.3fr)_minmax(110px,1fr)_52px_minmax(96px,0.8fr)_112px_96px]';

function path(filter: HeatFilter, sort: HeatSort, page: number): string {
  return `/api/heat/full?filter=${filter}&sort=${sort}&page=${page}`;
}

/**
 * The `/heat` board (plan §4): filter chips, sort, the ranked list, and
 * pagination, over `GET /api/heat/full`.
 *
 * Everything about *what* the caller may see is decided by the server —
 * locked rows arrive as `{ rank, locked }` with no symbol or score. This
 * component only lays out what it was given, so there's nothing to unlock
 * from the client.
 */
export function HeatBoardFull({
  initial,
  tradeEnabled,
}: {
  initial: ApiEnvelope<HeatListPage | null>;
  tradeEnabled: boolean;
}) {
  const { connected } = useTier();
  const [filter, setFilter] = useState<HeatFilter>('all');
  const [sort, setSort] = useState<HeatSort>('score');
  const [page, setPage] = useState(1);
  const [envelope, setEnvelope] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const now = useNow();
  const request = useRef(0);

  const load = useCallback(
    async (next: { filter: HeatFilter; sort: HeatSort; page: number }, mode: 'swap' | 'refresh') => {
      const id = ++request.current;
      if (mode === 'swap') setLoading(true);
      else setRefreshing(true);
      const res = await getEnvelope<HeatListPage | null>(
        path(next.filter, next.sort, next.page),
        null,
      );
      // A slower, older request must never overwrite a newer one.
      if (id !== request.current) return;
      // Keep showing what we had if a background refresh fails.
      setEnvelope((prev) => (mode === 'refresh' && isUnset(res) ? prev : res));
      setLoading(false);
      setRefreshing(false);
    },
    [],
  );

  // Poll while the tab is visible (brief §8), same cadence as Home's board.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load({ filter, sort, page }, 'refresh');
    }, POLL_MS.heat);
    return () => clearInterval(timer);
  }, [filter, sort, page, load]);

  const change = (next: Partial<{ filter: HeatFilter; sort: HeatSort; page: number }>) => {
    const q = { filter, sort, page: 1, ...next };
    setFilter(q.filter);
    setSort(q.sort);
    setPage(q.page);
    setOpen(null);
    void load(q, 'swap');
  };

  const data = envelope.data;
  const state: DataState = loading
    ? 'loading'
    : data == null
      ? 'error'
      : data.total === 0
        ? 'empty'
        : envelope.stale
          ? 'stale'
          : 'ready';

  const visible = (data?.rows.filter((r) => !r.locked) ?? []) as HeatListRow[];
  const locked = (data?.rows.filter((r) => r.locked) ?? []) as HeatLockedRow[];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter">
          {FILTERS.filter((f) => f.id !== 'watchlist' || connected).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => change({ filter: f.id })}
              aria-pressed={filter === f.id}
              className={cx(
                'min-h-[40px] rounded-full border px-4 text-[13px] transition-colors',
                filter === f.id
                  ? 'border-accent-2/70 bg-accent/35 text-text'
                  : 'border-border bg-surface text-text-2 hover:border-text-3 hover:text-text',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded-full border border-border bg-surface p-1"
            role="group"
            aria-label="Sort by"
          >
            {SORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => change({ sort: s.id })}
                aria-pressed={sort === s.id}
                className={cx(
                  'h-9 rounded-full px-3.5 text-[13px] transition-colors',
                  sort === s.id ? 'bg-text text-surface' : 'text-text-2 hover:text-text',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden" aria-label="Heat ranking">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-5 py-3.5">
          <p className="text-[13px] text-text-2">
            {data?.computedAt && now != null ? (
              <>
                Last computed{' '}
                <time dateTime={data.computedAt} className="text-text">
                  {relativeTime(data.computedAt, now)}
                </time>
              </>
            ) : (
              'Waiting for the first computation'
            )}
            {envelope.stale && !isUnset(envelope) ? <StaleBadge className="ml-2" /> : null}
          </p>
          <div className="flex items-center gap-3">
            {data?.level === 'public' ? (
              <span className="font-mono text-[11px] text-text-3">scores rounded ×10</span>
            ) : null}
            <button
              type="button"
              onClick={() => void load({ filter, sort, page }, 'refresh')}
              disabled={refreshing || loading}
              className="btn-ghost min-h-[36px] px-3.5 text-[13px]"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {/* Column labels — desktop only; mobile rows label themselves. */}
        <div
          className={cx(
            COLS,
            'hidden border-b border-border-soft px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-3 md:grid',
          )}
          aria-hidden
        >
          <span>#</span>
          <span>Symbol</span>
          <span>Heat</span>
          <span className="text-right">Score</span>
          <span>On-chain · News · Social</span>
          <span className="text-right">Price · 24h</span>
          <span className="hidden text-right xl:block">7 days</span>
        </div>

        <DataBlock
          state={state}
          skeleton={<RowsSkeleton count={5} />}
          empty={
            <p className="px-5 py-10 text-center text-[13px] text-text-3">
              {filter === 'rh_token'
                ? 'No Robinhood Chain tokens are ranked yet.'
                : "The worker hasn't computed heat scores yet. They refresh every five minutes."}
            </p>
          }
        >
          <ul className="divide-y divide-border-soft">
            {visible.map((row) => (
              <HeatRowItem
                key={row.symbol}
                row={row}
                open={open === row.symbol}
                onToggle={() => setOpen((cur) => (cur === row.symbol ? null : row.symbol))}
                tradeEnabled={tradeEnabled}
              />
            ))}
          </ul>

          {locked.length > 0 ? <LockedRows rows={locked} /> : null}
        </DataBlock>

        {data && data.pageCount > 1 ? (
          <footer className="flex items-center justify-between gap-3 border-t border-border-soft px-5 py-3">
            <span className="font-mono text-[12px] text-text-3">
              Page {data.page} of {data.pageCount} · {data.total} symbols
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost min-h-[36px] px-3.5 text-[13px]"
                disabled={data.page <= 1 || loading}
                onClick={() => change({ page: data.page - 1 })}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn-ghost min-h-[36px] px-3.5 text-[13px]"
                disabled={data.page >= data.pageCount || loading}
                onClick={() => change({ page: data.page + 1 })}
              >
                Next
              </button>
            </div>
          </footer>
        ) : null}
      </section>

      <p className="text-[12px] leading-relaxed text-text-3">
        Heat combines on-chain activity (volume, holders, liquidity) with 24-hour news flow. It
        describes how much is happening around a symbol, not whether to buy or sell it. The social
        component ships in phase 3.
      </p>
    </div>
  );
}

function HeatRowItem({
  row,
  open,
  onToggle,
  tradeEnabled,
}: {
  row: HeatListRow;
  open: boolean;
  onToggle: () => void;
  tradeEnabled: boolean;
}) {
  const dir = direction(row.changePct);
  const body = (
    <>
      <span className="font-mono text-[12px] text-text-3">{row.rank}</span>

      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[14px] tracking-[0.04em] text-text">{row.symbol}</span>
          {row.kind === 'rh_token' ? (
            <span className="rounded-full border border-accent-2/70 bg-accent/35 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.08em] text-accent">
              RH
            </span>
          ) : null}
        </span>
        <span className="block truncate text-[12px] text-text-3">{row.name}</span>
        {/* Mobile: the bar sits under the name instead of in its own column. */}
        <HeatBar score={row.score} className="mt-2 md:hidden" />
      </span>

      <HeatBar score={row.score} className="hidden md:block" />

      <span className="text-right font-mono text-[14px] text-text">
        {row.rounded ? <span className="text-text-3">≈</span> : null}
        {row.score}
      </span>

      <span className="hidden md:block">
        {row.components ? (
          <span className="grid grid-cols-3 gap-1.5">
            <MiniBar value={row.components.onchain} label="On-chain" />
            <MiniBar value={row.components.news} label="News" />
            <MiniBar value={row.components.social} label="Social" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text-3">
            <LockIcon width={12} height={12} />
            with a wallet
          </span>
        )}
      </span>

      <span className="hidden text-right md:block">
        <span className="block font-mono text-[13px] text-text">{formatPrice(row.price)}</span>
        <span
          className={cx(
            'block font-mono text-[12px]',
            dir === 'up' ? 'num-up' : dir === 'down' ? 'num-down' : 'num-flat',
          )}
        >
          {formatPct(row.changePct)}
        </span>
      </span>

      <span className="hidden justify-end xl:flex">
        <Sparkline points={row.spark} tone={dir} width={88} height={26} />
      </span>
    </>
  );

  if (!row.expandable) {
    return <li className={cx(COLS, 'px-5 py-3.5')}>{body}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cx(
          COLS,
          'w-full px-5 py-3.5 text-left transition-colors hover:bg-surface-2/60',
          open && 'bg-surface-2/60',
        )}
      >
        {body}
      </button>
      {open ? <HeatRowDetail symbol={row.symbol} tradeEnabled={tradeEnabled} /> : null}
    </li>
  );
}

/**
 * Rows the caller can't see yet. The server sends only their ranks, so the
 * blurred content here is generic placeholder shapes — there are no real
 * values on the page to peek at.
 */
function LockedRows({ rows }: { rows: HeatLockedRow[] }) {
  const first = rows[0]?.rank ?? 0;
  const last = rows[rows.length - 1]?.rank ?? 0;
  const range = first === last ? `rank ${first}` : `ranks ${first}–${last}`;
  const placeholder = <RowsSkeleton count={Math.min(rows.length, 6)} still />;

  if (rows[0]?.requiredLevel === 'wallet') {
    return (
      <div className="border-t border-border-soft">
        <WalletGate
          sample={placeholder}
          title="See the full board"
          body={`Connect a wallet to see ${range}, exact scores, and what's driving each one.`}
          align="center"
          className="min-h-[360px]"
        />
      </div>
    );
  }

  return (
    <div className="border-t border-border-soft">
      <TierGate requiredTier="tier1">{placeholder}</TierGate>
    </div>
  );
}

/** Placeholder rows the same height as real ones, so nothing jumps on load. */
function RowsSkeleton({ count, still = false }: { count: number; still?: boolean }) {
  return (
    <ul className="divide-y divide-border-soft">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={cx(COLS, 'px-5 py-3.5')}>
          <Bone still={still} className="h-3 w-4" />
          <span>
            <Bone still={still} className="mb-1.5 h-3.5 w-14" />
            <Bone still={still} className="h-3 w-24" />
          </span>
          <Bone still={still} className="hidden h-1.5 md:block" />
          <Bone still={still} className="ml-auto h-3.5 w-8" />
          <Bone still={still} className="hidden h-1 md:block" />
          <span className="hidden md:block">
            <Bone still={still} className="mb-1.5 ml-auto h-3 w-16" />
            <Bone still={still} className="ml-auto h-3 w-10" />
          </span>
          <Bone still={still} className="hidden h-6 xl:block" />
        </li>
      ))}
    </ul>
  );
}

function Bone({ className, still }: { className?: string; still: boolean }) {
  return still ? (
    <span className={cx('block rounded bg-surface-2', className)} />
  ) : (
    <Skeleton className={className} />
  );
}
