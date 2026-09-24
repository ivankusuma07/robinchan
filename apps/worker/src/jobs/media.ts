import { cacheKey, getCache } from '@robinchan/store';

import { fixtureClips, fixturesEnabled } from '../providers/fixtures.js';
import { fetchChannels, fetchClips } from '../providers/youtube.js';
import { log } from '../lib/log.js';

export const CHANNELS_TTL_SEC = 900;
export const CLIPS_TTL_SEC = 600;

/**
 * The channel list is static now (`fetchChannels()`'s doc comment) — this
 * job still runs on the same 10-minute schedule mostly to keep the cache
 * key populated for a fresh worker/cache, not because the list can change
 * on its own.
 */
export async function runChannels(): Promise<void> {
  const channels = await fetchChannels();
  await getCache().set(cacheKey('media', 'channels'), channels, CHANNELS_TTL_SEC);
  log.info('media', `${channels.length} channels`);
}

export async function runClips(): Promise<void> {
  try {
    const clips = await fetchClips();
    await getCache().set(cacheKey('media', 'clips'), clips, CLIPS_TTL_SEC);
    log.info('media', `${clips.length} clips updated`);
  } catch (err) {
    if (!fixturesEnabled()) throw err;
    await getCache().set(cacheKey('media', 'clips'), fixtureClips(), CLIPS_TTL_SEC);
    log.debug('media', 'clips using fixture');
  }
}
