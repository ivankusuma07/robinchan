import type { Metadata } from 'next';
import type {
  CalendarEvent,
  MarketIndex,
  MediaChannel,
  MediaClip,
  NewsItem,
  SourceStatus,
} from '@robinchan/shared';

import { IndexStrip } from '@/components/market/IndexStrip';
import { LiveVideo } from '@/components/market/LiveVideo';
import { NewsFeed } from '@/components/market/NewsFeed';
import { Catalysts, Highlights, SourcePanel } from '@/components/market/Rail';
import { Tape } from '@/components/market/Tape';
import { PageHeader } from '@/components/ui';
import { getEnvelope, ssr } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Market',
  description: 'Index, news, filings, and live broadcasts for tokenized stocks.',
};

/**
 * `force-dynamic` rather than ISR: this page embeds live, fast-moving
 * numbers (prices, indices) directly into the initial HTML/RSC payload.
 * Under ISR, Vercel's edge can serve a stale static copy while a background
 * regeneration is in flight — reproducibly (confirmed by hammering the live
 * deployment with headless Chrome) causing a React hydration text mismatch
 * (error #418) when the served shell and what the client recomputes on
 * mount land a beat apart. The underlying `fetch()` calls still cache via
 * `ssr(...)`'s `next.revalidate`, so this doesn't add load on the API — it
 * only removes the page-level CDN caching that raced.
 */
export const dynamic = 'force-dynamic';

/**
 * Market (brief §6): the most data-dense page. Every news slot in the
 * artboard is deliberately empty — it's filled from the API, each block at
 * its own polling interval.
 */
export default async function MarketPage() {
  const [indices, news, pinned, channels, clips, calendar, sources] = await Promise.all([
    getEnvelope<MarketIndex[]>('/api/market/indices', [], ssr(15)),
    getEnvelope<NewsItem[]>('/api/news?limit=20', [], ssr(30)),
    getEnvelope<NewsItem[]>('/api/news?limit=12&pinned=true', [], ssr(30)),
    getEnvelope<MediaChannel[]>('/api/media/channels', [], ssr(600)),
    getEnvelope<MediaClip[]>('/api/media/clips', [], ssr(300)),
    getEnvelope<CalendarEvent[]>('/api/calendar?limit=5', [], ssr(3600)),
    getEnvelope<SourceStatus[]>('/api/sources/status', [], ssr(60)),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Market"
        title="What's moving right now"
        lead="Index prices, SEC filings, news, and live broadcasts on one screen. Numbers that haven't refreshed in time still render, marked stale, never hidden."
      />

      <div className="space-y-4">
        <IndexStrip initial={indices} />
        <Tape initial={pinned} />

        <div className="grid-market">
          <div className="min-w-0 space-y-4">
            <LiveVideo initial={channels} />
            <NewsFeed initial={news} />
          </div>

          <aside className="space-y-4">
            <Highlights initial={clips} />
            <Catalysts initial={calendar} />
            <SourcePanel initial={sources} />
          </aside>
        </div>
      </div>
    </>
  );
}
