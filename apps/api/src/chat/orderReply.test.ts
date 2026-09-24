import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { OrderParseResult } from '@robinchan/shared';

import { describeOrder } from './orderReply.js';

describe('describeOrder — complete', () => {
  it('restates the order without inventing a quote', () => {
    const text = describeOrder({
      status: 'complete',
      intent: { side: 'buy', symbol: 'NVDA', qty: 4, orderType: 'market', limitPrice: null },
    });
    assert.match(text!, /buy 4 shares of NVDA/);
    assert.match(text!, /at market price/);
    assert.doesNotMatch(text!, /\$|quote|estimated/i);
  });

  it('names the limit price for a limit order', () => {
    const text = describeOrder({
      status: 'complete',
      intent: { side: 'sell', symbol: 'AAPL', qty: 1, orderType: 'limit', limitPrice: 230.5 },
    });
    assert.match(text!, /sell 1 share of AAPL/);
    assert.match(text!, /limit order at/);
  });
});

describe('describeOrder — incomplete', () => {
  const incomplete = (over: Partial<Extract<OrderParseResult, { status: 'incomplete' }>>) =>
    describeOrder({
      status: 'incomplete',
      missing: [],
      reasons: [],
      fieldReasons: {},
      partial: {},
      ...over,
    } as OrderParseResult)!;

  it('asks a single question for the top missing field', () => {
    const text = incomplete({ missing: ['qty'], fieldReasons: { qty: 'vague_amount' } });
    assert.match(text, /how many shares/i);
  });

  it('recaps what was already understood', () => {
    const text = incomplete({
      missing: ['qty'],
      fieldReasons: { qty: 'not_stated' },
      partial: { side: 'buy', symbol: 'TSLA' },
    });
    assert.match(text, /buy, TSLA/);
  });

  it('lists tradable symbols when the named one is unsupported', () => {
    const text = incomplete({ missing: ['symbol'], fieldReasons: { symbol: 'unsupported_symbol' } });
    assert.match(text, /AAPL/);
  });

  it('has a fallback question even with no matching phrasing', () => {
    const text = incomplete({ missing: ['orderType'], fieldReasons: {} });
    assert.equal(text.length > 0, true);
  });

  it('handles multiple orders as its own case, ignoring the missing list', () => {
    const text = incomplete({ reasons: ['multiple_orders'], missing: ['side'] });
    assert.match(text, /one order at a time/);
  });
});

describe('describeOrder — not an order', () => {
  it('returns null so the caller falls through to normal chat', () => {
    assert.equal(describeOrder({ status: 'not_an_order' }), null);
  });
});
