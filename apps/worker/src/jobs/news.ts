import type { NewsItem } from '@robinchan/shared';
import { WATCHED_SYMBOLS } from '@robinchan/shared';
import { cacheKey, getCache, getDb } from '@robinchan/store';

import { fetchFilings } from '../providers/edgar.js';
import { fetchNews } from '../providers/finnhub.js';
import { fixtureNews, fixturesEnabled } from '../providers/fixtures.js';
import { log } from '../lib/log.js';

export const NEWS_TTL_SEC = 120;
const FEED_SIZE = 40;

/**
 * Dua provider berita, digabung lalu diserahkan ke dedupe di lapisan Db.
 * Kegagalan satu provider tidak menjatuhkan yang lain — halaman Market harus
 * tetap tampil wajar saat satu sumber dimatikan (brief §17, M2).
 */
export async function runNews(): Promise<void> {
  const collected: NewsItem[] = [];

  const results = await Promise.allSettled([
    fetchNews(FEED_SIZE),
    fetchFilings(WATCHED_SYMBOLS, 12),
  ]);
  for (const result of results) {
    if (result.status === 'fulfilled') collected.push(...result.value);
    else log.debug('news', result.reason instanceof Error ? result.reason.message : 'gagal');
  }

  if (collected.length === 0 && fixturesEnabled()) {
    collected.push(...fixtureNews(12));
  }

  if (collected.length === 0) {
    log.warn('news', 'tidak ada item baru; cache lama dibiarkan');
    return;
  }

  // Tape hanya menampilkan headline yang ditandai pinned (brief §6).
  const pinnedCount = collected.filter((n) => n.pinned).length;
  if (pinnedCount === 0) {
    for (const item of pickForTape(collected)) item.pinned = true;
  }

  const db = getDb();
  const inserted = await db.upsertNews(collected);
  const feed = await db.listNews({ limit: FEED_SIZE });
  await getCache().set(cacheKey('news', 'latest'), feed, NEWS_TTL_SEC);

  log.info('news', `${collected.length} diambil, ${inserted} baru, feed ${feed.length}`);
}

/** Enam item terbaru dengan sentimen paling kuat — cukup untuk satu putaran tape. */
function pickForTape(items: NewsItem[]): NewsItem[] {
  return [...items]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 16)
    .sort((a, b) => Math.abs(b.sentiment) - Math.abs(a.sentiment))
    .slice(0, 6);
}
