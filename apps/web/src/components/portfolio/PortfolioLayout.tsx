'use client';

import Link from 'next/link';
import { useState } from 'react';
import type {
  OrderRecord,
  PortfolioHolding,
  PortfolioPoint,
  PortfolioRange,
  PortfolioView,
} from '@robinchan/shared';
import { PORTFOLIO_RANGES, direction, formatChange, formatPct, formatPrice } from '@robinchan/shared';

import { ArrowRightIcon } from '@/components/icons';
import { OrderHistory } from '@/components/orders/OrderHistory';
import { CardHead, cx } from '@/components/ui';

import { ValueChart } from './ValueChart';

const RANGE_LABEL: Record<PortfolioRange, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
  all: 'All',
};

function tone(value: number | null | undefined): string {
  const d = direction(value);
  return d === 'up' ? 'num-up' : d === 'down' ? 'num-down' : 'num-flat';
}

/**
 * The Portfolio page body (plan §7). Rendered with real data once M3 lands;
 * today it renders blurred sample data behind `<WalletGate>`, so what a
 * visitor sees under the blur is this exact layout.
 *
 * The one rule it enforces visually: a holding without a known purchase
 * price shows a blank average and "—" PnL. It never shows a number derived
 * from anything else.
 */
export function PortfolioLayout({
  view,
  history,
  orders,
  onRangeChange,
  onSetCostBasis,
}: {
  view: PortfolioView;
  history: PortfolioPoint[];
  orders: OrderRecord[];
  onRangeChange?: (range: PortfolioRange) => void;
  /** Saves a manual average price (PUT /api/portfolio/cost-basis). */
  onSetCostBasis?: (symbol: string, avgPrice: number) => Promise<void> | void;
}) {
  const [range, setRange] = useState<PortfolioRange>('7d');

  if (view.holdings.length === 0 && !view.other && view.unsupported.length === 0) {
    return <PortfolioEmpty />;
  }

  return (
    <div className="space-y-4">
      {/* Stat tiles — mono numbers, up/down colors, no arrows (plan §7). */}
      <div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Tile label="Total value" value={formatPrice(view.totalValue)} />
          <Tile
            label="24h change"
            value={formatChange(view.change24h)}
            sub={formatPct(view.change24hPct)}
            className={tone(view.change24h)}
          />
          <Tile
            label="Total PnL"
            value={view.totalPnl == null ? '—' : formatChange(view.totalPnl)}
            className={view.totalPnl == null ? 'text-text-3' : tone(view.totalPnl)}
          />
        </div>
        {view.excludedCount > 0 ? (
          <p className="mt-2.5 text-[12px] text-text-3">
            Excludes {view.excludedCount} {view.excludedCount === 1 ? 'asset' : 'assets'} without a
            purchase price. Add one in the table to include it.
          </p>
        ) : null}
      </div>

      <section className="card">
        <CardHead
          title="Value"
          aside={
            <div className="flex rounded-full border border-border p-0.5" role="group" aria-label="Range">
              {PORTFOLIO_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => {
                    setRange(r);
                    onRangeChange?.(r);
                  }}
                  className={cx(
                    'h-7 rounded-full px-2.5 font-mono text-[11px] transition-colors',
                    range === r ? 'bg-text text-surface' : 'text-text-2 hover:text-text',
                  )}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-5">
          <ValueChart points={history} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <CardHead title="Holdings" />
        <HoldingsTable view={view} onSetCostBasis={onSetCostBasis} />
      </section>

      {view.read ? (
        <section className="card p-5">
          <p className="t-eyebrow mb-2.5">Robinchan&apos;s read</p>
          <p className="max-w-[720px] text-[14px] leading-relaxed text-text">{view.read}</p>
          <p className="mt-3 text-[11px] text-text-3">
            A description of what&apos;s in the wallet, not advice on what to do with it.
          </p>
        </section>
      ) : null}

      <section className="card overflow-hidden">
        <CardHead title="Order history" />
        <OrderHistory orders={orders} />
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="card p-5">
      <p className="t-eyebrow mb-3">{label}</p>
      <p className={cx('font-mono text-[26px] leading-none tracking-[-0.02em] text-text', className)}>
        {value}
      </p>
      {sub ? <p className={cx('mt-2 font-mono text-[13px]', className)}>{sub}</p> : null}
    </div>
  );
}

const TH = 'px-3 py-2.5 font-normal';

function HoldingsTable({
  view,
  onSetCostBasis,
}: {
  view: PortfolioView;
  onSetCostBasis?: (symbol: string, avgPrice: number) => Promise<void> | void;
}) {
  const [otherOpen, setOtherOpen] = useState(false);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead>
          <tr className="border-b border-border-soft font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
            <th className={cx(TH, 'pl-5')}>Asset</th>
            <th className={cx(TH, 'text-right')}>Balance</th>
            <th className={cx(TH, 'text-right')}>Price</th>
            <th className={cx(TH, 'text-right')}>Value</th>
            <th className={cx(TH, 'text-right')}>Avg price</th>
            <th className={cx(TH, 'pr-5 text-right')}>PnL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {view.holdings.map((h) => (
            <HoldingRow key={h.symbol} h={h} onSetCostBasis={onSetCostBasis} />
          ))}

          {view.other ? (
            <>
              <tr>
                <td colSpan={6} className="p-0">
                  <button
                    type="button"
                    onClick={() => setOtherOpen((v) => !v)}
                    aria-expanded={otherOpen}
                    className="flex w-full items-center justify-between px-5 py-3 text-left text-[13px] text-text-2 hover:bg-surface-2/60"
                  >
                    <span>
                      Other · {view.other.holdings.length} small{' '}
                      {view.other.holdings.length === 1 ? 'holding' : 'holdings'}
                    </span>
                    <span className="font-mono">{formatPrice(view.other.value)}</span>
                  </button>
                </td>
              </tr>
              {otherOpen
                ? view.other.holdings.map((h) => (
                    <HoldingRow key={h.symbol} h={h} onSetCostBasis={onSetCostBasis} muted />
                  ))
                : null}
            </>
          ) : null}
        </tbody>
      </table>

      {view.unsupported.length > 0 ? (
        <div className="border-t border-border-soft px-5 py-4">
          <p className="t-eyebrow mb-2">Not priced by Robinchan</p>
          <ul className="flex flex-wrap gap-2">
            {view.unsupported.map((u) => (
              <li
                key={u.address}
                className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-text-2"
                title={u.address}
              >
                {u.label} · {u.qty}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HoldingRow({
  h,
  muted,
  onSetCostBasis,
}: {
  h: PortfolioHolding;
  muted?: boolean;
  onSetCostBasis?: (symbol: string, avgPrice: number) => Promise<void> | void;
}) {
  return (
    <tr className={cx('text-[13px]', muted && 'bg-surface-2/40')}>
      <td className="py-3 pl-5 pr-3">
        <span className="block font-mono tracking-[0.04em] text-text">{h.symbol}</span>
        <span className="block text-[12px] text-text-3">{h.name}</span>
      </td>
      <td className="px-3 py-3 text-right font-mono">{h.qty}</td>
      <td className="px-3 py-3 text-right font-mono">
        {formatPrice(h.price)}
        <span className={cx('block text-[11px]', tone(h.changePct24h))}>
          {formatPct(h.changePct24h)}
        </span>
      </td>
      <td className="px-3 py-3 text-right font-mono">{formatPrice(h.value)}</td>
      <td className="px-3 py-3 text-right font-mono">
        {h.avgPrice != null ? (
          <>
            {formatPrice(h.avgPrice)}
            {h.basis === 'partial' ? (
              <span className="block text-[11px] text-text-3" title="Only part of this balance has a known purchase price">
                part of balance
              </span>
            ) : null}
          </>
        ) : (
          <CostBasisInput symbol={h.symbol} onSave={onSetCostBasis} />
        )}
      </td>
      <td className="py-3 pl-3 pr-5 text-right font-mono">
        {h.pnl == null ? (
          <span className="text-text-3">—</span>
        ) : (
          <span className={tone(h.pnl)}>
            {formatChange(h.pnl)}
            <span className="block text-[11px]">{formatPct(h.pnlPct)}</span>
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * Inline manual cost basis (plan §7). Blank until the user types a price —
 * there's no pre-filled suggestion, because any suggestion would be a guess.
 */
function CostBasisInput({
  symbol,
  onSave,
}: {
  symbol: string;
  onSave?: (symbol: string, avgPrice: number) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const parsed = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={!onSave}
        className="text-[12px] text-accent underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-text-3 disabled:no-underline"
      >
        Add price
      </button>
    );
  }

  return (
    <form
      className="ml-auto flex w-[150px] items-center gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!valid || !onSave) return;
        setSaving(true);
        try {
          await onSave(symbol, parsed);
          setEditing(false);
        } finally {
          setSaving(false);
        }
      }}
    >
      <label htmlFor={`basis-${symbol}`} className="sr-only">
        Average purchase price for {symbol}
      </label>
      <input
        id={`basis-${symbol}`}
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="0.00"
        className="h-8 w-full min-w-0 rounded-row border border-border bg-surface px-2 text-right font-mono text-[12px] focus:border-accent-2"
      />
      <button
        type="submit"
        disabled={!valid || saving}
        className="h-8 shrink-0 rounded-row bg-accent px-2 text-[12px] text-accent-ink disabled:opacity-45"
      >
        Save
      </button>
    </form>
  );
}

function PortfolioEmpty() {
  return (
    <section className="card flex flex-col items-center px-6 py-16 text-center">
      <h2 className="t-h3 mb-2">Nothing in this wallet yet</h2>
      <p className="t-small mb-6 max-w-[380px]">
        Once the wallet holds tokenized stocks or Robinhood Chain tokens, they show up here with
        their value and, where it&apos;s known, what you paid.
      </p>
      <Link href="/market" className="btn-primary text-sm">
        Look around the market
        <ArrowRightIcon />
      </Link>
    </section>
  );
}
