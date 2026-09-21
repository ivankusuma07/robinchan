import type { NewsItem } from '@robinchan/shared';

import { callProvider } from './adapter.js';
import { shorten } from './finnhub.js';

/**
 * SEC EDGAR full-text search. Gratis, tapi mewajibkan User-Agent berisi kontak
 * yang bisa dihubungi — tanpa itu permintaan ditolak, jadi adaptor ini
 * dianggap belum dikonfigurasi kalau `SEC_EDGAR_USER_AGENT` kosong.
 */
const ENDPOINT = 'https://efts.sec.gov/LATEST/search-index';

type EdgarHit = {
  _id: string;
  _source: {
    file_date: string;
    file_type: string;
    display_names?: string[];
    ciks?: string[];
  };
};

type EdgarResponse = { hits?: { hits?: EdgarHit[] } };

const FORMS = ['8-K', '10-Q', '10-K'];

export async function fetchFilings(symbols: readonly string[], limit: number): Promise<NewsItem[]> {
  const ua = process.env.SEC_EDGAR_USER_AGENT || undefined;
  return callProvider({ id: 'sec-edgar', configured: Boolean(ua) }, async () => {
    const out: NewsItem[] = [];
    for (const symbol of symbols.slice(0, 4)) {
      const url = `${ENDPOINT}?q=%22${encodeURIComponent(symbol)}%22&forms=${FORMS.join(',')}`;
      const res = await fetch(url, {
        headers: { 'user-agent': ua as string, accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as EdgarResponse;
      for (const hit of body.hits?.hits?.slice(0, 3) ?? []) {
        const company = hit._source.display_names?.[0] ?? symbol;
        const title = `${company} mengajukan ${hit._source.file_type}`;
        out.push({
          id: `sec_${hit._id}`,
          cat: 'SEC',
          title,
          short: shorten(title),
          symbols: [symbol],
          // Filing itu peristiwa, bukan opini — biarkan netral dan serahkan
          // penilaian ke pembaca.
          sentiment: 0,
          url: `https://www.sec.gov/Archives/edgar/data/${hit._source.ciks?.[0] ?? ''}`,
          source: 'SEC EDGAR',
          publishedAt: new Date(`${hit._source.file_date}T00:00:00Z`).toISOString(),
        });
      }
    }
    if (out.length === 0) throw new Error('tidak ada filing terbaca');
    return out.slice(0, limit);
  });
}
