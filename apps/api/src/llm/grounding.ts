import type { OrderIntent, OrderParseResult, ParseField, ParseReason } from '@robinchan/shared';
import { TRADABLE_SYMBOLS } from '@robinchan/shared';
import type { OrderToolOutput } from '@robinchan/shared/schemas';

/**
 * Deterministic checks on the model's parse (brief §12: "don't guess — a
 * wrong guess here means the user loses money").
 *
 * The model is good at reading intent but it is not a source of truth, so
 * every value it returns has to be traceable to what the user actually
 * typed before it can become an order:
 *
 * - numbers (qty, limit price) must appear in the sentence, as the model
 *   quoted them, and mean the same value;
 * - the symbol must be named in the sentence, by ticker or company name,
 *   and be tradable;
 * - buy/sell must be backed by a buy/sell word and not contradicted by one;
 * - no number in the sentence may go unaccounted for — an unused "180" is a
 *   price the model ignored.
 *
 * Anything that fails becomes a question back (`incomplete`), never a
 * corrected guess. This is what holds the M4 target of **zero** silent
 * misparses even when the model slips.
 */

/** Above this, a count is far more likely a typo or a money amount than shares (brief §12 "reasonable limit"). */
export const MAX_ORDER_QTY = 100_000;

/** Company names the user may type instead of a ticker. Also given to the model as reference data. */
export const SYMBOL_ALIASES: Record<string, string[]> = {
  AAPL: ['apple'],
  NVDA: ['nvidia'],
  TSLA: ['tesla'],
  MSFT: ['microsoft'],
  AMZN: ['amazon'],
  META: ['meta', 'facebook'],
  GOOGL: ['google', 'alphabet', 'goog'],
  COIN: ['coinbase'],
};

/* English and Indonesian — the brief's working language. Multi-word phrases
   are matched as phrases. "short" is deliberately absent: shorting isn't
   supported, so it must not read as either side. */
const BUY_WORDS = [
  'buy', 'buying', 'purchase', 'acquire', 'grab', 'get', 'pick up', 'load up', 'add', 'long',
  'beli', 'membeli', 'borong', 'tambah',
];
const SELL_WORDS = [
  'sell', 'selling', 'dump', 'unload', 'offload', 'trim', 'exit', 'close', 'get out',
  'liquidate', 'cash out', 'take profit', 'jual', 'menjual', 'lepas', 'cut loss',
];

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, fifty: 50, hundred: 100,
  'a hundred': 100,
  satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8,
  sembilan: 9, sepuluh: 10, sebelas: 11, 'dua puluh': 20, 'lima puluh': 50, seratus: 100,
};

const UNIT_WORDS = /\s+(shares?|units?|lembar|saham|unit|pcs)$/i;
const CURRENCY = /(\$|usd|dollars?|bucks|rp|rupiah|idr)/i;

