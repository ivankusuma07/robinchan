import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OrderToolOutput } from '@robinchan/shared/schemas';

import { groundIntent, parseNumberText, sideSignals } from './grounding.js';

/** A model answer for "buy 4 AAPL", overridden per case. */
const out = (over: Partial<OrderToolOutput> = {}): OrderToolOutput => ({
  kind: 'order',
  side: 'buy',
  symbol: 'AAPL',
  symbolText: 'AAPL',
  qty: 4,
  qtyText: '4',
  amountIssue: null,
  orderType: 'market',
  limitPrice: null,
  limitPriceText: null,
  ...over,
});

describe('groundIntent — accepts what the user actually said', () => {
  it('a plain market order', () => {
    const r = groundIntent('buy 4 AAPL', out());
    assert.deepEqual(r, {
      status: 'complete',
      intent: { side: 'buy', symbol: 'AAPL', qty: 4, orderType: 'market', limitPrice: null },
    });
  });

  it('a limit order with the price quoted from the text', () => {
    const r = groundIntent(
      'grab 4 shares of nvidia if it drops to 172',
      out({ symbol: 'NVDA', symbolText: 'nvidia', qtyText: '4 shares', orderType: 'limit', limitPrice: 172, limitPriceText: '172' }),
    );
    assert.equal(r.status, 'complete');
  });

  it('company names and Indonesian', () => {
    const r = groundIntent(
      'jual empat saham tesla',
      out({ side: 'sell', symbol: 'TSLA', symbolText: 'tesla', qtyText: 'empat' }),
    );
    assert.equal(r.status, 'complete');
  });

  it('"a share" is one', () => {
    const r = groundIntent('buy a share of apple', out({ qty: 1, qtyText: 'a', symbolText: 'apple' }));
    assert.equal(r.status, 'complete');
  });

  it('passes questions through as not-an-order', () => {
    assert.deepEqual(groundIntent('why is NVDA up today?', out({ kind: 'not_an_order' })), {
      status: 'not_an_order',
    });
  });
});

describe('groundIntent — refuses to guess', () => {
  const incomplete = (text: string, o: OrderToolOutput) => {
    const r = groundIntent(text, o);
    assert.equal(r.status, 'incomplete', `expected a question back for "${text}"`);
    return r.status === 'incomplete' ? r : null!;
  };

  it('a quantity the user never typed', () => {
    const r = incomplete('buy some AAPL', out({ qty: 4, qtyText: '4' }));
    assert.deepEqual(r.missing, ['qty']);
    assert.ok(r.reasons.includes('not_in_text'));
  });

  it('a quote that exists but means a different value', () => {
    incomplete('buy 4 AAPL', out({ qty: 40, qtyText: '4' }));
  });

  it('a money amount read as shares', () => {
    const r = incomplete('buy $500 of AAPL', out({ qty: 500, qtyText: '500' }));
    assert.ok(r.reasons.includes('notional_amount'));
    incomplete('buy 500 dollars worth of apple', out({ qty: 500, qtyText: '500', symbolText: 'apple' }));
  });

  it('a price the model ignored', () => {
    const r = incomplete('buy 2 AAPL at 180', out({ qty: 2, qtyText: '2' }));
    assert.ok(r.reasons.includes('unused_price'));
  });

  it('buy/sell that contradicts the sentence', () => {
    const r = incomplete('sell 4 AAPL', out({ side: 'buy' }));
    assert.ok(r.reasons.includes('side_conflict'));
  });

  it('a side with no buy/sell word behind it', () => {
    const r = incomplete('trade 4 AAPL', out({ side: 'buy' }));
    assert.ok(r.reasons.includes('not_in_text'));
  });

  it('both sides in one sentence', () => {
    incomplete('sell 4 AAPL and buy TSLA', out({ side: 'sell' }));
  });

  it('a symbol that is not in the sentence', () => {
    const r = incomplete('buy 4 of the fruit company', out());
    assert.ok(r.reasons.includes('not_in_text'));
  });

  it('a symbol that is not tradable', () => {
    const r = incomplete('buy 4 BTC', out({ symbol: 'BTC', symbolText: 'BTC' }));
    assert.ok(r.reasons.includes('unsupported_symbol'));
  });

  it('a separator that reads both ways', () => {
    const r = incomplete('beli 1,500 AAPL', out({ qty: 1500, qtyText: '1,500' }));
    assert.ok(r.reasons.includes('ambiguous_number'));
  });

  it('an implausibly large count', () => {
    const r = incomplete('buy 250000 AAPL', out({ qty: 250000, qtyText: '250000' }));
    assert.ok(r.reasons.includes('qty_too_large'));
  });

  it('a limit order without a price', () => {
    const r = incomplete('buy 4 AAPL limit', out({ orderType: 'limit' }));
    assert.deepEqual(r.missing, ['limitPrice']);
  });

  it('keeps what it did understand, so the question only asks for the rest', () => {
    const r = incomplete('buy some tesla', out({ symbol: 'TSLA', symbolText: 'tesla', qty: null, qtyText: null, amountIssue: 'vague' }));
    assert.deepEqual(r.partial, { side: 'buy', symbol: 'TSLA', orderType: 'market' });
    assert.deepEqual(r.missing, ['qty']);
  });

  it('more than one order', () => {
    const r = incomplete('buy 2 AAPL and 3 TSLA', out({ kind: 'multiple_orders', qty: 2, qtyText: '2' }));
    assert.ok(r.reasons.includes('multiple_orders'));
  });
});

describe('parseNumberText', () => {
  it('reads words and digits in both languages', () => {
    assert.deepEqual(parseNumberText('four'), { value: 4 });
    assert.deepEqual(parseNumberText('lima'), { value: 5 });
    assert.deepEqual(parseNumberText('12 shares'), { value: 12 });
    assert.deepEqual(parseNumberText('$172.50'), { value: 172.5 });
    assert.deepEqual(parseNumberText('1,5'), { value: 1.5 });
    assert.deepEqual(parseNumberText('1,500,000'), { value: 1_500_000 });
  });

  it('refuses separators that read both ways', () => {
    assert.deepEqual(parseNumberText('1,500'), { ambiguous: true });
    assert.deepEqual(parseNumberText('1.500'), { ambiguous: true });
  });
});

describe('sideSignals', () => {
  it('does not read "get out" as a buy', () => {
    assert.deepEqual(sideSignals('get out of TSLA'), { buy: false, sell: true });
  });
});
