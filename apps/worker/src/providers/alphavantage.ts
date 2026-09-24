import { NonRetryableError, callProvider, fetchJson } from './adapter.js';
import type { RawQuote } from './finnhub.js';

const BASE = 'https://www.alphavantage.co/query';

function key(): string | undefined {
  return process.env.ALPHAVANTAGE_API_KEY || undefined;
}

type GlobalQuoteResponse = {
  'Global Quote'?: {
    '05. price'?: string;
    '09. change'?: string;
    '10. change percent'?: string;
  };
  /** A quota/rate-limit reply arrives as HTTP 200 with one of these, not an HTTP error. */
  Note?: string;
  Information?: string;
};

/**
 * Backup quote source, tried only for whatever symbols `finnhub.ts`'s
 * `fetchQuotes` didn't return a price for (`prices.ts`'s `quotesFor()`
 * computes that gap) — never the full watched-symbol list on every cycle.
 * Alpha Vantage's free tier has no batch endpoint and a much tighter quota
 * than Finnhub's, so it's deliberately kept to "only what's actually
 * missing," and `callProvider`'s circuit breaker (brief §11) backs it off
 * for 10 minutes the moment it starts failing, rather than burning the
 * day's quota retrying.
 */
export async function fetchQuotes(symbols: readonly string[]): Promise<RawQuote[]> {
  if (symbols.length === 0) return [];
  const token = key();
  return callProvider({ id: 'alphavantage', configured: Boolean(token) }, async () => {
    const out: RawQuote[] = [];
    for (const symbol of symbols) {
      const body = await fetchJson<GlobalQuoteResponse>(
        `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${token}`,
      );
      if (body.Note || body.Information) {
        // A quota reply, not a miss for this one symbol — every other
        // symbol left in this loop would hit the same wall, and retrying
        // within seconds (the adapter's own backoff) won't help either.
        throw new NonRetryableError(body.Note ?? body.Information ?? 'rate limited');
      }
      const q = body['Global Quote'];
      const price = Number(q?.['05. price']);
      if (!q || !Number.isFinite(price) || price === 0) continue;
      out.push({
        symbol,
        price,
        change: Number(q['09. change'] ?? 0),
        changePct: Number((q['10. change percent'] ?? '0').replace('%', '')),
      });
    }
    if (out.length === 0) throw new Error('no quotes populated');
    return out;
  });
}
