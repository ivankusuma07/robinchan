import type { MediaChannel, MediaClip } from '@robinchan/shared';

import { callProvider, fetchJson } from './adapter.js';

/**
 * Stream 24 jam kadang diganti pemiliknya, jadi `videoId` tidak boleh
 * di-hardcode di frontend (brief §6). Worker yang menyelesaikannya dari
 * channelId lewat YouTube Data API.
 *
 * Tanpa `YOUTUBE_API_KEY`, `videoId` sengaja dikosongkan supaya frontend jatuh
 * ke poster statis + tombol "Buka di YouTube" — jalur fallback yang memang
 * diwajibkan brief, bukan id palsu yang akan gagal dimuat diam-diam.
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

export async function fetchChannels(): Promise<MediaChannel[]> {
  const apiKey = process.env.YOUTUBE_API_KEY || undefined;

  const offline: MediaChannel[] = CHANNELS.map((c) => ({
    id: c.id,
    label: c.label,
    videoId: '',
    live: false,
    url: channelUrl(c.handle),
  }));

  try {
    return await callProvider({ id: 'youtube', configured: Boolean(apiKey) }, async () => {
      const resolved: MediaChannel[] = [];
      for (const c of CHANNELS) {
        const body = await fetchJson<SearchResponse>(
          `${SEARCH}?part=snippet&channelId=${c.channelId}&eventType=live&type=video&maxResults=1&key=${apiKey}`,
        );
        const videoId = body.items?.[0]?.id?.videoId ?? '';
        resolved.push({
          id: c.id,
          label: c.label,
          videoId,
          live: Boolean(videoId),
          url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : channelUrl(c.handle),
        });
      }
      return resolved;
    });
  } catch {
    // Daftar channel tetap dikembalikan; hanya id stream aktifnya yang hilang.
    return offline;
  }
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
          title: item.snippet?.title ?? 'Tanpa judul',
          channel: item.snippet?.channelTitle ?? c.label,
          videoId,
          // Durasi butuh panggilan videos.list terpisah; belum sepadan di fase 1.
          durationSec: 0,
          publishedAt: item.snippet?.publishedAt ?? new Date().toISOString(),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
    }
    if (out.length === 0) throw new Error('tidak ada klip terbaca');
    return out.slice(0, 4);
  });
}

export const CHANNEL_LIST = CHANNELS;
