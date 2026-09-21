'use client';

import { useEffect, useState } from 'react';
import type { OrderQuote } from '@robinchan/shared';
import { formatPrice } from '@robinchan/shared';

import { PulseDot, cx } from '@/components/ui';

/**
 * The most sensitive component in the product (brief §7).
 *
 * Rules locked in here:
 * - Every value comes from `quote`, the server's response. Nothing is
 *   recomputed on the client.
 * - The sign button stays disabled until a quote is received, and while it's
 *   expired.
 * - The quote's validity window is shown as a countdown; once it hits zero,
 *   the button dies and a fresh quote is required.
 * - No character theming on this card — it looks identical whether or not
 *   Zundamon is in the room (design.md §5).
 */
export function OrderPreviewCard({
  quote,
  onSign,
  onRequote,
  /** Used by the static Home demo card, which isn't wired to the API. */
  demo = false,
  className,
}: {
  quote: OrderQuote | null;
  onSign?: () => void;
  onRequote?: () => void;
  demo?: boolean;
  className?: string;
}) {
  const remaining = useCountdown(demo ? null : (quote?.expiresAt ?? null));
  const expired = !demo && quote != null && remaining != null && remaining <= 0;
  const ready = quote != null && !expired;

  if (!quote) {
    return (
      <div className={cx('card-soft bg-surface-2 p-5', className)}>
        <p className="t-eyebrow mb-3">Order preview</p>
        <p className="text-[13px] text-text-3">Waiting for a quote from the server…</p>
      </div>
    );
  }

  const { intent } = quote;
  const sideLabel = intent.side === 'buy' ? 'BUY' : 'SELL';

  return (
    <div
      className={cx('card-soft bg-surface-2 p-5', expired && 'border-border-soft', className)}
      aria-label="Order preview"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cx(
              'rounded-full px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.08em]',
              intent.side === 'buy' ? 'bg-up/15 text-up' : 'bg-down/15 text-down',
            )}
          >
            {sideLabel}
          </span>
          <span className="font-mono text-[14px] tracking-[0.04em]">{intent.symbol}</span>
          <span className="font-mono text-[12px] text-text-3">
            {intent.orderType === 'limit' ? 'limit' : 'market'}
          </span>
        </div>

        {demo ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-3">
            example
          </span>
        ) : (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 font-mono text-[11px]',
              expired ? 'text-down' : 'text-text-2',
            )}
          >
            {expired ? null : <PulseDot />}
            {expired ? 'quote expired' : `${remaining ?? '--'}s`}
          </span>
        )}
      </div>

      <dl className="space-y-2.5 border-t border-border-soft pt-4">
        <Line label="Quantity" value={`${intent.qty} unit`} />
        <Line label="Entry price" value={formatPrice(quote.estPrice)} />
        {intent.limitPrice != null ? (
          <Line label="Limit price" value={formatPrice(intent.limitPrice)} />
        ) : null}
        <Line label="Estimated gas" value={formatPrice(quote.estGas)} muted />
        <Line label="Protocol fee" value={formatPrice(quote.protocolFee)} muted />
        <Line label="Estimated total" value={formatPrice(quote.estTotal)} emphasis />
      </dl>

      {quote.warnings.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-border-soft pt-4">
          {quote.warnings.map((warning) => (
            <li key={warning} className="flex gap-2 text-[12px] leading-snug text-down">
              <span aria-hidden>!</span>
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={onSign}
          disabled={!ready || demo}
          className="btn-primary flex-1 text-sm"
          title={
            demo
              ? 'Demo card — signing goes live in milestone M4'
              : expired
                ? 'This quote has expired'
                : undefined
          }
        >
          Sign in wallet
        </button>
        {expired ? (
          <button type="button" onClick={onRequote} className="btn-ghost text-sm">
            Get new quote
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-3">
        You&apos;re the one who signs. The server only builds the payload and can never send a
        transaction on your behalf.
      </p>
    </div>
  );
}

function Line({
  label,
  value,
  muted,
  emphasis,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cx('text-[13px]', muted ? 'text-text-3' : 'text-text-2')}>{label}</dt>
      <dd
        className={cx(
          'font-mono text-[13px]',
          emphasis ? 'text-[15px] text-text' : muted ? 'text-text-3' : 'text-text',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Seconds remaining until `expiresAt`, computed client-side from the UTC timestamp. */
function useCountdown(expiresAt: string | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const seconds = Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000);
      setRemaining(Number.isFinite(seconds) ? Math.max(0, seconds) : null);
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return remaining;
}
