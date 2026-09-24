import type { Candle, MarketIndex, Ticker } from '@robinchan/shared';

import { readCached } from './envelope.js';

export type LivePrice = { price: number; changePct: number } | null;

/**
 * Current price and 24h change for any heat symbol. Equities come from the
 * per-symbol price cache; $RCHAN only exists in the index feed, since it's
 * quoted from a DEX rather than the equity provider.
 */
export async function livePrice(symbol: string): Promise<LivePrice> {
  const hit = await readCached<Ticker>('price', symbol);
  if (hit) return { price: hit.data.price, changePct: hit.data.changePct };

  if (symbol === 'RCHAN') {
    const indices = await readCached<MarketIndex[]>('market', 'indices');
    const row = indices?.data.find((i) => i.symbol === 'RCHAN');
    if (row) return { price: row.price, changePct: row.changePct };
  }
  return null;
}

/** 28 points = one per 6 hours over 7 days. */
const SPARK_POINTS = 28;

/**
 * 7-day sparkline for the heat row (plan §4), sampled from the 1h candles
 * so Heat and Trade draw from the same history (G3). Empty when there are no
 * candles — the row then shows no line instead of an invented one.
 */
export async function weekSpark(symbol: string): Promise<number[]> {
  const hit = await readCached<Candle[]>('candles', `${symbol}:1h`);
  if (!hit || hit.data.length === 0) return [];
  const since = Date.now() / 1000 - 7 * 24 * 3600;
  const week = hit.data.filter((c) => c.t >= since);
  if (week.length < 2) return [];
  const step = Math.max(1, Math.floor(week.length / SPARK_POINTS));
  const points = week.filter((_, i) => i % step === 0).map((c) => c.c);
  const last = week[week.length - 1];
  if (last && points[points.length - 1] !== last.c) points.push(last.c);
  return points;
}
