'use client';

import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

import { PodIcon } from '@/components/icons';
import { CardHead, Pill, cx } from '@/components/ui';

import { MOODS, MOOD_GLOW, MOOD_LABEL, type Mood } from './expressions';
import type { Live2DHandle, StageStatus } from './Live2DCanvas';

/**
 * SDK-nya dimuat dinamis dengan `ssr: false` supaya bundle halaman lain tidak
 * ikut kebawa (brief §5).
 */
const Live2DCanvas = dynamic(() => import('./Live2DCanvas').then((m) => m.Live2DCanvas), {
  ssr: false,
  loading: () => null,
});

/**
 * Stage Live2D (brief §5): canvas 400px di dalam kartu, interaksi ditahan
 * sampai model selesai dimuat, dan skeleton — bukan layar kosong — selama
 * menunggu.
 */
export function Live2DStage() {
  const handle = useRef<Live2DHandle | null>(null);
  const [status, setStatus] = useState<StageStatus>('loading');
  const [mood, setMood] = useState<Mood>('santai');

  const ready = status === 'ready';
  const noWebGL = status === 'unsupported' || status === 'failed';

  const pick = (next: Mood) => {
    setMood(next);
    handle.current?.setExpression(next);
  };

  return (
    <section
      className="card overflow-hidden transition-shadow duration-700"
      style={{ boxShadow: ready ? MOOD_GLOW[mood] : undefined }}
    >
      <CardHead
        title="Robinchan"
        aside={
          <Pill tone={ready ? 'accent' : 'muted'}>
            {status === 'loading' ? 'memuat model' : ready ? MOOD_LABEL[mood] : 'mode statis'}
          </Pill>
        }
      />

      <div className="relative h-[400px] bg-surface-2">
        {noWebGL ? (
          <StaticFallback reason={status} />
        ) : (
          <Live2DCanvas handleRef={handle} onStatus={setStatus} className="h-full w-full" />
        )}
        {status === 'loading' ? <StageSkeleton /> : null}
      </div>

      <div className="border-t border-border-soft p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="t-eyebrow">Ekspresi</span>
          {noWebGL ? (
            <span className="font-mono text-[11px] text-text-3">WebGL tidak tersedia</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {MOODS.map((option) => (
            <button
              key={option}
              type="button"
              // Interaksi ditahan sampai model selesai dimuat.
              disabled={!ready}
              onClick={() => pick(option)}
              aria-pressed={mood === option}
              className={cx(
                'min-h-[40px] rounded-full border px-4 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                mood === option && ready
                  ? 'border-accent/45 bg-accent/[0.07] text-text'
                  : 'border-border text-text-2 hover:border-text-3 hover:text-text',
              )}
            >
              {MOOD_LABEL[option]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-text-3">
          Di M3 ekspresi ini ikut berganti sendiri dari balasan chat. Tombol suara menyusul bersama
          VOICEVOX di fase 2 — sampai itu ada, mulutnya sengaja dibiarkan idle.
        </p>
      </div>
    </section>
  );
}

/**
 * Skeleton bernapas dalam warna aksen, bukan abu — stage harus sudah terasa
 * hidup sebelum modelnya datang. Tiga titik disusun seperti polong edamame,
 * bukan spinner generik (design.md §5).
 */
function StageSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-surface-2">
      <div className="h-[168px] w-[120px] animate-breathe rounded-[60px] bg-accent/25" />
      <div className="flex items-end gap-1.5" role="status" aria-label="Memuat model">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pod-bounce rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Fallback tanpa WebGL (brief §5): gambar statis karakter, tombol bicara
 * disembunyikan.
 *
 * Berkas `.moc3` bukan gambar dan tekstur mentahnya cuma atlas potongan tubuh,
 * jadi tidak ada satu pun aset di paket model yang bisa dipakai apa adanya.
 * Sampai render statis Zundamon tersedia terpisah, slot ini diisi placeholder
 * yang jujur — dan jalurnya tetap satu tempat, ikut tertukar bersama model.
 */
function StaticFallback({ reason }: { reason: StageStatus }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-border bg-surface text-accent">
        <PodIcon width={38} height={38} />
      </span>
      <p className="max-w-[320px] text-[13px] leading-relaxed text-text-3">
        {reason === 'unsupported'
          ? 'Browser ini tidak menyediakan WebGL, jadi modelnya tidak bisa digambar.'
          : 'Model gagal dimuat. Bisa jadi asetnya belum lengkap atau Cubism Core tidak bisa diambil.'}{' '}
        Chat dan data market tetap jalan seperti biasa.
      </p>
    </div>
  );
}
