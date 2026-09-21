import type { FastifyInstance } from 'fastify';
import type { HeatScore } from '@robinchan/shared';
import { SYMBOL_NAMES } from '@robinchan/shared';
import { getDb, type HeatRow } from '@robinchan/store';
import { z } from 'zod';

import { ApiFailure, envelope, readCached } from '../lib/envelope.js';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});

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
}
