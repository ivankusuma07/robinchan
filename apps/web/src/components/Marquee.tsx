import type { ReactNode } from 'react';

import { cx } from '@/components/ui';

/**
 * Baris yang jalan sendiri (brief §7).
 *
 * Isinya diduplikasi dua kali di dalam track lalu `translateX` dianimasikan
 * dari 0 ke −50% supaya loop-nya mulus. Pakai CSS `animation`, bukan
 * `requestAnimationFrame` — lebih hemat dan berhenti sendiri saat tab tidak
 * aktif. `prefers-reduced-motion` dihormati lewat aturan global di globals.css.
 *
 * Jarak antar kartu ditaruh sebagai `padding-right` di tiap salinan, bukan
 * sebagai `gap` di track. Dengan `gap`, lebar track jadi 2W + gap sementara
 * −50% memindahkan W + gap/2, dan jahitannya meleset setengah jarak.
 */
export function Marquee({
  children,
  speed = 40,
  direction = 'left',
  gap = 12,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  /** Detik per satu putaran penuh. */
  speed?: number;
  direction?: 'left' | 'right';
  gap?: number;
  className?: string;
  ariaLabel: string;
}) {
  const half = (
    <div className="flex shrink-0 items-center" style={{ gap: `${gap}px`, paddingRight: gap }}>
      {children}
    </div>
  );

  return (
    <div
      className={cx('mask-edges group relative overflow-hidden', className)}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        className="flex w-max will-change-transform group-hover:[animation-play-state:paused]"
        style={{
          animationName: direction === 'left' ? 'marquee-left' : 'marquee-right',
          animationDuration: `${speed}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }}
      >
        {half}
        {/* Salinan kedua menutup jahitan di titik −50%. */}
        <div aria-hidden className="flex shrink-0">
          {half}
        </div>
      </div>
    </div>
  );
}
