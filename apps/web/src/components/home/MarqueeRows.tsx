'use client';

import type { ApiEnvelope, Ticker } from '@robinchan/shared';
import { POLL_MS } from '@robinchan/shared';

import { Marquee } from '@/components/Marquee';
import { TickerChip } from '@/components/TickerCard';
import { usePoll } from '@/lib/usePoll';

/**
 * Dua baris marquee (brief §4 blok 5): kartu ticker jalan ke kiri di atas,
 * chip contoh perintah jalan ke kanan di bawah.
 */

const COMMANDS = [
  'beli 2 AAPL di harga pasar',
  'kenapa NVDA panas hari ini?',
  'jual setengah posisi TSLA',
  'ada filing baru buat COIN?',
  'pasang limit beli MSFT di 505',
  'ringkas berita chain 6 jam terakhir',
  'bandingkan heat AAPL sama META',
  'watchlist aku isinya apa aja?',
];

export function MarqueeRows({ initial }: { initial: ApiEnvelope<Ticker[]> }) {
  const envelope = usePoll<Ticker[]>('/api/market/snapshot', initial, POLL_MS.snapshot);
  const tickers = envelope.data;

  return (
    <section className="space-y-3 py-4" aria-label="Ringkasan bergerak">
      {tickers.length > 0 ? (
        <Marquee ariaLabel="Harga terkini" speed={52} direction="left" gap={12}>
          {/* Lima ticker tidak cukup lebar untuk menutup track di 1440px, jadi
              daftarnya diulang sampai melewati lebar kontainer. */}
          {[0, 1, 2].flatMap((pass) =>
            tickers.map((ticker) => (
              <TickerChip key={`${pass}-${ticker.symbol}`} ticker={ticker} />
            )),
          )}
        </Marquee>
      ) : (
        <div className="h-[38px]" aria-hidden />
      )}

      <Marquee ariaLabel="Contoh perintah" speed={64} direction="right" gap={10}>
        {COMMANDS.map((command) => (
          <span
            key={command}
            className="shrink-0 whitespace-nowrap rounded-full border border-border-soft bg-surface px-4 py-2 text-[13px] text-text-2"
          >
            {command}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
