'use client';

import { useId, useState } from 'react';
import type { OrderQuote, OrderSide, Ticker } from '@robinchan/shared';
import { formatPrice } from '@robinchan/shared';

import { TierGate } from '@/components/gates';
import { OrderPreviewCard } from '@/components/OrderPreviewCard';
import { cx } from '@/components/ui';
import { API_BASE } from '@/lib/api';
import { useTier } from '@/lib/useTier';

/** A limit this far from the last price needs an explicit confirmation (plan §8). */
const DEVIATION_LIMIT = 0.2;

const FRACTIONS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: 'Max', value: 1 },
] as const;

/**
 * Order ticket (plan §8). Builds the same intent shape `parseOrder` returns
 * for chat, so both paths share one quote → sign → record pipeline — the
 * ticket is a second way to fill in an intent, not a second way to trade.
 *
 * "Review" calls the real `POST /api/order/quote`. It always answers
 * `PIPELINE_NOT_CONFIGURED` right now: brief §18's open decisions #4 (which
 * DEX + its ABI) and #5 (protocol fee) are still unanswered, so there's no
 * real gas estimate or unsigned payload to build yet — that error surfaces
 * here honestly rather than the button staying hardcoded-disabled. The
 * fraction shortcuts still need a wallet's real balance (M3's portfolio
 * read). Once a quote exists it renders in the shared
 * `<OrderPreviewCard>`, which owns the countdown and expiry rules — there
 * is deliberately no second copy of them here.
 */
