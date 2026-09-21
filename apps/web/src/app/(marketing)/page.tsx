import type { HeatScore, Ticker } from '@robinchan/shared';

import { Reveal } from '@/components/Reveal';
import { ChatDemo } from '@/components/home/ChatDemo';
import { HeatBoard } from '@/components/home/HeatBoard';
import { Hero } from '@/components/home/Hero';
import { MarqueeRows } from '@/components/home/MarqueeRows';
import { CapitalFlow, FeatureCards, SiteFooter } from '@/components/home/Sections';
import { getEnvelope, ssr } from '@/lib/api';

/**
 * Home (brief §4): a marketing page that must stay readable without a wallet
 * connected. Rendered on the server, then price data hydrates on the client.
 *
 * Uses the marketing shell, not the dashboard one (design.md §10) — this is
 * the one page built to be scrolled through once and sell the idea, so it
 * gets its own top nav, a full-bleed hero backdrop, and scroll-triggered
 * entrances the dashboard pages deliberately skip.
 */
export const revalidate = 15;

export default async function HomePage() {
  const [snapshot, heat] = await Promise.all([
    getEnvelope<Ticker[]>('/api/market/snapshot', [], ssr(15)),
    getEnvelope<HeatScore[]>('/api/heat?limit=5', [], ssr(60)),
  ]);

  return (
    <>
      <Hero snapshot={snapshot} />

      <div className="page-container px-5 pb-24 lg:px-10">
        {/* The chat demo and heat board share the hero's column rhythm
            (660 / 412) so the page has one consistent backbone. */}
        <section className="grid-hero items-start pb-4">
          <Reveal>
            <ChatDemo />
          </Reveal>
          <Reveal delayMs={100}>
            <HeatBoard initial={heat} />
          </Reveal>
        </section>

        <Reveal>
          <MarqueeRows initial={snapshot} />
        </Reveal>

        <Reveal>
          <FeatureCards />
        </Reveal>

        <Reveal>
          <CapitalFlow />
        </Reveal>

        <SiteFooter />
      </div>
    </>
  );
}
