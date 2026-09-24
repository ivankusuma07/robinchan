/**
 * M4 parse target (brief §17): 30 command sentences — at least 28 parsed
 * correctly or asked back, and **zero** silently misparsed.
 *
 * Runs against the live LLM configured in the root `.env`, so it costs a
 * few cents and needs LLM_API_KEY. Run early and after any prompt or model
 * change (plan §5):
 *
 *   npm run eval:parse -w @robinchan/api
 *
 * Exit code is non-zero when the target is missed, so it can gate CI.
 */
import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';
import type { OrderIntent, OrderParseResult } from '@robinchan/shared';
import { repoRoot } from '@robinchan/store';

loadEnv({ path: join(repoRoot(), '.env'), quiet: true });

const { parseOrder } = await import('./parseOrder.js');
const { setLlmLogger } = await import('./client.js');

type Expect =
  | { intent: OrderIntent }
  /** A question back is the right answer. */
  | { ask: true }
  /** Not an order; a question back is also acceptable. */
  | { none: true };

const m = (side: 'buy' | 'sell', symbol: string, qty: number): Expect => ({
  intent: { side, symbol, qty, orderType: 'market', limitPrice: null },
});
const l = (side: 'buy' | 'sell', symbol: string, qty: number, limitPrice: number): Expect => ({
  intent: { side, symbol, qty, orderType: 'limit', limitPrice },
});
const ASK: Expect = { ask: true };
const NONE: Expect = { none: true };

const CASES: Array<[string, Expect]> = [
  // Clear orders — English
  ['buy 4 AAPL', m('buy', 'AAPL', 4)],
  ['sell 10 shares of Tesla', m('sell', 'TSLA', 10)],
  ['grab 4 NVDA if it drops to 172', l('buy', 'NVDA', 4, 172)],
  ['buy 2 MSFT at market', m('buy', 'MSFT', 2)],
  ['purchase 15 shares of Amazon', m('buy', 'AMZN', 15)],
  ['sell 3 META at 760', l('sell', 'META', 3, 760)],
  ['buy one share of google', m('buy', 'GOOGL', 1)],
  ['place a limit buy for 5 COIN at 300', l('buy', 'COIN', 5, 300)],
  ['sell 20 nvda', m('sell', 'NVDA', 20)],
  ['buy 7 apple limit 230.50', l('buy', 'AAPL', 7, 230.5)],
  // Clear orders — Indonesian
  ['beli 5 saham apple', m('buy', 'AAPL', 5)],
  ['jual 2 lembar tesla', m('sell', 'TSLA', 2)],
  ['beli 10 NVDA di harga 170', l('buy', 'NVDA', 10, 170)],
  ['jual tiga saham microsoft', m('sell', 'MSFT', 3)],
  // Complete, phrased loosely
  ['can you buy 3 shares of Coinbase for me', m('buy', 'COIN', 3)],
  ['I want to sell 1 GOOGL', m('sell', 'GOOGL', 1)],
  // Incomplete — must ask back
  ['buy some AAPL', ASK],
  ['buy $500 of NVDA', ASK],
  ['sell half my TSLA position', ASK],
  ['buy 5 shares', ASK],
  ['I want 10 Amazon', ASK],
  ['sell all my apple', ASK],
  ['beli beberapa saham tesla', ASK],
  ['buy 3 bitcoin', ASK],
  ['buy 2 AAPL and sell 1 TSLA', ASK],
  ['short 5 TSLA', ASK],
  ['buy AAPL at 180', ASK],
  // Not orders
  ['why is NVDA up today?', NONE],
  ["what's the price of tesla right now", NONE],
  ['should I buy apple?', NONE],
];

type Verdict = 'correct' | 'asked back' | 'MISSED' | 'SILENT MISPARSE' | 'ERROR';

function judge(expect: Expect, got: OrderParseResult): Verdict {
  if ('intent' in expect) {
    if (got.status === 'complete') {
      return JSON.stringify(got.intent) === JSON.stringify(expect.intent) ? 'correct' : 'SILENT MISPARSE';
    }
    return got.status === 'incomplete' ? 'asked back' : 'MISSED';
  }
  if ('ask' in expect) {
    if (got.status === 'complete') return 'SILENT MISPARSE';
    return got.status === 'incomplete' ? 'correct' : 'MISSED';
  }
  if (got.status === 'complete') return 'SILENT MISPARSE';
  return got.status === 'not_an_order' ? 'correct' : 'asked back';
}

function describe(r: OrderParseResult): string {
  if (r.status === 'complete') {
    const i = r.intent;
    return `${i.side} ${i.qty} ${i.symbol} ${i.orderType}${i.limitPrice != null ? ` @ ${i.limitPrice}` : ''}`;
  }
  if (r.status === 'incomplete') return `ask: ${r.missing.join('+') || '—'} (${r.reasons.join(', ')})`;
  return 'not an order';
}

let tokensIn = 0;
let tokensOut = 0;
setLlmLogger((e) => {
  tokensIn += Number(e.promptTokens ?? 0);
  tokensOut += Number(e.completionTokens ?? 0);
});

const tally: Record<Verdict, number> = {
  correct: 0,
  'asked back': 0,
  MISSED: 0,
  'SILENT MISPARSE': 0,
  ERROR: 0,
};

console.log(`model: ${process.env.LLM_MODEL_PARSE || process.env.LLM_MODEL} (${process.env.LLM_PROVIDER})\n`);

for (const [i, [text, expect]] of CASES.entries()) {
  let verdict: Verdict;
  let detail: string;
  try {
    const got = await parseOrder(text);
    verdict = judge(expect, got);
    detail = describe(got);
  } catch (err) {
    verdict = 'ERROR';
    detail = err instanceof Error ? err.message : String(err);
  }
  tally[verdict] += 1;
  const mark = verdict === 'correct' || verdict === 'asked back' ? '✓' : '✗';
  console.log(`${String(i + 1).padStart(2)} ${mark} ${verdict.padEnd(15)} ${text.padEnd(42)} → ${detail}`);
}

const passed = tally.correct + tally['asked back'];
const ok = passed >= 28 && tally['SILENT MISPARSE'] === 0;

console.log(
  `\n${passed}/${CASES.length} parsed correctly or asked back (${tally.correct} correct, ${tally['asked back']} asked back)` +
    ` · ${tally['SILENT MISPARSE']} silent misparses · ${tally.MISSED} missed · ${tally.ERROR} errors`,
);
console.log(`tokens: ${tokensIn} in / ${tokensOut} out`);
console.log(ok ? 'TARGET MET (≥28 and zero silent misparses)' : 'TARGET MISSED');
process.exit(ok ? 0 : 1);
