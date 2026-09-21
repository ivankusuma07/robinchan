/**
 * Data shapes shared by web, api, and worker.
 * All times are ISO 8601 UTC.
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
  /** 24 sparkline points, oldest to newest */
  spark: number[];
};

/* ---------- news ---------- */

export const NEWS_CATEGORIES = ['SEC', 'NEWS', 'CHAIN', 'SOCIAL'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export type NewsItem = {
  id: string;
  cat: NewsCategory;
  title: string;
  /** short version for the tape */
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
  /** Empty when an active stream can't be confirmed — frontend falls back to a poster. */
  videoId: string;
  live: boolean;
  /** Target of the 'Open on YouTube' button when the iframe can't load. */
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

/* ---------- calendar ---------- */

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
  /** null when the user doesn't meet the tier — score rounded to the nearest 10 */
  components: HeatComponents | null;
  rounded: boolean;
  computedAt: string;
};

/* ---------- provider status ---------- */

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

/* ---------- order (shape locked now, flow ships in M4) ---------- */

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
