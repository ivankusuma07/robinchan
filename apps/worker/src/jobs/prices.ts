import type { MarketIndex, Ticker } from '@robinchan/shared';
import { INDEX_NAMES, INDEX_SYMBOLS, SYMBOL_NAMES, WATCHED_SYMBOLS } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

import { fetchQuotes as fetchQuotesAlphaVantage } from '../providers/alphavantage.js';
import { fetchTokenStats } from '../providers/dexscreener.js';
import { fetchQuotes, type RawQuote } from '../providers/finnhub.js';
import { fixtureQuotes, fixtureSpark, fixturesEnabled } from '../providers/fixtures.js';
import { log } from '../lib/log.js';

/** Brief §8: prices & index every 10 seconds, 30-second Redis TTL. */
export const PRICE_TTL_SEC = 30;

const SPARK_POINTS = 24;

function toTicker(q: RawQuote, names: Record<string, string>): Ticker {
  return {
    symbol: q.symbol,
    name: names[q.symbol] ?? q.symbol,
    price: q.price,
    change: q.change,
    changePct: q.changePct,
    currency: 'USD',
  };
}

/**
 * Finnhub first; Alpha Vantage fills in only whatever Finnhub didn't return
 * a price for — a symbol it silently skipped, or every symbol if the whole
 * call failed. Falls to fixtures (dev only) or throws only once neither
 * provider has anything, so a real price is never overwritten by a guess.
 */
async function quotesFor(symbols: readonly string[]): Promise<RawQuote[]> {
  let quotes: RawQuote[] = [];
  let primaryErr: unknown;
  try {
    quotes = await fetchQuotes(symbols);
  } catch (err) {
    primaryErr = err;
  }

  const missing = symbols.filter((s) => !quotes.some((q) => q.symbol === s));
  if (missing.length > 0) {
    try {
      const backup = await fetchQuotesAlphaVantage(missing);
      if (backup.length > 0) {
        log.debug(
          'prices',
          `alpha vantage filled ${backup.length}/${missing.length} symbol(s) finnhub missed`,
        );
      }
      quotes = [...quotes, ...backup];
    } catch (err) {
      log.debug('prices', `alpha vantage also unavailable: ${(err as Error).message}`);
    }
  }

  if (quotes.length > 0) return quotes;

  if (fixturesEnabled()) {
    const reason = primaryErr instanceof Error ? primaryErr.message : 'no provider configured';
    log.debug('prices', `no provider data, using fixture (${reason})`);
    return fixtureQuotes(symbols);
  }

  throw primaryErr ?? new Error('no quotes from any provider');
}

export async function runPrices(): Promise<void> {
  const cache = getCache();

  const equities = await quotesFor(WATCHED_SYMBOLS);
  const tickers = equities.map((q) => toTicker(q, SYMBOL_NAMES));
  await Promise.all(tickers.map((t) => cache.set(cacheKey('price', t.symbol), t, PRICE_TTL_SEC)));

  // The "Market now" panel on Home only needs the top five (brief §4).
  const snapshot = [...tickers]
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 5);
  await cache.set(cacheKey('market', 'snapshot'), snapshot, PRICE_TTL_SEC);

  const indexQuotes = await quotesFor(INDEX_SYMBOLS.filter((s) => s !== 'RCHAN'));
  const indices: MarketIndex[] = indexQuotes.map((q) => ({
    ...toTicker(q, INDEX_NAMES),
    spark: fixtureSpark(q.symbol, SPARK_POINTS),
  }));

  // $RCHAN comes from a DEX, not from the equity provider.
  indices.push(await rchanIndex());

  await cache.set(cacheKey('market', 'indices'), indices, PRICE_TTL_SEC);
  log.info('prices', `${tickers.length} tickers, ${indices.length} indices updated`);
}

async function rchanIndex(): Promise<MarketIndex> {
  try {
    const stats = await fetchTokenStats();
    return {
      symbol: 'RCHAN',
      name: INDEX_NAMES.RCHAN ?? '$RCHAN / USD',
      price: stats.priceUsd,
      change: (stats.priceUsd * stats.changePct24h) / 100,
      changePct: stats.changePct24h,
      currency: 'USD',
      spark: fixtureSpark('RCHAN', SPARK_POINTS),
    };
  } catch {
    // The contract address only exists after launch on Pons (open decision #2).
    const [q] = fixtureQuotes(['RCHAN']);
    return {
      ...toTicker(q as RawQuote, INDEX_NAMES),
      spark: fixtureSpark('RCHAN', SPARK_POINTS),
    };
  }
}
