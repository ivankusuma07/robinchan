import type { MediaChannel, MediaClip } from '@robinchan/shared';

import { callProvider, fetchJson } from './adapter.js';

/**
 * Channel list for the "Live broadcast" card (brief §6).
 *
 * This used to resolve each channel's currently-live `videoId` through the
 * YouTube Data API's `search.list` (100 quota units per call, against a
 * 10,000/day default quota — four channels, polled every 10 minutes, is
 * ~57,600 units/day on its own) and then embedded that specific video.
 * That's gone: `embed/live_stream?channel=<channelId>` is YouTube's own
 * documented iframe parameter for "whatever is live on this channel right
 * now" — no video id lookup needed, resolved on YouTube's end, no API key,
 * no quota. The frontend builds that URL directly from `channelId`
 * (`LiveVideo.tsx`).
 *
 * `fetchChannels()` is consequently a static list, not a provider call —
 * there's nothing left here that can fail or go stale. `fetchClips()`
 * below is a separate feature (recent uploads for "Highlights") and still
 * genuinely needs the Data API, since a title/thumbnail/publish-date list
 * isn't something YouTube's embed alone can give us.
 */
const CHANNELS: Array<{
  id: string;
  label: string;
  channelId: string;
  handle: string;
}> = [
  {
    id: 'bloomberg',
    label: 'Bloomberg TV',
    channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    handle: 'markets',
  },
  {
    id: 'yahoo-finance',
    label: 'Yahoo Finance',
    channelId: 'UCEAZeUIeJs0IjQiqTCdVSIg',
    handle: 'YahooFinance',
  },
  {
    id: 'reuters',
    label: 'Reuters',
    channelId: 'UChqUTb7kYRX8-EiaN3XFrSQ',
    handle: 'Reuters',
  },
  {
    id: 'coindesk',
    label: 'CoinDesk',
    channelId: 'UCTsAnDtd6pIqW-B32C5Gwyw',
    handle: 'CoinDesk',
  },
];

const SEARCH = 'https://www.googleapis.com/youtube/v3/search';

type SearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
  }>;
};

function channelUrl(handle: string): string {
  return `https://www.youtube.com/@${handle}/streams`;
}

/**
 * Static — see the module doc comment for why. Still a function (not a
 * constant export) so the worker's `runChannels` job has something to call
 * on schedule; that job is what writes it to the cache the API serves from,
 * unchanged from before.
 */
export async function fetchChannels(): Promise<MediaChannel[]> {
  return CHANNELS.map((c) => ({
    id: c.id,
    label: c.label,
    channelId: c.channelId,
    url: channelUrl(c.handle),
  }));
}

export async function fetchClips(): Promise<MediaClip[]> {
  const apiKey = process.env.YOUTUBE_API_KEY || undefined;
  return callProvider({ id: 'youtube', configured: Boolean(apiKey) }, async () => {
    const out: MediaClip[] = [];
    for (const c of CHANNELS.slice(0, 3)) {
      const body = await fetchJson<SearchResponse>(
        `${SEARCH}?part=snippet&channelId=${c.channelId}&order=date&type=video&maxResults=2&key=${apiKey}`,
      );
      for (const item of body.items ?? []) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;
        out.push({
          id: `yt_${videoId}`,
          title: item.snippet?.title ?? 'Untitled',
          channel: item.snippet?.channelTitle ?? c.label,
          videoId,
          // Duration needs a separate videos.list call; not worth it in phase 1.
          durationSec: 0,
          publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }
    if (out.length === 0) throw new Error('no clips read');
    return out.slice(0, 4);
  });
}

export const CHANNEL_LIST = CHANNELS;
