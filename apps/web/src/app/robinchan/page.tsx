import type { Metadata } from 'next';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { TierCards } from '@/components/chat/TierCards';
import { Live2DStage } from '@/components/live2d/Live2DStage';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Robinchan',
  description: 'A Live2D companion that reads the market and helps build orders.',
};

/**
 * Character page (brief §5): 736px Live2D stage on the left, chat panel on
 * the right, three tier cards below.
 */
export default function RobinchanPage() {
  return (
    <>
      <PageHeader
        eyebrow="Character"
        title="Robinchan"
        lead="She reads the market, explains why something is moving, and builds orders from plain sentences. What she can't do: sign anything on your behalf."
      />

      <div className="grid-stage items-stretch pb-4">
        <Live2DStage />
        <ChatPanel />
      </div>

      <div className="pt-4">
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
