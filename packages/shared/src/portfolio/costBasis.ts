/**
 * Cost basis and PnL for Portfolio (trade-heat-portfolio plan §7).
 *
 * The rule the whole module exists to enforce: **a PnL figure is only shown
 * for units whose purchase price we actually know.** There is no fallback to
 * "the price when we first saw the wallet" or any other guess — a guessed
 * basis produces a confident, wrong number, which is worse than a blank.
 *
 * Sources, in priority order:
 *  1. A manual override the user entered (`cost_basis_overrides`). Covers the
 *     whole current balance.
 *  2. Confirmed Robinchan orders (`fill_price`, `filled_qty`, G1).
 *  3. Nothing — the holding is reported as `none` and left out of totals.
 *
 * Robinchan fills are averaged (average-cost method); protocol fees are part
 * of what a unit cost, so buy fees are added to the basis.
 *
 * Sells are attributed to the *known* units first. We can't tell whether a
 * sold unit was one bought through Robinchan or one that arrived from
 * elsewhere, and this attribution is the one that can only ever understate
 * the known quantity, never overstate it. It also covers "sold more than was
 * bought via Robinchan": the known position bottoms out at zero.
 */

export type BasisKind = 'full' | 'partial' | 'none';

/** A confirmed Robinchan fill for one symbol. */
export type Fill = {
  side: 'buy' | 'sell';
  filledQty: number;
  fillPrice: number;
  feeUsd?: number | null;
  filledAt: string;
};

export type HoldingInput = {
  symbol: string;
  /** Current on-chain balance. */
  qty: number;
  /** Current price, or null when the price feed has nothing. */
  price: number | null;
  /** This wallet's confirmed Robinchan fills for the symbol, any order. */
  fills: Fill[];
  /** Manual average price, if the user set one. */
  overrideAvgPrice?: number | null;
};

export type HoldingBasis = {
  symbol: string;
  basis: BasisKind;
  source: 'override' | 'orders' | null;
  /** Average purchase price of the known units; absent when basis is `none`. */
  avgPrice?: number;
  /** Units whose purchase price is known (≤ qty). */
  knownQty: number;
  /** PnL on the known units only; absent when basis is `none` or price is missing. */
  pnl?: number;
  pnlPct?: number;
};

const EPSILON = 1e-9;

function isPositive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** Known position and average cost from Robinchan fills, oldest first. */
function fromFills(fills: Fill[]): { qty: number; avgPrice: number } | null {
  const ordered = [...fills]
    .filter((f) => isPositive(f.filledQty) && isPositive(f.fillPrice))
    .sort((a, b) => Date.parse(a.filledAt) - Date.parse(b.filledAt));

  let qty = 0;
  let cost = 0;

  for (const fill of ordered) {
    if (fill.side === 'buy') {
      qty += fill.filledQty;
      cost += fill.filledQty * fill.fillPrice + (isPositive(fill.feeUsd) ? fill.feeUsd : 0);
      continue;
    }
    // Sell: remove known units first, at the running average.
    const avg = qty > EPSILON ? cost / qty : 0;
    const removed = Math.min(qty, fill.filledQty);
    qty -= removed;
    cost -= removed * avg;
    if (qty <= EPSILON) {
      qty = 0;
      cost = 0;
    }
  }

  return qty > EPSILON ? { qty, avgPrice: cost / qty } : null;
}

export function computeHoldingBasis(input: HoldingInput): HoldingBasis {
  const { symbol, qty, price } = input;

  const withPnl = (
    basis: Exclude<BasisKind, 'none'>,
    source: 'override' | 'orders',
    avgPrice: number,
    knownQty: number,
  ): HoldingBasis => {
    const out: HoldingBasis = { symbol, basis, source, avgPrice, knownQty };
    if (isPositive(price)) {
      out.pnl = (price - avgPrice) * knownQty;
      out.pnlPct = (price / avgPrice - 1) * 100;
    }
    return out;
  };

  if (!isPositive(qty)) {
    return { symbol, basis: 'none', source: null, knownQty: 0 };
  }

  if (isPositive(input.overrideAvgPrice)) {
    return withPnl('full', 'override', input.overrideAvgPrice, qty);
  }

  const known = fromFills(input.fills);
  if (!known) {
    return { symbol, basis: 'none', source: null, knownQty: 0 };
  }

  // Never claim more known units than the wallet actually holds.
  const knownQty = Math.min(known.qty, qty);
  const basis: Exclude<BasisKind, 'none'> = qty - knownQty <= EPSILON ? 'full' : 'partial';
  return withPnl(basis, 'orders', known.avgPrice, knownQty);
}

export type PortfolioPnl = {
  holdings: HoldingBasis[];
  /** Sum over known units only; null when nothing has a known basis. */
  totalPnl: number | null;
  /** Holdings with no known purchase price at all — shown as "Excludes N assets…". */
  excludedCount: number;
};

export function computePortfolioPnl(inputs: HoldingInput[]): PortfolioPnl {
  const holdings = inputs.map(computeHoldingBasis);
  const known = holdings.filter((h) => h.pnl !== undefined);
  return {
    holdings,
    totalPnl: known.length > 0 ? known.reduce((sum, h) => sum + (h.pnl ?? 0), 0) : null,
    excludedCount: holdings.filter((h) => h.basis === 'none').length,
  };
}
