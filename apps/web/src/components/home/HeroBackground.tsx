'use client';

import dynamic from 'next/dynamic';

/**
 * `ssr: false` only works from inside a Client Component boundary — this
 * file exists purely to hold that boundary so `Hero.tsx` itself can stay a
 * plain Server Component (it's awaiting `snapshot` from the page above it).
 * Same pattern as `Live2DStage` dynamic-importing `Live2DCanvas`.
 */
const GhostFibers = dynamic(() => import('@/components/effects/GhostFibers'), {
  ssr: false,
  loading: () => null,
});

/** Hero's full-bleed backdrop (design.md §10) — accent-green/companion-pink fiber field. */
export function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 opacity-60">
        <GhostFibers lineColor="#7BE07B" glowColor="#FFB6C1" />
      </div>
      {/* Fades the art back to flat black before the next section, so the
          glow reads as "hero backdrop", not a tint over the whole page. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
