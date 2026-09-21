import type { CalendarEvent, NewsItem } from '@robinchan/shared';

import { callProvider, fetchJson } from './adapter.js';
import { scoreSentiment } from '../lib/sentiment.js';

const BASE = 'https://finnhub.io/api/v1';

function key(): string | undefined {
  return process.env.FINNHUB_API_KEY || undefined;
}

export type RawQuote = {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
};

type FinnhubQuote = {
  c: number;
  d: number | null;
  dp: number | null;
  pc: number;
};

export async function fetchQuotes(symbols: readonly string[]): Promise<RawQuote[]> {
  const token = key();
  return callProvider({ id: 'finnhub-quote', configured: Boolean(token) }, async () => {
    const out: RawQuote[] = [];
    for (const symbol of symbols) {
      const q = await fetchJson<FinnhubQuote>(
        `${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${token}`,
      );
      if (!q.c) continue;
      out.push({
        symbol,
        price: q.c,
        change: q.d ?? q.c - q.pc,
        changePct: q.dp ?? ((q.c - q.pc) / q.pc) * 100,
      });
    }
    if (out.length === 0) throw new Error('no quotes populated');
    return out;
  });
}

type FinnhubNews = {
  id: number;
  category: string;
  datetime: number;
  headline: string;
  summary: string;
  related: string;
  source: string;
  url: string;
};

export async function fetchNews(limit: number): Promise<NewsItem[]> {
  const token = key();
  return callProvider({ id: 'finnhub-news', configured: Boolean(token) }, async () => {
    const raw = await fetchJson<FinnhubNews[]>(`${BASE}/news?category=general&token=${token}`);
    return raw.slice(0, limit).map((n) => ({
      id: `fh_${n.id}`,
      cat: 'NEWS' as const,
      title: n.headline,
      short: shorten(n.headline),
      symbols: n.related
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 3),
      sentiment: scoreSentiment(`${n.headline} ${n.summary}`),
      url: n.url,
      source: n.source || 'Finnhub',
      publishedAt: new Date(n.datetime * 1000).toISOString(),
    }));
  });
}

type FinnhubEarnings = {
  earningsCalendar: Array<{
    date: string;
    symbol: string;
    hour: string;
    epsEstimate: number | null;
    quarter: number;
    year: number;
  }>;
};

export async function fetchEarnings(days: number): Promise<CalendarEvent[]> {
  const token = key();
  return callProvider({ id: 'finnhub-calendar', configured: Boolean(token) }, async () => {
    const from = new Date().toISOString().slice(0, 10);
    const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    const raw = await fetchJson<FinnhubEarnings>(
      `${BASE}/calendar/earnings?from=${from}&to=${to}&token=${token}`,
    );
    return raw.earningsCalendar.slice(0, 40).map((e) => ({
      id: `fh_earn_${e.symbol}_${e.date}`,
      date: e.date,
      title: `${e.symbol} — Q${e.quarter} ${e.year} report`,
      subtitle:
        e.epsEstimate != null
          ? `EPS estimate ${e.epsEstimate.toFixed(2)} · ${hourLabel(e.hour)}`
          : hourLabel(e.hour),
      kind: 'earnings' as const,
      symbol: e.symbol,
    }));
  });
}

function hourLabel(hour: string): string {
  if (hour === 'bmo') return 'before market open';
  if (hour === 'amc') return 'after market close';
  return 'time not confirmed';
}

/** The tape uses the short version, not the full title (brief §6). */
export function shorten(title: string, max = 58): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 30 ? lastSpace : max)}…`;
}
