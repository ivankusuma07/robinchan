import { callProvider, fetchJson } from './adapter.js';
import type { RawQuote } from './finnhub.js';

const BASE = 'https://www.alphavantage.co/query';

/**
 * Confirmed against the real key: back-to-back calls trip Alpha Vantage's
 * free-tier "requests per second" throttle after just two or three — a
 * live production probe hit it immediately (a bare per-symbol loop with no
 * gap). This is a real limit to pace around, not the daily quota (a lone
 * request works fine any time). 1.1s apart stays clear of it.
 */
const REQUEST_GAP_MS = 1100;

/**
 * Also caps how many symbols one call can cover within the shared 8-second
 * provider timeout (`packages/store/src/provider.ts`) once paced at
 * `REQUEST_GAP_MS` — 5 symbols is ~4.4s of gaps plus request time, with
 * margin. A full Finnhub outage can mean every watched symbol is "missing"
 * at once; Alpha Vantage's throttle can't cover that many per call anyway.
 */
const MAX_SYMBOLS_PER_CALL = 5;

function key(): string | undefined {
  return process.env.ALPHAVANTAGE_API_KEY || undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GlobalQuoteResponse = {
  'Global Quote'?: {
    '05. price'?: string;
    '09. change'?: string;
    '10. change percent'?: string;
  };
  /** A rate-limit reply arrives as HTTP 200 with one of these, not an HTTP error. */
  Note?: string;
  Information?: string;
};

/**
 * Backup quote source, tried only for whatever symbols `finnhub.ts`'s
 * `fetchQuotes` didn't return a price for (`prices.ts`'s `quotesFor()`
 * computes that gap) — never the full watched-symbol list on every cycle.
 * `callProvider`'s circuit breaker (brief §11) backs this off for 10
 * minutes once it starts failing outright, on top of the pacing above.
 */
export async function fetchQuotes(symbols: readonly string[]): Promise<RawQuote[]> {
  if (symbols.length === 0) return [];
  const token = key();
  const batch = symbols.slice(0, MAX_SYMBOLS_PER_CALL);

  return callProvider({ id: 'alphavantage', configured: Boolean(token) }, async () => {
    const out: RawQuote[] = [];
    for (const [i, symbol] of batch.entries()) {
      if (i > 0) await sleep(REQUEST_GAP_MS);
      const body = await fetchJson<GlobalQuoteResponse>(
        `${BASE}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${token}`,
      );
      if (body.Note || body.Information) {
        // Hit the throttle — every remaining symbol would too. Keep
        // whatever real quotes were already collected rather than
        // discarding them; only throw below if that's none at all.
        break;
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
