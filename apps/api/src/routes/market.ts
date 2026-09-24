import type { FastifyInstance } from 'fastify';
import type { Candle, MarketIndex, Ticker } from '@robinchan/shared';
import { HEAT_SYMBOLS } from '@robinchan/shared';
import { candleQuery, symbolParam } from '@robinchan/shared/schemas';
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

  /**
   * OHLCV history (plan G3) for Trade's chart. Read from the worker's
   * per-`symbol:interval` cache; an empty, stale envelope — not an error —
   * when no provider has produced any yet, so the chart renders its empty
   * state instead of failing.
   */
  app.get('/api/market/candles/:symbol', async (request) => {
    const params = symbolParam.safeParse(request.params);
    if (!params.success) throw new ApiFailure('BAD_REQUEST', 'invalid symbol', 400);
    const q = candleQuery.safeParse(request.query);
    if (!q.success) throw new ApiFailure('BAD_REQUEST', 'invalid interval or range', 400);

    const { symbol } = params.data;
    if (!(HEAT_SYMBOLS as readonly string[]).includes(symbol)) {
      throw new ApiFailure('NOT_FOUND', `no candles for ${symbol}`, 404);
    }

    const { interval, from, to } = q.data;
    const hit = await readCached<Candle[]>('candles', `${symbol}:${interval}`);
    if (!hit) return emptyEnvelope<Candle[]>([]);
    const bars = hit.data.filter(
      (c) => (from === undefined || c.t >= from) && (to === undefined || c.t <= to),
    );
    return envelope(bars, hit);
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
