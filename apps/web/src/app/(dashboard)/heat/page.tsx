import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { HeatListPage } from '@robinchan/shared';

import { HeatBoardFull } from '@/components/heat/HeatBoardFull';
import { PageHeader } from '@/components/ui';
import { getEnvelope, ssr } from '@/lib/api';
import { pageFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Heat',
  description: 'Which tokenized stocks and Robinhood Chain tokens have the most going on, and why.',
};

export const revalidate = 60;

/**
 * Heat (plan §4, H1): the full ranking behind Home's five-row heat board.
 * Behind `FEATURE_HEAT_PAGE` — off, the route doesn't exist.
 */
export default async function HeatPage() {
  const flags = pageFlags();
  if (!flags.heat) notFound();

  const initial = await getEnvelope<HeatListPage | null>(
    '/api/heat/full?filter=all&sort=score&page=1',
    null,
    ssr(60),
  );

  return (
    <>
      <PageHeader
        eyebrow="Heat"
        title="Where the activity is"
        lead="A ranking of how much is happening around each symbol: on-chain volume, holders, and liquidity, plus the last 24 hours of news. It measures attention, not direction."
      />
      <HeatBoardFull initial={initial} tradeEnabled={flags.trade} />
    </>
  );
}
