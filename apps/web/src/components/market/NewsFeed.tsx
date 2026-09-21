'use client';

import { useState } from 'react';
import type { ApiEnvelope, NewsCategory, NewsItem } from '@robinchan/shared';
import { NEWS_CATEGORIES, POLL_MS, formatClock } from '@robinchan/shared';

import { NewsCard } from '@/components/NewsCard';
import { CardHead, StaleBadge, cx } from '@/components/ui';
import { isUnset } from '@/lib/api';
import { useNow, usePoll } from '@/lib/usePoll';

type Filter = 'ALL' | NewsCategory;

/** Feed berita (brief §6): polling 30 detik, waktu relatif dihitung di client. */
export function NewsFeed({ initial }: { initial: ApiEnvelope<NewsItem[]> }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const envelope = usePoll<NewsItem[]>('/api/news?limit=20', initial, POLL_MS.news);
  const now = useNow(30_000);

  const items =
    filter === 'ALL' ? envelope.data : envelope.data.filter((item) => item.cat === filter);
  const stale = envelope.stale && !isUnset(envelope);
  /** Beda dari "tersaring habis": feed-nya memang belum pernah terisi. */
  const feedEmpty = envelope.data.length === 0;

  return (
    <section className="card flex flex-col">
      <CardHead
        title="Feed berita"
        aside={
          <>
            {stale ? <StaleBadge /> : null}
            <span className="font-mono text-[11px] text-text-3">
              {isUnset(envelope) ? '--:--:--' : formatClock(envelope.asOf)}
            </span>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-border-soft px-5 py-3">
        {(['ALL', ...NEWS_CATEGORIES] as Filter[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            aria-pressed={filter === cat}
            className={cx(
              'rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors',
              filter === cat
                ? 'border-accent/45 bg-accent/[0.07] text-text'
                : 'border-border text-text-3 hover:border-text-3 hover:text-text-2',
            )}
          >
            {cat === 'ALL' ? 'semua' : cat}
          </button>
        ))}
      </div>

      <div className={cx('divide-y divide-border-soft', stale && 'is-stale')}>
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-text-3">
            {feedEmpty
              ? 'Feed belum terisi — worker belum sempat menarik berita.'
              : 'Tidak ada berita di kategori ini.'}
          </p>
        ) : (
          items.map((item) => <NewsCard key={item.id} item={item} now={now} />)
        )}
      </div>
    </section>
  );
}
