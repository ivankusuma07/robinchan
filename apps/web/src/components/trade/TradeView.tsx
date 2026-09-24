'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ApiEnvelope, OrderRecord, Ticker } from '@robinchan/shared';
import {
  POLL_MS,
  SYMBOL_NAMES,
  TRADABLE_SYMBOLS,
  direction,
  formatChange,
  formatPct,
  formatPrice,
} from '@robinchan/shared';

import { WalletGate } from '@/components/gates';
import { OrderHistory } from '@/components/orders/OrderHistory';
import { SAMPLE_ORDERS, SAMPLE_VIEW } from '@/components/portfolio/sample';
import { StaleBadge, cx } from '@/components/ui';
import { isUnset } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';

import { OrderTicket } from './OrderTicket';
import { PriceChart } from './PriceChart';

type Tab = 'open' | 'history' | 'positions';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'open', label: 'Open orders' },
  { id: 'history', label: 'History' },
  { id: 'positions', label: 'Positions' },
];

/** A sample open limit order, only ever rendered blurred behind the gate. */
const SAMPLE_OPEN: OrderRecord[] = [
  {
    id: 'sample-open',
    side: 'buy',
    symbol: 'NVDA',
    qty: 4,
    limitPrice: 168,
    status: 'open',
    txHash: null,
    fillPrice: null,
    filledQty: null,
    feeUsd: null,
    filledAt: null,
    createdAt: '2026-09-20T10:00:00Z',
  },
];

/**
 * `/trade/[symbol]` (plan §8): symbol header · chart (736px) · sticky
 * ticket (360px) · bottom tabs. One live quote is polled here and shared by
 * the header and the ticket, so they can never disagree on "the last price".
 */
export function TradeView({
  symbol,
  initialQuote,
}: {
  symbol: string;
  initialQuote: ApiEnvelope<Ticker | null>;
}) {
  const router = useRouter();
  const quote = usePoll<Ticker | null>(
    `/api/market/quote/${encodeURIComponent(symbol)}`,
    initialQuote,
    POLL_MS.snapshot,
  );
  const ticker = quote.data;
  const stale = quote.stale && !isUnset(quote);
  const dir = direction(ticker?.changePct);
  const [tab, setTab] = useState<Tab>('open');

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <label htmlFor="trade-symbol" className="t-eyebrow mb-2 block">
            Trade
          </label>
          <div className="flex items-center gap-3">
            <select
              id="trade-symbol"
              value={symbol}
              onChange={(e) => router.push(`/trade/${e.target.value}`)}
              className="h-11 rounded-full border border-border bg-surface pl-4 pr-9 font-mono text-[18px] tracking-[0.04em] text-text"
            >
              {TRADABLE_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="text-[14px] text-text-2">{SYMBOL_NAMES[symbol] ?? symbol}</span>
          </div>
        </div>

        <div className={cx('text-right', stale && 'is-stale')}>
          <p className="font-mono text-[28px] leading-none tracking-[-0.02em] text-text">
            {formatPrice(ticker?.price)}
          </p>
          <p
            className={cx(
              'mt-1.5 font-mono text-[13px]',
              dir === 'up' ? 'num-up' : dir === 'down' ? 'num-down' : 'num-flat',
            )}
          >
            {formatChange(ticker?.change)} ({formatPct(ticker?.changePct)}) · 24h
            {stale ? <StaleBadge className="ml-2 align-middle" /> : null}
          </p>
        </div>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,736px)_360px]">
        <PriceChart symbol={symbol} />
        <div className="xl:sticky xl:top-[92px]">
          <OrderTicket symbol={symbol} quote={{ ticker, stale }} />
        </div>
      </div>

      <section className="card overflow-hidden" aria-label="Your orders and positions">
        <div className="flex gap-5 border-b border-border-soft px-5 pt-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                '-mb-px border-b-2 pb-2.5 text-[13px] transition-colors',
                tab === t.id
                  ? 'border-text text-text'
                  : 'border-transparent text-text-3 hover:text-text',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <WalletGate
          align="center"
          className="min-h-[300px]"
          title="Connect a wallet to see your orders"
          body="Open orders, fills, and positions are read for your address only."
          sample={
            tab === 'positions' ? (
              <Positions />
            ) : (
              <OrderHistory orders={tab === 'open' ? SAMPLE_OPEN : SAMPLE_ORDERS} />
            )
          }
        />
      </section>
    </div>
  );
}

/** Blurred positions preview; the real one comes from `GET /api/portfolio` (M3). */
function Positions() {
  return (
    <ul className="divide-y divide-border-soft">
      {SAMPLE_VIEW.holdings.map((h) => (
        <li key={h.symbol} className="flex items-center justify-between px-5 py-3 text-[13px]">
          <span className="font-mono tracking-[0.04em]">{h.symbol}</span>
          <span className="font-mono text-text-2">{h.qty}</span>
          <span className="font-mono">{formatPrice(h.value)}</span>
        </li>
      ))}
    </ul>
  );
}
