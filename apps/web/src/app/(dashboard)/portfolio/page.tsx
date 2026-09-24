import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WalletGate } from '@/components/gates';
import { PortfolioLayout } from '@/components/portfolio/PortfolioLayout';
import { SAMPLE_HISTORY, SAMPLE_ORDERS, SAMPLE_VIEW } from '@/components/portfolio/sample';
import { PageHeader } from '@/components/ui';
import { pageFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'Portfolio',
  description: 'Your tokenized stock holdings, with PnL only where the purchase price is known.',
};

/**
 * Portfolio (plan §7, P1). Behind `FEATURE_PORTFOLIO_PAGE`.
 *
 * Everything here belongs to a wallet, and wallet sign-in (SIWE) ships in
 * M3 — so until then the page is its real layout, blurred, behind the
 * wallet gate. When M3 lands, the gate's `children` becomes the same
 * `<PortfolioLayout>` fed from `GET /api/portfolio`.
 */
export default function PortfolioPage() {
  if (!pageFlags().portfolio) notFound();

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="What's in your wallet"
        lead="Holdings read straight from the chain. Profit and loss is only shown where Robinchan knows what you paid, from orders placed here or a price you enter yourself."
      />
      <WalletGate
        title="Connect a wallet to see your portfolio"
        body="Balances are read from the chain, never custodied. Nothing is shown until you connect."
        sample={
          <PortfolioLayout view={SAMPLE_VIEW} history={SAMPLE_HISTORY} orders={SAMPLE_ORDERS} />
        }
      />
    </>
  );
}
