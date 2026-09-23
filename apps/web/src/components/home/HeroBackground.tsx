import { VideoBackdrop } from '@/components/effects/VideoBackdrop';

/**
 * Hero's full-bleed backdrop (design.md §10, §10.3) — the trading-hall loop,
 * covering the whole hero section rather than a band at the top of it.
 *
 * **The fake tickers are cropped out of the source, not blurred away.** The
 * first pass hid them under `blur(3px)` plus `brightness(0.34)`, which
 * worked but cost the footage everything that made it worth using. The
 * board carrying the invented symbols and percentage moves sits in the top
 * 20% of frame, so `hero.mp4` is now encoded with that strip cropped off
 * (1920×864 from y=216). What survives is architecture, light, and slogan
 * text — "GOOD TRADERS BETTER PEOPLE" is a mood line, not market data, so
 * it can stay legible. That buys back the brightness and most of the blur.
 *
 * What remains readable is the desk monitors' chart shapes, which carry no
 * figures; `blur(2px)` covers those. **Any recrop of this file has to keep
 * the top strip out of frame**, or the blur has to go back up to compensate.
 *
 * The scrim is asymmetric on purpose. The footage is dark at the top (arches
 * and banners) and bright at the bottom (a polished reflective floor), which
 * is exactly inverted from where this hero needs contrast: the headline sits
 * high-left where the image is already dark, and the lead paragraph and CTA
 * row sit low-left over the brightest part of the plate. So the scrim
 * weights left and down, and leaves the upper right — where the
 * `MarketSnapshot` glass panel sits — nearly clear, so the panel has
 * something worth refracting.
 */
export function HeroBackground() {
  return (
    <VideoBackdrop
      src="/video/hero.mp4"
      poster="/video/hero-poster.jpg"
      className="absolute inset-0 -z-10"
      filter="brightness(0.62) saturate(0.75) contrast(1.06) blur(2px)"
      scrim={[
        /* Brand cast over the top edge. */
        'radial-gradient(100% 70% at 50% 0%, rgba(123, 224, 123, 0.10), transparent 62%)',
        /* Protects the left text column, releases the right. */
        'linear-gradient(to right, rgba(10,10,10,0.62) 0%, rgba(10,10,10,0.34) 42%, rgba(10,10,10,0.08) 70%, rgba(10,10,10,0) 100%)',
        /* Holds the top open, then takes the bright floor down and resolves
           to flat background so the next section starts on solid color.
           The ramp is eased over the whole lower half rather than snapping
           shut in the last ~20% — a short, steep ramp reads as a dark band
           sitting on the seam instead of the footage dissolving into the
           page. Pairs with the top mask on `<AmbientField>`. */
        'linear-gradient(to bottom, rgba(10,10,10,0.18) 0%, rgba(10,10,10,0.28) 40%, rgba(10,10,10,0.42) 55%, rgba(10,10,10,0.58) 68%, rgba(10,10,10,0.74) 79%, rgba(10,10,10,0.87) 88%, rgba(10,10,10,0.96) 95%, #0A0A0A 100%)',
      ].join(', ')}
      playbackRate={0.5}
    />
  );
}
