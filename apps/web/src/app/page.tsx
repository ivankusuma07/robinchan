import type { HeatScore, Ticker } from '@robinchan/shared';

import { ChatDemo } from '@/components/home/ChatDemo';
import { HeatBoard } from '@/components/home/HeatBoard';
import { Hero } from '@/components/home/Hero';
import { MarqueeRows } from '@/components/home/MarqueeRows';
import { CapitalFlow, FeatureCards, SiteFooter } from '@/components/home/Sections';
import { getEnvelope, ssr } from '@/lib/api';

/**
 * Home (brief §4): a marketing page that must stay readable without a wallet
 * connected. Rendered on the server, then price data hydrates on the client.
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

      {/* The chat demo and heat board share the hero's column rhythm
          (660 / 412) so the page has one consistent backbone. */}
      <section className="grid-hero items-start pb-4">
        <ChatDemo />
        <HeatBoard initial={heat} />
      </section>

      <MarqueeRows initial={snapshot} />
      <FeatureCards />
      <CapitalFlow />
      <SiteFooter />
    </>
  );
}
