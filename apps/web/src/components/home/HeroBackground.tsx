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

/**
 * Hero's full-bleed backdrop (design.md §10) — accent-green/companion-pink
 * fiber field.
 *
 * Confined to a fixed-height band from the top, not the whole hero section:
 * below `lg` the hero's lead text and the market panel stack instead of
 * sitting side by side, so the section's total height (and where the CTA
 * row lands within it) varies a lot between mobile and desktop. A band
 * pinned to the top and sized around the badge+headline instead lands in
 * the same place regardless — full strength behind the bold headline (which
 * reads fine over anything), fully faded to flat `bg-bg` before the lead
 * paragraph and the CTA row's bordered ghost button, on every layout.
 *
 * The height is per-breakpoint because the headline is the thing being
 * covered and it isn't the same height at both: three lines of `.t-display`
 * is ~118px at the 40px mobile floor and ~294px at the 100px desktop
 * ceiling. One fixed height would either cut off the desktop headline
 * mid-word or still be washing over mobile's lead paragraph.
 */
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] overflow-hidden lg:h-[620px]"
    >
      <div className="absolute inset-0 opacity-60">
        <GhostFibers lineColor="#7BE07B" glowColor="#FFB6C1" />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent 0%, transparent 28%, rgba(10,10,10,0.7) 50%, #0A0A0A 68%, #0A0A0A 100%)',
        }}
      />
    </div>
  );
}
