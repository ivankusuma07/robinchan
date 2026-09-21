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
  description: 'Index, berita, filing, dan siaran langsung untuk saham tokenized.',
};

export const revalidate = 15;

/**
 * Market (brief §6): halaman paling padat data. Semua slot berita di artboard
 * sengaja kosong — isinya datang dari API, dengan interval polling per blok.
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
        title="Apa yang bergerak sekarang"
        lead="Harga index, filing SEC, berita, dan siaran langsung dalam satu layar. Angka yang tidak sempat disegarkan tetap ditampilkan dan ditandai stale, bukan disembunyikan."
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
