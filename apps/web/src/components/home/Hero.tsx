import Link from 'next/link';
import type { ApiEnvelope, Ticker } from '@robinchan/shared';

import { ArrowRightIcon } from '@/components/icons';
import { PulseDot } from '@/components/ui';

import { MarketSnapshot } from './MarketSnapshot';

/**
 * Hero + panel "Market sekarang" (brief §4 blok 1–2).
 * Kolom kiri 660px, panel kanan 412×384px, jarak 40px — angka artboard.
 */
export function Hero({ snapshot }: { snapshot: ApiEnvelope<Ticker[]> }) {
  return (
    <section className="grid-hero items-start pb-16">
      <div className="max-w-hero">
        <p className="pill mb-7 border-accent/35 font-mono text-accent">
          <PulseDot />
          Live di Robinhood Chain
        </p>

        <h1 className="t-display mb-6">
          Baca market.
          <br />
          Ngobrol.
          <br />
          <span className="text-accent">Tanda tangani sendiri.</span>
        </h1>

        <p className="t-body mb-9 max-w-[520px] text-[16px]">
          Robinchan membaca saham tokenized, berita, dan aktivitas on-chain di satu layar. Susun
          order lewat kalimat biasa — lalu kamu yang menekan tombol tanda tangan di wallet sendiri.
          Tidak ada custody, tidak ada eksekusi diam-diam.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/robinchan" className="btn-primary">
            Ngobrol dengan Robinchan
            <ArrowRightIcon />
          </Link>
          <Link href="/market" className="btn-ghost">
            Lihat market dulu
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-border-soft pt-7">
          <Stat label="Chain" value="Robinhood Chain" />
          <Stat label="Token" value="$RCHAN" />
          <Stat label="Custody" value="Tidak ada" />
        </dl>
      </div>

      <MarketSnapshot initial={snapshot} />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-eyebrow mb-2">{label}</dt>
      <dd className="font-mono text-[13px] text-text-2">{value}</dd>
    </div>
  );
}
