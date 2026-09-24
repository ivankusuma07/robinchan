import type { OrderRecord, OrderStatus } from '@robinchan/shared';
import { formatPrice, shortAddress } from '@robinchan/shared';

import { cx } from '@/components/ui';

const STATUS_LABEL: Record<OrderStatus, string> = {
  parsed: 'Draft',
  quoted: 'Quoted',
  signed: 'Signed',
  pending: 'Pending',
  confirmed: 'Filled',
  open: 'Open',
  cancelled: 'Cancelled',
  failed: 'Failed',
  expired: 'Expired',
};

const STATUS_TONE: Record<OrderStatus, string> = {
  parsed: 'border-border text-text-3',
  quoted: 'border-border text-text-2',
  signed: 'border-border text-text-2',
  pending: 'border-info/40 text-info',
  confirmed: 'border-up/40 text-up',
  open: 'border-accent-2/70 text-accent',
  cancelled: 'border-border text-text-3',
  failed: 'border-down/40 text-down',
  expired: 'border-border text-text-3',
};

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/**
 * Order history (plan §7/§8), one component for Portfolio and for Trade's
 * History tab. Prices shown are fill prices from the receipt (G1) — an order
 * without a fill shows its limit price, labelled, or nothing; it never shows
 * a price the order didn't actually execute at.
 */
export function OrderHistory({
  orders,
  empty = 'No orders yet. Orders you place through Robinchan show up here.',
}: {
  orders: OrderRecord[];
  empty?: string;
}) {
  if (orders.length === 0) {
    return <p className="px-5 py-8 text-center text-[13px] text-text-3">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-border-soft font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
            <th className="px-5 py-2.5 font-normal">Date (UTC)</th>
            <th className="px-3 py-2.5 font-normal">Order</th>
            <th className="px-3 py-2.5 text-right font-normal">Qty</th>
            <th className="px-3 py-2.5 text-right font-normal">Price</th>
            <th className="px-3 py-2.5 text-right font-normal">Fee</th>
            <th className="px-3 py-2.5 font-normal">Status</th>
            <th className="px-5 py-2.5 text-right font-normal">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft">
          {orders.map((o) => {
            const filled = o.fillPrice != null && o.filledQty != null;
            return (
              <tr key={o.id} className="text-[13px]">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-[12px] text-text-2">
                  {DATE.format(new Date(o.filledAt ?? o.createdAt))}
                </td>
                <td className="px-3 py-3">
                  <span className={cx('font-medium', o.side === 'buy' ? 'text-up' : 'text-down')}>
                    {o.side === 'buy' ? 'Buy' : 'Sell'}
                  </span>{' '}
                  <span className="font-mono tracking-[0.04em]">{o.symbol}</span>
                  {o.limitPrice != null ? (
                    <span className="ml-1.5 font-mono text-[11px] text-text-3">limit</span>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {filled ? o.filledQty : o.qty}
                </td>
                <td className="px-3 py-3 text-right font-mono">
                  {filled ? (
                    formatPrice(o.fillPrice)
                  ) : o.limitPrice != null ? (
                    <span className="text-text-3">≤ {formatPrice(o.limitPrice)}</span>
                  ) : (
                    <span className="text-text-3">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right font-mono text-text-3">
                  {o.feeUsd != null ? formatPrice(o.feeUsd) : '—'}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cx(
                      'inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px]',
                      STATUS_TONE[o.status],
                    )}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-5 py-3 text-right font-mono text-[12px] text-text-3">
                  {o.txHash ? shortAddress(o.txHash) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
