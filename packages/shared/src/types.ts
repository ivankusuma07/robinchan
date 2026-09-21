/**
 * Bentuk data yang dipakai bersama oleh web, api, dan worker.
 * Semua waktu ISO 8601 UTC.
 */

export type ApiEnvelope<T> = {
  data: T;
  stale: boolean;
  asOf: string;
};

export type ApiErrorCode =
  | 'RATE_LIMITED'
  | 'PARSE_FAILED'
  | 'PARSE_INCOMPLETE'
  | 'QUOTE_EXPIRED'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'UPSTREAM_DOWN'
  | 'INTERNAL';

export type ApiError = {
  error: { code: ApiErrorCode; message: string };
};

/* ---------- market ---------- */

export type Ticker = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
};

export type MarketIndex = Ticker & {
  /** 24 titik sparkline, terlama ke terbaru */
  spark: number[];
};

/* ---------- berita ---------- */

export const NEWS_CATEGORIES = ['SEC', 'NEWS', 'CHAIN', 'SOCIAL'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export type NewsItem = {
  id: string;
  cat: NewsCategory;
  title: string;
  /** versi pendek untuk tape */
  short: string;
  symbols: string[];
  /** -1..1 */
  sentiment: number;
  url: string;
  source: string;
  publishedAt: string;
  pinned?: boolean;
};

/* ---------- media ---------- */

export type MediaChannel = {
  id: string;
  label: string;
  /** Kosong kalau stream aktif belum bisa dipastikan — frontend jatuh ke poster. */
  videoId: string;
  live: boolean;
  /** Tujuan tombol 'Buka di YouTube' saat iframe tidak bisa dimuat. */
  url: string;
};

export type MediaClip = {
  id: string;
  title: string;
  channel: string;
  videoId: string;
  durationSec: number;
  publishedAt: string;
  url: string;
};

/* ---------- kalender ---------- */

export type CalendarKind = 'earnings' | 'macro' | 'chain';

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  kind: CalendarKind;
  symbol: string | null;
};

/* ---------- heat ---------- */

export type HeatComponents = {
  onchain: number;
  news: number;
  social: number | null;
};

export type HeatScore = {
  symbol: string;
  name: string;
  score: number;
  /** null saat user belum memenuhi tier — skor dibulatkan ke kelipatan 10 */
  components: HeatComponents | null;
  rounded: boolean;
  computedAt: string;
};

/* ---------- status provider ---------- */

export type SourceState = 'ok' | 'idle' | 'down';

export type SourceStatus = {
  id: string;
  label: string;
  state: SourceState;
  lastOkAt: string | null;
  note: string;
};

/* ---------- tier ---------- */

export type TierId = 'free' | 'tier1' | 'tier2' | 'tier3';

export type TierState = {
  tier: TierId;
  balance: string;
  unlocked: string[];
};

/* ---------- order (bentuknya dikunci sekarang, alurnya M4) ---------- */

export type OrderSide = 'buy' | 'sell';

export type OrderIntent = {
  side: OrderSide;
  symbol: string;
  qty: number;
  orderType: 'market' | 'limit';
  limitPrice: number | null;
};

export type OrderQuote = {
  intent: OrderIntent;
  estPrice: number;
  estTotal: number;
  estGas: number;
  protocolFee: number;
  expiresAt: string;
  warnings: string[];
};
