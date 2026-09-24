import type { SourceStatus, SymbolKind, TierId } from './types.js';

/** Thresholds mapping sentiment to three dot colors (brief §9). */
export const SENTIMENT_POS = 0.15;
export const SENTIMENT_NEG = -0.15;

/** Symbols watched in phase 1. */
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

/**
 * Symbols the heat board ranks: the watched tokenized stocks plus $RCHAN,
 * Robinhood Chain's own token — without it the page's `rh_token` filter
 * would always be empty.
 */
export const HEAT_SYMBOLS = [...WATCHED_SYMBOLS, 'RCHAN'] as const;

export const SYMBOL_KIND: Record<string, SymbolKind> = {
  RCHAN: 'rh_token',
};

export function symbolKind(symbol: string): SymbolKind {
  return SYMBOL_KIND[symbol] ?? 'tokenized';
}

/** Symbols the Trade page accepts — anything the price worker quotes. */
export const TRADABLE_SYMBOLS: readonly string[] = WATCHED_SYMBOLS;

/** Rows per page on `/heat` (plan §4). */
export const HEAT_PAGE_SIZE = 25;

/** Rows visible without a wallet (plan §4) and with one (plan §6). */
export const HEAT_VISIBLE_ROWS = { public: 5, wallet: 15 } as const;

export const INDEX_SYMBOLS = ['SPX', 'NDX', 'DJI', 'VIX', 'RCHAN'] as const;

export const INDEX_NAMES: Record<string, string> = {
  SPX: 'S&P 500',
  NDX: 'Nasdaq 100',
  DJI: 'Dow Jones',
  VIX: 'Volatility',
  RCHAN: '$RCHAN / USD',
};

/** Slots in the "Sources monitored" card: the eight from brief §6, plus the LLM and VOICEVOX. */
export const SOURCE_SLOTS: Array<Pick<SourceStatus, 'id' | 'label'>> = [
  { id: 'finnhub-quote', label: 'Finnhub — prices' },
  { id: 'finnhub-news', label: 'Finnhub — news' },
  { id: 'finnhub-calendar', label: 'Finnhub — calendar' },
  { id: 'sec-edgar', label: 'SEC EDGAR' },
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'youtube', label: 'YouTube embed' },
  { id: 'alphavantage', label: 'Alpha Vantage' },
  { id: 'stocktwits', label: 'StockTwits' },
  // The LLM adapter's circuit breaker reports here too (brief §11). Labelled
  // by job, not vendor — the provider is configuration (LLM_PROVIDER).
  { id: 'llm', label: 'LLM — order parsing & chat' },
  { id: 'voicevox', label: 'VOICEVOX — voice' },
];

export const TIER_LABELS: Record<TierId, string> = {
  free: 'Free',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
};

/** What each tier unlocks (brief §14), cumulative — each tier includes the ones below it. */
export const TIER_UNLOCKS: Record<TierId, string[]> = {
  free: ['chat', 'market_read', 'heat_rounded', 'market_order'],
  tier1: ['heat_full', 'watchlist', 'voice'],
  tier2: ['long_memory', 'alerts'],
  tier3: ['custom_personality', 'limit_order'],
};

/** Frontend polling intervals, milliseconds (brief §6). */
export const POLL_MS = {
  indices: 15_000,
  news: 30_000,
  clips: 300_000,
  calendar: 3_600_000,
  sources: 60_000,
  snapshot: 15_000,
  heat: 60_000,
  candles: 60_000,
} as const;
