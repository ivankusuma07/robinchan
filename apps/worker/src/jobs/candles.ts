import type { CandleInterval } from '@robinchan/shared';
import { CANDLE_INTERVALS, HEAT_SYMBOLS } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

import { fixtureCandles, fixturesEnabled } from '../providers/fixtures.js';
import { log } from '../lib/log.js';

/**
 * Candle history (plan G3) — Trade's chart, and Heat's 7-day sparklines.
 *
 * Prices live only in Redis with no history, and the plan rules out a price
 * table in Postgres: candles come from a provider and are cached per
 * `symbol:interval`. The intended source is GeckoTerminal / DexScreener
 * OHLCV for the Robinhood Chain pools, but those need pool addresses that
 * don't exist until the tokens launch, and which intervals they offer is
 * still open decision #8. Until then this follows the same rule as every
 * other provider here: deterministic fixtures in `dev`, and outside `dev`
 * nothing is written, so the API reports the data as missing rather than
 * inventing it.
 */

export const CANDLE_TTL_SEC = 300;

/** Bars kept per interval — enough for a full chart at 736px. */
const BARS = 300;

export const INTERVAL_SEC: Record<CandleInterval, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
  '1d': 86_400,
};

export async function runCandles(): Promise<void> {
  if (!fixturesEnabled()) {
    log.debug('candles', 'no OHLCV provider configured yet (plan G3 / decision #8), skipping');
    return;
  }

  const cache = getCache();
  const now = Date.now();
  let written = 0;
  for (const symbol of HEAT_SYMBOLS) {
    for (const interval of CANDLE_INTERVALS) {
      const bars = fixtureCandles(symbol, INTERVAL_SEC[interval], BARS, now);
      await cache.set(cacheKey('candles', `${symbol}:${interval}`), bars, CANDLE_TTL_SEC);
      written += 1;
    }
  }
  log.info('candles', `${written} series written (fixture)`);
}
