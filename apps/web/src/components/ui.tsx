import type { ReactNode } from 'react';

import { LockIcon } from '@/components/icons';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cx('card', className)}>{children}</Tag>;
}

/**
 * Kepala kartu: eyebrow di kiri, slot bebas di kanan. Dipakai di hampir semua
 * kartu supaya tinggi barisnya seragam lintas halaman.
 */
export function CardHead({
  title,
  aside,
  className,
}: {
  title: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        'flex h-[52px] items-center justify-between gap-3 border-b border-border-soft px-5',
        className,
      )}
    >
      <h2 className="t-eyebrow">{title}</h2>
      {aside ? <div className="flex items-center gap-2">{aside}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'muted' | 'pink';
  className?: string;
}) {
  const tones = {
    neutral: 'border-border text-text-2',
    accent: 'border-accent/40 text-accent',
    muted: 'border-border-soft text-text-3',
    pink: 'border-companion-pink/35 text-companion-pink',
  } as const;
  return <span className={cx('pill font-mono', tones[tone], className)}>{children}</span>;
}

/** Titik aksen berdenyut untuk indikator live (design.md §2). */
export function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cx('relative inline-flex h-1.5 w-1.5', className)}>
      <span className="absolute inset-0 animate-pulse-dot rounded-full bg-accent" />
    </span>
  );
}

export function SentimentDot({ tone }: { tone: 'pos' | 'neg' | 'neu' }) {
  const styles = {
    // Glow hanya di sisi positif — merah dibiarkan klinis (design.md §6).
    pos: 'bg-up shadow-[0_0_8px_rgba(110,231,135,0.55)]',
    neg: 'bg-down',
    neu: 'bg-text-3',
  } as const;
  const labels = {
    pos: 'sentimen positif',
    neg: 'sentimen negatif',
    neu: 'sentimen netral',
  };
  return (
    <span
      className={cx('inline-block h-2 w-2 shrink-0 rounded-full', styles[tone])}
      role="img"
      aria-label={labels[tone]}
    />
  );
}

export function StatusDot({ state }: { state: 'ok' | 'idle' | 'down' }) {
  const styles = {
    ok: 'bg-up shadow-[0_0_7px_rgba(110,231,135,0.5)]',
    idle: 'bg-text-3',
    down: 'bg-down',
  } as const;
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', styles[state])} />;
}

/**
 * Penanda data basi. Dibuat pill, bukan sekadar teks diredupkan, supaya tetap
 * terbaca (design.md §6).
 */
export function StaleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border border-border-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-3',
        className,
      )}
      title="Worker belum menyegarkan data ini"
    >
      stale
    </span>
  );
}

export function SoonBadge() {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
      Soon
    </span>
  );
}

export function LockedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-text-3">
      <LockIcon />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */

/** Placeholder garis, dipakai sebelum data harga terhidrasi. */
export function DashLine({ width = '3ch' }: { width?: string }) {
  return (
    <span className="font-mono text-text-3" style={{ width }} aria-hidden>
      ––––
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('block animate-breathe rounded bg-surface-2', className)} />;
}

/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div className="max-w-[620px]">
        <p className="t-eyebrow mb-3">{eyebrow}</p>
        <h1 className="t-h2 mb-2">{title}</h1>
        <p className="t-body">{lead}</p>
      </div>
      {aside}
    </header>
  );
}
