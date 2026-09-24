import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeHoldingBasis, computePortfolioPnl, type Fill } from './costBasis.js';

const buy = (qty: number, price: number, at: string, fee = 0): Fill => ({
  side: 'buy',
  filledQty: qty,
  fillPrice: price,
  feeUsd: fee,
  filledAt: at,
});
const sell = (qty: number, price: number, at: string): Fill => ({
  side: 'sell',
  filledQty: qty,
  fillPrice: price,
  filledAt: at,
});

const close = (actual: number | undefined, expected: number) =>
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < 1e-6,
    `expected ${expected}, got ${actual}`,
  );

describe('computeHoldingBasis', () => {
  it('all units bought via Robinchan → full basis at the average fill', () => {
    const h = computeHoldingBasis({
      symbol: 'AAPL',
      qty: 10,
      price: 120,
      fills: [buy(4, 100, '2026-09-01'), buy(6, 110, '2026-09-02')],
    });
    assert.equal(h.basis, 'full');
    assert.equal(h.source, 'orders');
    close(h.avgPrice, 106);
    assert.equal(h.knownQty, 10);
    close(h.pnl, 140);
    close(h.pnlPct, (120 / 106 - 1) * 100);
  });

  it('mixed: some units from elsewhere → partial, PnL on known units only', () => {
    const h = computeHoldingBasis({
      symbol: 'NVDA',
      qty: 15,
      price: 200,
      fills: [buy(5, 150, '2026-09-01')],
    });
    assert.equal(h.basis, 'partial');
    assert.equal(h.knownQty, 5);
    close(h.pnl, 250);
  });

  it('external only: no fills and no override → none, never a guessed price', () => {
    const h = computeHoldingBasis({ symbol: 'TSLA', qty: 3, price: 400, fills: [] });
    assert.equal(h.basis, 'none');
    assert.equal(h.source, null);
    assert.equal(h.avgPrice, undefined);
    assert.equal(h.pnl, undefined);
    assert.equal(h.knownQty, 0);
  });

  it('sold more than was bought via Robinchan → known position bottoms out at zero', () => {
    const h = computeHoldingBasis({
      symbol: 'MSFT',
      qty: 7,
      price: 500,
      fills: [buy(5, 480, '2026-09-01'), sell(8, 510, '2026-09-03')],
    });
    assert.equal(h.basis, 'none');
    assert.equal(h.pnl, undefined);
  });

  it('sells come out of known units first, which can only understate them', () => {
    const h = computeHoldingBasis({
      symbol: 'MSFT',
      qty: 13,
      price: 500,
      fills: [buy(5, 480, '2026-09-01'), sell(2, 510, '2026-09-03')],
    });
    assert.equal(h.basis, 'partial');
    assert.equal(h.knownQty, 3);
    close(h.avgPrice, 480);
  });

  it('transfer-in on top of a closed Robinchan position stays unknown', () => {
    const h = computeHoldingBasis({
      symbol: 'COIN',
      qty: 4,
      price: 300,
      fills: [buy(2, 250, '2026-09-01'), sell(2, 280, '2026-09-02')],
    });
    assert.equal(h.basis, 'none');
  });

  it('wallet holds fewer units than Robinchan bought (sent out) → capped at the balance', () => {
    const h = computeHoldingBasis({
      symbol: 'AMZN',
      qty: 2,
      price: 250,
      fills: [buy(5, 200, '2026-09-01')],
    });
    assert.equal(h.basis, 'full');
    assert.equal(h.knownQty, 2);
    close(h.pnl, 100);
  });

  it('manual override wins over fills and covers the whole balance', () => {
    const h = computeHoldingBasis({
      symbol: 'GOOGL',
      qty: 10,
      price: 260,
      fills: [buy(2, 100, '2026-09-01')],
      overrideAvgPrice: 240,
    });
    assert.equal(h.basis, 'full');
    assert.equal(h.source, 'override');
    close(h.avgPrice, 240);
    close(h.pnl, 200);
  });

  it('buy fees are part of the basis', () => {
    const h = computeHoldingBasis({
      symbol: 'AAPL',
      qty: 2,
      price: 100,
      fills: [buy(2, 100, '2026-09-01', 1)],
    });
    close(h.avgPrice, 100.5);
    close(h.pnl, -1);
  });

  it('known basis but no current price → basis kept, PnL left blank', () => {
    const h = computeHoldingBasis({
      symbol: 'AAPL',
      qty: 2,
      price: null,
      fills: [buy(2, 100, '2026-09-01')],
    });
    assert.equal(h.basis, 'full');
    close(h.avgPrice, 100);
    assert.equal(h.pnl, undefined);
  });

  it('ignores malformed fills rather than letting them skew the average', () => {
    const h = computeHoldingBasis({
      symbol: 'AAPL',
      qty: 2,
      price: 110,
      fills: [buy(2, 100, '2026-09-01'), buy(0, 999, '2026-09-02'), buy(1, -5, '2026-09-03')],
    });
    close(h.avgPrice, 100);
  });
});

describe('computePortfolioPnl', () => {
  it('totals known portions only and counts the excluded holdings', () => {
    const out = computePortfolioPnl([
      { symbol: 'AAPL', qty: 10, price: 120, fills: [buy(10, 100, '2026-09-01')] },
      { symbol: 'NVDA', qty: 15, price: 200, fills: [buy(5, 150, '2026-09-01')] },
      { symbol: 'TSLA', qty: 3, price: 400, fills: [] },
      { symbol: 'COIN', qty: 1, price: 300, fills: [] },
    ]);
    close(out.totalPnl ?? undefined, 200 + 250);
    assert.equal(out.excludedCount, 2);
  });

  it('returns a null total — not zero — when nothing has a known basis', () => {
    const out = computePortfolioPnl([{ symbol: 'TSLA', qty: 3, price: 400, fills: [] }]);
    assert.equal(out.totalPnl, null);
    assert.equal(out.excludedCount, 1);
  });
});