export function OrderTicket({
  symbol,
  quote: live,
}: {
  symbol: string;
  quote: { ticker: Ticker | null; stale: boolean };
}) {
  const ids = useId();
  const { connected } = useTier();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('');
  const [limit, setLimit] = useState('');
  const [ackDeviation, setAckDeviation] = useState(false);
  const [touched, setTouched] = useState(false);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const last = live.ticker?.price ?? null;
  const qty = Number(amount);
  const qtyValid = amount.trim() !== '' && Number.isFinite(qty) && qty > 0;
  const limitPrice = Number(limit);
  const limitValid = limit.trim() !== '' && Number.isFinite(limitPrice) && limitPrice > 0;
  const deviation =
    type === 'limit' && limitValid && last ? Math.abs(limitPrice - last) / last : null;
  const needsAck = deviation != null && deviation > DEVIATION_LIMIT;

  const refPrice = type === 'limit' && limitValid ? limitPrice : last;
  const indicative = qtyValid && refPrice ? qty * refPrice : null;

  // Inline validation (plan §8), in the order a person would fix them.
  const problems: string[] = [];
  if (touched && !qtyValid) problems.push('Enter an amount greater than zero.');
  if (!last) problems.push(`There's no live price for ${symbol} right now.`);
  else if (live.stale) problems.push('The last price is stale; the quote will re-price it.');
  if (type === 'limit' && touched && !limitValid) problems.push('Enter a limit price.');
  if (needsAck && !ackDeviation) {
    problems.push('Confirm the limit price below; it is far from the last price.');
  }

  const formValid =
    qtyValid && last != null && (type !== 'limit' || limitValid) && (!needsAck || ackDeviation);
  const canReview = connected && formValid;

  const requestQuote = async () => {
    if (!canReview) return;
    setQuoting(true);
    setQuoteError(null);
    try {
      const res = await fetch(`${API_BASE}/api/order/quote`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          side,
          symbol,
          qty,
          orderType: type,
          limitPrice: type === 'limit' ? limitPrice : null,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { data?: OrderQuote; error?: { message?: string } }
        | null;
      if (!res.ok || !body?.data) {
        setQuoteError(body?.error?.message ?? "Couldn't get a quote right now.");
        return;
      }
      setQuote(body.data);
    } catch {
      setQuoteError("Couldn't reach the server for a quote.");
    } finally {
      setQuoting(false);
    }
  };

  return (
    <section className="card flex flex-col" aria-label="Order ticket">
      {/* Buy / Sell */}
      <div className="grid grid-cols-2 gap-1.5 border-b border-border-soft p-3" role="group" aria-label="Side">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={cx(
              'h-11 rounded-full text-[14px] font-medium transition-colors',
              side === s
                ? // The deeper text-safe shades of up/down (tailwind textColor):
                  // white on the sheet's #22C55E would be ~2.3:1.
                  s === 'buy'
                  ? 'bg-[#15803D] text-white'
                  : 'bg-[#DC2626] text-white'
                : 'text-text-2 hover:bg-surface-2 hover:text-text',
            )}
          >
            {s === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      <div className="space-y-5 p-5">
        {/* Market / Limit */}
        <div className="flex gap-5 border-b border-border-soft" role="tablist" aria-label="Order type">
          {(['market', 'limit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => setType(t)}
              className={cx(
                '-mb-px border-b-2 pb-2.5 text-[13px] transition-colors',
                type === t ? 'border-text text-text' : 'border-transparent text-text-3 hover:text-text',
              )}
            >
              {t === 'market' ? 'Market' : 'Limit'}
            </button>
          ))}
        </div>

        {type === 'limit' ? (
          // G7: limit orders are Tier 3 — shown, blurred, with the tier named.
          <TierGate requiredTier="tier3">
            <div className="space-y-3">
              <Field label="Limit price" htmlFor={`${ids}-limit`} suffix="USD">
                <input
                  id={`${ids}-limit`}
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => {
                    setLimit(e.target.value);
                    setAckDeviation(false);
                  }}
                  onBlur={() => setTouched(true)}
                  placeholder={last ? formatPrice(last) : '0.00'}
                  className="w-full bg-transparent font-mono text-[15px] focus:outline-none"
                />
              </Field>
              {needsAck && deviation != null ? (
                <label className="flex items-start gap-2.5 text-[12px] leading-snug text-text-2">
                  <input
                    type="checkbox"
                    checked={ackDeviation}
                    onChange={(e) => setAckDeviation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#84CC16]"
                  />
                  This limit is {(deviation * 100).toFixed(1)}% away from the last price. I meant
                  to set it there.
                </label>
              ) : null}
            </div>
          </TierGate>
        ) : null}

        <div>
          <Field label="Amount" htmlFor={`${ids}-amount`} suffix="shares">
            <input
              id={`${ids}-amount`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="0"
              className="w-full bg-transparent font-mono text-[15px] focus:outline-none"
            />
          </Field>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {FRACTIONS.map((f) => (
              <button
                key={f.label}
                type="button"
                // Fractions are of your balance, which needs a wallet.
                disabled={!connected}
                title={connected ? undefined : 'Needs your balance — connect a wallet'}
                className="h-8 rounded-full border border-border font-mono text-[12px] text-text-2 transition-colors hover:border-text-3 hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <dl className="space-y-2 rounded-panel bg-surface-2 p-4 text-[13px]">
          <Row label="Last price" value={formatPrice(last)} />
          <Row
            label="Indicative value"
            value={indicative != null ? `≈ ${formatPrice(indicative)}` : '––––'}
          />
          <Row label="Fee and gas" value="in the quote" muted />
          <p className="pt-1 text-[11px] leading-snug text-text-3">
            Indicative only. The server&apos;s quote sets the real price, fee, and total before
            you sign.
          </p>
        </dl>

        {problems.length > 0 ? (
          <ul className="space-y-1" aria-live="polite">
            {problems.map((p) => (
              <li key={p} className="text-[12px] leading-snug text-down">
                {p}
              </li>
            ))}
          </ul>
        ) : null}

        {quote ? (
          <OrderPreviewCard quote={quote} onRequote={() => setQuote(null)} />
        ) : (
          <div>
            <button
              type="button"
              disabled={!canReview || quoting}
              title={!connected ? 'Connect a wallet to check your balance and gas, and to sign.' : undefined}
              className="btn-primary w-full text-sm"
              onClick={() => {
                setTouched(true);
                void requestQuote();
              }}
            >
              {quoting
                ? 'Getting a quote…'
                : side === 'buy'
                  ? `Review buy ${symbol}`
                  : `Review sell ${symbol}`}
            </button>
            {!connected ? (
              <p className="mt-2 text-center text-[12px] text-text-3">
                Connect a wallet to check your balance and gas, and to sign.
              </p>
            ) : quoteError ? (
              <p className="mt-2 text-center text-[12px] text-down">{quoteError}</p>
            ) : null}
          </div>
        )}

        <p className="border-t border-border-soft pt-4 text-center text-[12px] text-text-2">
          Robinchan builds the order. You sign it.
        </p>
      </div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  suffix,
  children,
}: {
  label: string;
  htmlFor: string;
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="t-eyebrow mb-2 block">
        {label}
      </label>
      <div className="flex h-12 items-center gap-2 rounded-panel border border-border bg-surface px-3.5 focus-within:border-accent-2">
        {children}
        <span className="shrink-0 font-mono text-[12px] text-text-3">{suffix}</span>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-2">{label}</dt>
      <dd className={cx('font-mono', muted ? 'text-text-3' : 'text-text')}>{value}</dd>
    </div>
  );
}
