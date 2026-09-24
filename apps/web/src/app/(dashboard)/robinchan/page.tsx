import type { Metadata } from 'next';
import type { ApiEnvelope, Ticker } from '@robinchan/shared';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { TierCards } from '@/components/chat/TierCards';
import { MarketSnapshot } from '@/components/home/MarketSnapshot';
import { ExpressionBusProvider } from '@/components/live2d/ExpressionBus';
import { Live2DStage } from '@/components/live2d/Live2DStage';
import { getEnvelope, ssr } from '@/lib/api';
import { pageFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Robinchan',
  description: 'A Live2D companion that reads the market and helps build orders.',
};

/** `force-dynamic`, not ISR — see the same note in `(dashboard)/market/page.tsx`. */
export const dynamic = 'force-dynamic';

/**
 * Character page (brief §5), laid out as a stage: the Live2D frame fills
 * the whole content area (the shell runs this route full-width) with the
 * character full-body in the middle, and on wide screens (xl) everything
 * else floats over it — the conversation as a glass card on the left, the
 * market prices as a glass card on the right, and the composer docked
 * bottom-centre under her feet. Below xl the frame keeps its full width and
 * the cards stack under it in reading order. The tier cards sit below.
 *
 * The market card is the Home hero's `<MarketSnapshot>` — same data, same
 * polling, same empty state — so the two can't drift apart.
 */
export default async function RobinchanPage() {
  const snapshot = await getEnvelope<Ticker[]>('/api/market/snapshot', [], ssr(15));

  return (
    <>
      {/* The topbar already names the page; the stage goes straight to the
          top, so the heading is for assistive tech only. */}
      <h1 className="sr-only">Robinchan</h1>

      <Stage snapshot={snapshot} voiceEnabled={pageFlags().voice} />

      {/* The shell runs this page full-width for the stage; the tiers go
          back into the standard 1112px column below it. */}
      <div className="mx-auto w-full max-w-[1112px] px-1 pt-14 lg:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-eyebrow mb-2.5">Tiers</p>
            <h2 className="t-h3">What unlocks as your $RCHAN balance grows</h2>
          </div>
          <p className="max-w-[420px] text-[12px] leading-relaxed text-text-3">
            Each tier&apos;s threshold is read from your on-chain balance, not a claim made in the
            browser. The threshold values aren&apos;t final yet and are stored as configuration.
          </p>
        </div>

        <TierCards />
      </div>
    </>
  );
}

function Stage({
  snapshot,
  voiceEnabled,
}: {
  snapshot: ApiEnvelope<Ticker[]>;
  voiceEnabled: boolean;
}) {
  return (
    /* On xl this box *is* the stage's size and every child is positioned
       inside it; below xl it's a plain column. DOM order is the stacked
       reading order: stage, conversation, composer, market. Its height
       fills the viewport under the 76px topbar, less the shell's 16px
       gutter above and below. */
    <div className="relative xl:h-[calc(100svh-108px)] xl:min-h-[680px]">
      <ExpressionBusProvider>
        <Live2DStage
          className="h-[calc(100svh-108px)] min-h-[560px] xl:absolute xl:inset-0 xl:h-auto xl:min-h-0"
          voiceEnabled={voiceEnabled}
        />

        <ChatPanel
          logClassName="mt-4 h-[420px] xl:absolute xl:bottom-[92px] xl:left-4 xl:top-[84px] xl:mt-0 xl:h-auto xl:w-[300px] 2xl:w-[360px]"
          composerClassName="mt-4 xl:absolute xl:bottom-4 xl:left-1/2 xl:mt-0 xl:w-[440px] xl:-translate-x-1/2"
        />
      </ExpressionBusProvider>

      <div className="mt-4 xl:absolute xl:right-4 xl:top-[84px] xl:mt-0 xl:w-[300px] 2xl:w-[360px]">
        <MarketSnapshot initial={snapshot} />
      </div>
    </div>
  );
}
