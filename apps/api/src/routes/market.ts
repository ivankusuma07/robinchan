import type { FastifyInstance } from 'fastify';
import type { MarketIndex, Ticker } from '@robinchan/shared';
import { z } from 'zod';

import { ApiFailure, emptyEnvelope, envelope, readCached } from '../lib/envelope.js';

const symbolParams = z.object({
  symbol: z
    .string()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9.\-]+$/, 'symbol may only contain letters, digits, dots, and dashes'),
});

export async function marketRoutes(app: FastifyInstance): Promise<void> {
  // Top five tickers for the Home panel (brief §4).
  app.get('/api/market/snapshot', async () => {
    const hit = await readCached<Ticker[]>('market', 'snapshot');
    if (!hit) return emptyEnvelope<Ticker[]>([]);
    return envelope(hit.data, hit);
  });

  app.get('/api/market/indices', async () => {
    const hit = await readCached<MarketIndex[]>('market', 'indices');
    if (!hit) return emptyEnvelope<MarketIndex[]>([]);
    return envelope(hit.data, hit);
  });

  app.get('/api/market/quote/:symbol', async (request) => {
    const parsed = symbolParams.safeParse(request.params);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid symbol', 400);

    const symbol = parsed.data.symbol.toUpperCase();
    const hit = await readCached<Ticker>('price', symbol);
    if (!hit) throw new ApiFailure('NOT_FOUND', `no price yet for ${symbol}`, 404);
    return envelope(hit.data, hit);
  });
}
