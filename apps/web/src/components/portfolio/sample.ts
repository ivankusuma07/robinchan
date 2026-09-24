import type {
  HoldingInput,
  OrderRecord,
  PortfolioHolding,
  PortfolioPoint,
  PortfolioView,
} from '@robinchan/shared';
import { SYMBOL_NAMES, computePortfolioPnl } from '@robinchan/shared';

/**
 * Stand-in data shown **blurred** behind the wallet gate (plan §3), so a
 * visitor sees the page's real layout instead of an empty box. It is never
 * shown unblurred, is inert and hidden from assistive tech, and is not
 * anyone's wallet.
 *
 * It still goes through the real `computePortfolioPnl`, so even the preview
 * follows the rules: the holding bought elsewhere shows a blank average and
 * no PnL.
 */

const INPUTS: Array<HoldingInput & { changePct24h: number }> = [
  {
    symbol: 'NVDA',
    qty: 12,
    price: 176.2,
    changePct24h: 1.8,
    fills: [{ side: 'buy', filledQty: 12, fillPrice: 161.4, filledAt: '2026-08-02T15:00:00Z' }],
  },
  {
    symbol: 'AAPL',
    qty: 8,
    price: 238.4,
    changePct24h: -0.6,
    fills: [{ side: 'buy', filledQty: 5, fillPrice: 229.1, filledAt: '2026-08-11T14:00:00Z' }],
  },
  { symbol: 'TSLA', qty: 3, price: 412.9, changePct24h: 2.4, fills: [] },
  {
    symbol: 'MSFT',
    qty: 2,
    price: 511.0,
    changePct24h: 0.3,
    fills: [],
    overrideAvgPrice: 498.0,
  },
];

const DUST: Array<HoldingInput & { changePct24h: number }> = [
  { symbol: 'RCHAN', qty: 14, price: 0.0421, changePct24h: 3.1, fills: [] },
];

function toHoldings(inputs: typeof INPUTS): PortfolioHolding[] {
  const { holdings } = computePortfolioPnl(inputs);
  return holdings.map((b, i) => {
    const input = inputs[i]!;
    return {
      symbol: b.symbol,
      name: SYMBOL_NAMES[b.symbol] ?? b.symbol,
      qty: input.qty,
      price: input.price,
      value: input.price != null ? input.price * input.qty : null,
      changePct24h: input.changePct24h,
      basis: b.basis,
      avgPrice: b.avgPrice ?? null,
      pnl: b.pnl ?? null,
      pnlPct: b.pnlPct ?? null,
    };
  });
}

const main = toHoldings(INPUTS).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
const dust = toHoldings(DUST);
const totals = computePortfolioPnl([...INPUTS, ...DUST]);
const totalValue = [...main, ...dust].reduce((sum, h) => sum + (h.value ?? 0), 0);

export const SAMPLE_VIEW: PortfolioView = {
  totalValue,
  change24h: totalValue * 0.0112,
  change24hPct: 1.12,
  totalPnl: totals.totalPnl,
  excludedCount: totals.excludedCount,
  holdings: main,
  other: { value: dust.reduce((s, h) => s + (h.value ?? 0), 0), holdings: dust },
  unsupported: [{ address: '0x0000000000000000000000000000000000000000', label: 'Unknown token', qty: 250 }],
  read: 'Most of the value sits in two large-cap tech names, and one position arrived from outside Robinchan, so its return is not tracked.',
};

export const SAMPLE_HISTORY: PortfolioPoint[] = Array.from({ length: 30 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 7, 25 + i)).toISOString(),
  value: totalValue * (0.9 + 0.1 * (i / 29) + Math.sin(i / 3) * 0.012),
}));

export const SAMPLE_ORDERS: OrderRecord[] = [
  {
    id: 'sample-1',
    side: 'buy',
    symbol: 'AAPL',
    qty: 5,
    limitPrice: null,
    status: 'confirmed',
    txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    fillPrice: 229.1,
    filledQty: 5,
    feeUsd: 0.42,
    filledAt: '2026-08-11T14:00:00Z',
    createdAt: '2026-08-11T13:59:40Z',
  },
  {
    id: 'sample-2',
    side: 'buy',
    symbol: 'NVDA',
    qty: 12,
    limitPrice: null,
    status: 'confirmed',
    txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    fillPrice: 161.4,
    filledQty: 12,
    feeUsd: 0.61,
    filledAt: '2026-08-02T15:00:00Z',
    createdAt: '2026-08-02T14:59:30Z',
  },
];
