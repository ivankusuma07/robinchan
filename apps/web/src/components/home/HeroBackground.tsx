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
      /* Light theme: the footage is lifted and desaturated toward the page's
         sage, and the scrim washes it *light* (not dark) so the dark
         headline reads over it — the same left/down weighting as before,
         inverted. */
      filter="brightness(1.08) saturate(0.6) contrast(0.92) blur(2px)"
      scrim={[
        /* Brand cast over the top edge. */
        'radial-gradient(100% 70% at 50% 0%, rgba(212, 244, 80, 0.22), transparent 62%)',
        /* Protects the left text column, releases the right. */
        'linear-gradient(to right, rgba(248,250,246,0.9) 0%, rgba(248,250,246,0.72) 42%, rgba(248,250,246,0.4) 70%, rgba(248,250,246,0.25) 100%)',
        /* Eases the footage out over the lower half and resolves to the
           flat page background, so the next section starts on solid color
           with no band at the seam. Pairs with the top mask on
           `<AmbientField>`. */
        'linear-gradient(to bottom, rgba(248,250,246,0.1) 0%, rgba(248,250,246,0.2) 40%, rgba(248,250,246,0.38) 55%, rgba(248,250,246,0.56) 68%, rgba(248,250,246,0.72) 79%, rgba(248,250,246,0.86) 88%, rgba(248,250,246,0.96) 95%, #F8FAF6 100%)',
      ].join(', ')}
      playbackRate={0.5}
    />
  );
}
