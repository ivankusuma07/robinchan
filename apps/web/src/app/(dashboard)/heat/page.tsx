import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { HeatListPage } from '@robinchan/shared';

import { HeatBoardFull } from '@/components/heat/HeatBoardFull';
import { PageHeader } from '@/components/ui';
import { getEnvelope } from '@/lib/api';
import { pageFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Heat',
  description: 'Which tokenized stocks and Robinhood Chain tokens have the most going on, and why.',
};

/**
 * `force-dynamic`, not ISR: the initial board is wallet-gated (locked rows
 * vs full detail), which means this page's rendered HTML depends on who's
 * asking — a static/ISR-cached copy would either leak one wallet's unlocked
 * view to the next visitor or never unlock at all. `getEnvelope` below
 * forwards the incoming request's own cookies so the very first paint
 * already reflects a signed-in caller, not just later client-side refreshes.
 */
export const dynamic = 'force-dynamic';

/**
 * Heat (plan §4, H1): the full ranking behind Home's five-row heat board.
 * Behind `FEATURE_HEAT_PAGE` — off, the route doesn't exist.
 */
export default async function HeatPage() {
  const flags = pageFlags();
  if (!flags.heat) notFound();

  const cookieStore = await cookies();
  const initial = await getEnvelope<HeatListPage | null>(
    '/api/heat/full?filter=all&sort=score&page=1',
    null,
    { headers: { cookie: cookieStore.toString() } },
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
