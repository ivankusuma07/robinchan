'use client';

import Link from 'next/link';
import type { ApiEnvelope, Ticker } from '@robinchan/shared';
import { POLL_MS, WATCHED_SYMBOLS, formatClock } from '@robinchan/shared';

import { ArrowRightIcon } from '@/components/icons';
import { TickerRow, TickerRowEmpty } from '@/components/TickerCard';
import { CardHead, StaleBadge } from '@/components/ui';
import { isUnset } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';

/**
 * Panel "Market sekarang" — 412×384px di kanan hero (brief §4).
 *
 * Tingginya dikunci supaya layout tidak melompat saat data datang: lima baris
 * placeholder punya tinggi yang sama dengan lima baris berisi.
 */
export function MarketSnapshot({ initial }: { initial: ApiEnvelope<Ticker[]> }) {
  const envelope = usePoll<Ticker[]>('/api/market/snapshot', initial, POLL_MS.snapshot);
  const rows = envelope.data;
  const empty = rows.length === 0;
  const placeholders = WATCHED_SYMBOLS.slice(0, 5);

  return (
    <section className="card flex h-[384px] w-full flex-col shadow-glow-soft">
      <CardHead
        title="Market sekarang"
        aside={
          <>
            {envelope.stale && !isUnset(envelope) ? <StaleBadge /> : null}
            <span className="font-mono text-[11px] text-text-3">
              {isUnset(envelope) ? '--:--:--' : formatClock(envelope.asOf)}
            </span>
          </>
        }
      />

      <div className="flex-1 divide-y divide-border-soft overflow-hidden">
        {empty
          ? placeholders.map((symbol) => <TickerRowEmpty key={symbol} symbol={symbol} />)
          : rows
              .slice(0, 5)
              .map((ticker) => (
                <TickerRow key={ticker.symbol} ticker={ticker} stale={envelope.stale} />
              ))}
      </div>

      <div className="border-t border-border-soft p-3">
        <Link href="/market" className="btn-ghost w-full text-sm" aria-label="Buka halaman Market">
          Lihat semua market
          <ArrowRightIcon />
        </Link>
      </div>
    </section>
  );
}
