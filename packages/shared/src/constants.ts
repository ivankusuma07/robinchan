import type { SourceStatus, TierId } from './types.js';

/** Ambang pemetaan sentimen ke tiga warna titik (brief §9). */
export const SENTIMENT_POS = 0.15;
export const SENTIMENT_NEG = -0.15;

/** Simbol yang dipantau di fase 1. */
export const WATCHED_SYMBOLS = [
  'AAPL',
  'NVDA',
  'TSLA',
  'MSFT',
  'AMZN',
  'META',
  'GOOGL',
  'COIN',
] as const;

export const SYMBOL_NAMES: Record<string, string> = {
  AAPL: 'Apple Inc.',
  NVDA: 'NVIDIA Corp.',
  TSLA: 'Tesla Inc.',
  MSFT: 'Microsoft Corp.',
  AMZN: 'Amazon.com Inc.',
  META: 'Meta Platforms',
  GOOGL: 'Alphabet Inc.',
  COIN: 'Coinbase Global',
  RCHAN: 'Robinchan',
};

export const INDEX_SYMBOLS = ['SPX', 'NDX', 'DJI', 'VIX', 'RCHAN'] as const;

export const INDEX_NAMES: Record<string, string> = {
  SPX: 'S&P 500',
  NDX: 'Nasdaq 100',
  DJI: 'Dow Jones',
  VIX: 'Volatility',
  RCHAN: '$RCHAN / USD',
};

/** Delapan slot di kartu "Sumber yang dipantau" (brief §6). */
export const SOURCE_SLOTS: Array<Pick<SourceStatus, 'id' | 'label'>> = [
  { id: 'finnhub-quote', label: 'Finnhub — harga' },
  { id: 'finnhub-news', label: 'Finnhub — berita' },
  { id: 'finnhub-calendar', label: 'Finnhub — kalender' },
  { id: 'sec-edgar', label: 'SEC EDGAR' },
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'youtube', label: 'YouTube embed' },
  { id: 'alphavantage', label: 'Alpha Vantage' },
  { id: 'stocktwits', label: 'StockTwits' },
];

export const TIER_LABELS: Record<TierId, string> = {
  free: 'Free',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
};

/** Interval polling frontend, milidetik (brief §6). */
export const POLL_MS = {
  indices: 15_000,
  news: 30_000,
  clips: 300_000,
  calendar: 3_600_000,
  sources: 60_000,
  snapshot: 15_000,
  heat: 60_000,
} as const;
