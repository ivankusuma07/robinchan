import { cacheKey, getCache } from '@robinchan/store';

import { fixtureClips, fixturesEnabled } from '../providers/fixtures.js';
import { fetchChannels, fetchClips } from '../providers/youtube.js';
import { log } from '../lib/log.js';

export const CHANNELS_TTL_SEC = 900;
export const CLIPS_TTL_SEC = 600;

/** Status channel video diperiksa tiap 10 menit (brief §8). */
export async function runChannels(): Promise<void> {
  const channels = await fetchChannels();
  await getCache().set(cacheKey('media', 'channels'), channels, CHANNELS_TTL_SEC);
  const live = channels.filter((c) => c.live).length;
  log.info('media', `${channels.length} channel, ${live} sedang live`);
}

export async function runClips(): Promise<void> {
  try {
    const clips = await fetchClips();
    await getCache().set(cacheKey('media', 'clips'), clips, CLIPS_TTL_SEC);
    log.info('media', `${clips.length} klip diperbarui`);
  } catch (err) {
    if (!fixturesEnabled()) throw err;
    await getCache().set(cacheKey('media', 'clips'), fixtureClips(), CLIPS_TTL_SEC);
    log.debug('media', 'klip pakai fixture');
  }
}