function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word / whole-phrase match; letters and digits count as word characters. */
export function hasPhrase(text: string, phrase: string): boolean {
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(norm(phrase))}(?=$|[^\\p{L}\\p{N}])`, 'u');
  return re.test(norm(text));
}

export function sideSignals(text: string): { buy: boolean; sell: boolean } {
  // "get out" is a sell phrase that contains the buy word "get"; remove it
  // before looking for buy words.
  const withoutGetOut = norm(text).replace(/get out/g, ' ');
  return {
    buy: BUY_WORDS.some((w) => hasPhrase(withoutGetOut, w)),
    sell: SELL_WORDS.some((w) => hasPhrase(text, w)),
  };
}

export function mentionsSymbol(text: string, symbol: string): boolean {
  if (hasPhrase(text, symbol)) return true;
  return (SYMBOL_ALIASES[symbol] ?? []).some((alias) => hasPhrase(text, alias));
}

export type ParsedNumber = { value: number } | { ambiguous: true } | null;

/**
 * A number as the user wrote it → its value. Knows word numbers (EN/ID),
 * plain digits, and both separator conventions — and refuses to pick one
 * when they disagree: "1,500" is 1500 in English and 1.5 in Indonesian.
 */
export function parseNumberText(raw: string): ParsedNumber {
  const t = norm(raw).replace(UNIT_WORDS, '').replace(/^\$\s*/, '').trim();
  if (t in WORD_NUMBERS) return { value: WORD_NUMBERS[t]! };
  if (/^\d+$/.test(t)) return { value: Number(t) };
  if (/^\d+\.\d+$/.test(t)) {
    // "1.500" is 1.5 in English but 1500 in Indonesian.
    return /^\d{1,3}\.\d{3}$/.test(t) ? { ambiguous: true } : { value: Number(t) };
  }
  if (/^\d+,\d{1,2}$/.test(t)) return { value: Number(t.replace(',', '.')) }; // "1,5" — decimal comma
  if (/^\d{1,3}(,\d{3})+$/.test(t)) {
    // One comma group ("1,500") reads both ways; two or more ("1,500,000") only as thousands.
    return (t.match(/,/g) ?? []).length === 1 ? { ambiguous: true } : { value: Number(t.replace(/,/g, '')) };
  }
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(t)) return { value: Number(t.replace(/,/g, '')) };
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(t)) return { value: Number(t.replace(/\./g, '').replace(',', '.')) };
  return null;
}

/** Every digit run in the sentence, as typed ("180", "1,500", "2.5"). */
function numericTokens(text: string): string[] {
  return (norm(text).match(/\d[\d.,]*/g) ?? []).map((t) => t.replace(/[.,]+$/, ''));
}

/** The digit run inside a quoted number text, to match it against `numericTokens`. */
function digitsOf(quoted: string | null): string | null {
  if (!quoted) return null;
  const m = norm(quoted).match(/\d[\d.,]*/);
  return m ? m[0].replace(/[.,]+$/, '') : null;
}

/** Is the quoted qty sitting next to a currency marker in the sentence ("$500", "500 dollars")? */
function nextToCurrency(text: string, quoted: string): boolean {
  if (CURRENCY.test(quoted)) return true;
  const q = escapeRe(norm(quoted));
  const re = new RegExp(`(\\$|usd|rp\\.?)\\s*${q}(?![\\d])|(?<![\\d])${q}\\s*(usd|dollars?|bucks|rupiah|worth)`, 'i');
  return re.test(norm(text));
}

const REASON_FOR_AMOUNT: Record<NonNullable<OrderToolOutput['amountIssue']>, ParseReason> = {
  notional: 'notional_amount',
  relative: 'relative_amount',
  vague: 'vague_amount',
};

const FIELD_ORDER: ParseField[] = ['side', 'symbol', 'qty', 'orderType', 'limitPrice'];

export function groundIntent(text: string, out: OrderToolOutput): OrderParseResult {
  if (out.kind === 'not_an_order') return { status: 'not_an_order' };

  const missing = new Set<ParseField>();
  const reasons = new Set<ParseReason>();
  const fieldReasons: Partial<Record<ParseField, ParseReason>> = {};
  const partial: Partial<OrderIntent> = {};
  const flag = (field: ParseField | null, reason: ParseReason) => {
    if (field) {
      missing.add(field);
      fieldReasons[field] = reason;
    }
    reasons.add(reason);
  };

  if (out.kind === 'multiple_orders') flag(null, 'multiple_orders');

  /* side — must be backed by a side word and not contradicted by one */
  const signals = sideSignals(text);
  const backed = out.side === 'buy' ? signals.buy : signals.sell;
  const opposed = out.side === 'buy' ? signals.sell : signals.buy;
  if (!out.side) flag('side', 'not_stated');
  else if (opposed) flag('side', 'side_conflict');
  // The model inferred a side ("I want 10 Amazon") that no word states.
  else if (!backed) flag('side', 'not_in_text');
  else partial.side = out.side;

  /* symbol — tradable, and named in the sentence */
  if (!out.symbol) flag('symbol', 'not_stated');
  else {
    const symbol = out.symbol.toUpperCase();
    if (!TRADABLE_SYMBOLS.includes(symbol)) flag('symbol', 'unsupported_symbol');
    else if (!mentionsSymbol(text, symbol)) flag('symbol', 'not_in_text');
    else partial.symbol = symbol;
  }

  /* qty — a share count the user typed */
  if (out.amountIssue) flag('qty', REASON_FOR_AMOUNT[out.amountIssue]);
  else if (out.qty == null) flag('qty', 'not_stated');
  else if (!out.qtyText || !hasPhrase(text, out.qtyText.replace(UNIT_WORDS, ''))) {
    flag('qty', 'not_in_text');
  } else if (nextToCurrency(text, out.qtyText.replace(UNIT_WORDS, ''))) {
    flag('qty', 'notional_amount');
  } else {
    const parsed = parseNumberText(out.qtyText);
    if (parsed && 'ambiguous' in parsed) flag('qty', 'ambiguous_number');
    else if (!parsed || !Number.isFinite(out.qty) || out.qty <= 0 || parsed.value !== out.qty) {
      flag('qty', 'not_in_text');
    } else if (out.qty > MAX_ORDER_QTY) flag('qty', 'qty_too_large');
    else partial.qty = out.qty;
  }

  /* order type / limit price */
  const isLimit = out.orderType === 'limit' || out.limitPrice != null;
  if (out.orderType === 'market' && out.limitPrice != null) {
    // Said "market" but also produced a price: don't pick one.
    flag('orderType', 'unused_price');
  } else if (isLimit) {
    partial.orderType = 'limit';
    if (out.limitPrice == null) flag('limitPrice', 'not_stated');
    else if (!out.limitPriceText || !hasPhrase(text, out.limitPriceText.replace(/^\$\s*/, ''))) {
      flag('limitPrice', 'not_in_text');
    } else {
      const parsed = parseNumberText(out.limitPriceText);
      if (parsed && 'ambiguous' in parsed) flag('limitPrice', 'ambiguous_number');
      else if (!parsed || !(out.limitPrice > 0) || parsed.value !== out.limitPrice) {
        flag('limitPrice', 'not_in_text');
      } else partial.limitPrice = out.limitPrice;
    }
  } else {
    partial.orderType = 'market';
  }

  /* every number in the sentence must be accounted for */
  const unused = numericTokens(text);
  for (const used of [digitsOf(out.qtyText), digitsOf(out.limitPriceText)]) {
    const i = used ? unused.indexOf(used) : -1;
    if (i >= 0) unused.splice(i, 1);
  }
  if (unused.length > 0) flag(isLimit ? 'limitPrice' : 'orderType', 'unused_price');

  if (missing.size === 0 && reasons.size === 0) {
    const intent: OrderIntent = {
      side: partial.side!,
      symbol: partial.symbol!,
      qty: partial.qty!,
      orderType: partial.orderType!,
      limitPrice: partial.orderType === 'limit' ? partial.limitPrice! : null,
    };
    return { status: 'complete', intent };
  }

  return {
    status: 'incomplete',
    missing: FIELD_ORDER.filter((f) => missing.has(f)),
    reasons: [...reasons],
    fieldReasons,
    partial,
  };
}
