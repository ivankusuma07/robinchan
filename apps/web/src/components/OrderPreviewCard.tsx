'use client';

import { useEffect, useState } from 'react';
import type { OrderQuote } from '@robinchan/shared';
import { formatPrice } from '@robinchan/shared';

import { PulseDot, cx } from '@/components/ui';

/**
 * Komponen paling sensitif di produk (brief §7).
 *
 * Aturan yang dikunci di sini:
 * - Semua nilai datang dari `quote`, yaitu respons server. Tidak ada angka yang
 *   dihitung ulang di client.
 * - Tombol tanda tangan mati sampai quote diterima dan selama belum kedaluwarsa.
 * - Masa berlaku quote ditampilkan sebagai hitung mundur; habis berarti mati
 *   dan minta quote ulang.
 * - Tidak ada tema karakter di kartu ini — tampilannya sama persis dengan atau
 *   tanpa Zundamon di ruangan (design.md §5).
 */
export function OrderPreviewCard({
  quote,
  onSign,
  onRequote,
  /** Dipakai di kartu demo Home yang memang statis dan tidak tersambung API. */
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
        <p className="text-[13px] text-text-3">Menunggu quote dari server…</p>
      </div>
    );
  }

  const { intent } = quote;
  const sideLabel = intent.side === 'buy' ? 'BELI' : 'JUAL';

  return (
    <div
      className={cx('card-soft bg-surface-2 p-5', expired && 'border-border-soft', className)}
      aria-label="Pratinjau order"
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
            contoh
          </span>
        ) : (
          <span
            className={cx(
              'inline-flex items-center gap-1.5 font-mono text-[11px]',
              expired ? 'text-down' : 'text-text-2',
            )}
          >
            {expired ? null : <PulseDot />}
            {expired ? 'quote kedaluwarsa' : `${remaining ?? '--'}s`}
          </span>
        )}
      </div>

      <dl className="space-y-2.5 border-t border-border-soft pt-4">
        <Line label="Jumlah" value={`${intent.qty} unit`} />
        <Line label="Harga entry" value={formatPrice(quote.estPrice)} />
        {intent.limitPrice != null ? (
          <Line label="Batas limit" value={formatPrice(intent.limitPrice)} />
        ) : null}
        <Line label="Estimasi gas" value={formatPrice(quote.estGas)} muted />
        <Line label="Fee protokol" value={formatPrice(quote.protocolFee)} muted />
        <Line label="Estimasi total" value={formatPrice(quote.estTotal)} emphasis />
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
              ? 'Kartu contoh — penandatanganan aktif di milestone M4'
              : expired
                ? 'Quote sudah kedaluwarsa'
                : undefined
          }
        >
          Tanda tangan di wallet
        </button>
        {expired ? (
          <button type="button" onClick={onRequote} className="btn-ghost text-sm">
            Quote ulang
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-text-3">
        Kamu yang menandatangani. Server hanya menyusun payload dan tidak pernah bisa mengirim
        transaksi atas namamu.
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

/** Detik tersisa sampai `expiresAt`, dihitung di client dari timestamp UTC. */
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
