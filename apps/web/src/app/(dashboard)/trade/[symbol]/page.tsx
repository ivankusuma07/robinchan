import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { Ticker } from '@robinchan/shared';
import { SYMBOL_NAMES, TRADABLE_SYMBOLS } from '@robinchan/shared';

import { TradeView } from '@/components/trade/TradeView';
import { getEnvelope, ssr } from '@/lib/api';
import { pageFlags } from '@/lib/flags';

type Params = { symbol: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  return {
    title: `Trade ${symbol}`,
    description: `Build an order for ${SYMBOL_NAMES[symbol] ?? symbol} and sign it from your own wallet.`,
  };
}

/**
 * Trade (plan §8). Behind `FEATURE_TRADING`, which stays off in production
 * until the regulatory answers arrive (decision #12) — off, this route 404s.
 * Only symbols the price worker quotes are tradable; anything else 404s too.
 */
export default async function TradePage({ params }: { params: Promise<Params> }) {
  if (!pageFlags().trade) notFound();

  const symbol = (await params).symbol.toUpperCase();
  if (!TRADABLE_SYMBOLS.includes(symbol)) notFound();

  const initialQuote = await getEnvelope<Ticker | null>(
    `/api/market/quote/${encodeURIComponent(symbol)}`,
    null,
    ssr(15),
  );

  return <TradeView symbol={symbol} initialQuote={initialQuote} />;
}
