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
  | 'WALLET_REQUIRED'
  | 'TIER_REQUIRED'
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

/* ---------- heat page (trade-heat-portfolio plan §4) ---------- */

/**
 * Who is asking, as resolved by the server — never claimed by the client
 * (G6: three levels). Until M3 lands SIWE, every request is `public`.
 */
export type HeatLevel = 'public' | 'wallet' | 'full';

export type SymbolKind = 'tokenized' | 'rh_token';

export const HEAT_FILTERS = ['all', 'tokenized', 'rh_token', 'watchlist'] as const;
export type HeatFilter = (typeof HEAT_FILTERS)[number];

export const HEAT_SORTS = ['score', 'change', 'volume'] as const;
export type HeatSort = (typeof HEAT_SORTS)[number];

export type HeatComponentKey = keyof HeatComponents;

/** One component of the score, with the plain-language note behind it. */
export type HeatComponentDetail = {
  /** 0..1, or null when the component isn't live yet (G5). */
  score: number | null;
  note: string;
  reason?: 'not_active';
};

export type HeatBreakdown = Record<HeatComponentKey, HeatComponentDetail>;

/** A visible row on `/heat`. */
export type HeatListRow = {
  locked: false;
  rank: number;
  symbol: string;
  name: string;
  kind: SymbolKind;
  score: number;
  /** True at the public level: the score is rounded to the nearest 10. */
  rounded: boolean;
  /** Mini bars; null when the level doesn't include the breakdown. */
  components: HeatComponents | null;
  price: number | null;
  changePct: number | null;
  /** 7-day closing prices, oldest to newest; empty when candles are missing. */
  spark: number[];
  /** Whether `GET /api/heat/:symbol` will answer for this caller. */
  expandable: boolean;
};

/**
 * A row the caller isn't entitled to. Carries no symbol and no score, so
 * nothing about it can be read from the network tab.
 */
export type HeatLockedRow = {
  locked: true;
  rank: number;
  requiredLevel: Exclude<HeatLevel, 'public'>;
};

export type HeatListPage = {
  level: HeatLevel;
  rows: Array<HeatListRow | HeatLockedRow>;
  page: number;
  pageCount: number;
  total: number;
  /** Last heat recompute, null before the worker's first run. */
  computedAt: string | null;
};

export type HeatDriver = {
  id: string;
  title: string;
  publishedAt: string;
  url: string;
  source: string;
};

export type HeatDetail = {
  symbol: string;
  name: string;
  score: number;
  breakdown: HeatBreakdown;
  drivers: HeatDriver[];
  /** Robinchan's read — ships in H2; null until then, and the section hides. */
  read: string | null;
  computedAt: string;
};

/* ---------- candles (G3) ---------- */

export const CANDLE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export type Candle = {
  /** Bucket open time, unix seconds (UTC). */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

/* ---------- orders (G1/G2) ---------- */

export const ORDER_STATUSES = [
  'parsed',
  'quoted',
  'signed',
  'pending',
  'confirmed',
  'open',
  'cancelled',
  'failed',
  'expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderRecord = {
  id: string;
  side: OrderSide;
  symbol: string;
  qty: number;
  limitPrice: number | null;
  status: OrderStatus;
  txHash: string | null;
  /** G1: filled from the tx receipt once the server confirms the tx. */
  fillPrice: number | null;
  filledQty: number | null;
  feeUsd: number | null;
  filledAt: string | null;
  createdAt: string;
};

/* ---------- portfolio (plan §7) — shape locked now, API ships with M3 ---------- */

export type PortfolioHolding = {
  symbol: string;
  name: string;
  qty: number;
  price: number | null;
  value: number | null;
  changePct24h: number | null;
  /** From `computeHoldingBasis` — `none` means no purchase price is known. */
  basis: 'full' | 'partial' | 'none';
  avgPrice: number | null;
  /** On known units only; null when basis is `none`. */
  pnl: number | null;
  pnlPct: number | null;
};

export type PortfolioView = {
  totalValue: number;
  change24h: number | null;
  change24hPct: number | null;
  /** Sum over holdings with a known basis; null when none have one. */
  totalPnl: number | null;
  /** Holdings left out of `totalPnl` — "Excludes N assets without a purchase price". */
  excludedCount: number;
  /** Sorted by value, descending; everything under PORTFOLIO_DUST_USD moves to `other`. */
  holdings: PortfolioHolding[];
  other: { value: number; holdings: PortfolioHolding[] } | null;
  /** Tokens Robinchan can't price (open Q6), listed separately and never valued. */
  unsupported: Array<{ address: string; label: string; qty: number }>;
  /** Robinchan's description of the portfolio — describes, never advises. */
  read: string | null;
};

export const PORTFOLIO_RANGES = ['24h', '7d', '30d', 'all'] as const;
export type PortfolioRange = (typeof PORTFOLIO_RANGES)[number];

export type PortfolioPoint = { t: string; value: number };

/* ---------- order parsing (brief §12 step 1) ---------- */

export type ParseField = 'side' | 'symbol' | 'qty' | 'orderType' | 'limitPrice';

/**
 * Why a sentence needs a question back instead of an order. Each one is
 * something Robinchan can phrase a specific follow-up for.
 */
export type ParseReason =
  /** The model left a field empty — it wasn't stated. */
  | 'not_stated'
  /** "$500 of AAPL": a money amount, not a share count. Converting would guess the fill price. */
  | 'notional_amount'
  /** "half my position", "all of it": depends on a balance the parser can't see. */
  | 'relative_amount'
  /** "some", "a few". */
  | 'vague_amount'
  /** A value the model returned that doesn't appear in what the user typed. */
  | 'not_in_text'
  /** The model's buy/sell contradicts a buy/sell word in the sentence. */
  | 'side_conflict'
  /** A price in the sentence that the model didn't account for (e.g. "at 180" read as market). */
  | 'unused_price'
  /** "1,500" — thousands in English, one and a half in Indonesian. */
  | 'ambiguous_number'
  | 'unsupported_symbol'
  | 'qty_too_large'
  /** "buy AAPL and sell TSLA" — one order per confirmation. */
  | 'multiple_orders';

export type OrderParseResult =
  | { status: 'complete'; intent: OrderIntent }
  | {
      status: 'incomplete';
      missing: ParseField[];
      reasons: ParseReason[];
      /** Each missing field's own reason, for phrasing one clarifying question at a time. */
      fieldReasons: Partial<Record<ParseField, ParseReason>>;
      /** What *was* understood, so the follow-up only asks for the rest. */
      partial: Partial<OrderIntent>;
    }
  /** Not an order at all ("why is NVDA up?") — chat answers it as a question. */
  | { status: 'not_an_order' };

/* ---------- chat (brief §5, §9, §15) ---------- */

/** The pages that can open the floating chat and tell it what it's looking at (plan §3). */
export const CHAT_PAGES = ['home', 'robinchan', 'market', 'heat', 'portfolio', 'trade'] as const;
export type ChatPage = (typeof CHAT_PAGES)[number];

/**
 * What page sent the message, and about what — injected into the prompt as
 * delimited data (brief §15: never as instructions). Every field is
 * optional besides `page`; a route fills in only what it actually has.
 */
export type ChatPageContext = {
  page: ChatPage;
  /** The symbol the current page is centred on — `/trade/:symbol`. */
  symbol?: string;
  /** The heat row the user had open when they asked — `/heat`. */
  rowSymbol?: string;
  /** A short, server-written summary of the wallet's holdings — `/portfolio`. */
  portfolioSummary?: string;
};

/** One turn as the client renders it — `system` rows are never sent to the browser. */
export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};
