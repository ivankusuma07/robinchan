import { notFound, redirect } from 'next/navigation';
import { TRADABLE_SYMBOLS } from '@robinchan/shared';

import { pageFlags } from '@/lib/flags';

/** `/trade` has no page of its own — it opens the first tradable symbol. */
export default function TradeIndex() {
  if (!pageFlags().trade) notFound();
  redirect(`/trade/${TRADABLE_SYMBOLS[0] ?? 'AAPL'}`);
}
