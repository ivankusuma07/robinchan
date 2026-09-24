/**
 * Request schemas for the Heat / Portfolio / Trade routes (plan §3: Zod
 * schemas live in `packages/shared`).
 *
 * Exported from the `@robinchan/shared/schemas` subpath, not the package
 * root, so the web client bundle — which imports the root for types and
 * formatters — never pulls in Zod.
 */
import { z } from 'zod';

import { HEAT_SYMBOLS, TRADABLE_SYMBOLS } from './constants.js';
import { CANDLE_INTERVALS, CHAT_PAGES, HEAT_FILTERS, HEAT_SORTS, ORDER_STATUSES } from './types.js';

export const symbolParam = z.object({
  symbol: z
    .string()
    .min(1)
    .max(12)
    .regex(/^[A-Za-z0-9.\-]+$/, 'symbol may only contain letters, digits, dots, and dashes')
    .transform((s) => s.toUpperCase()),
});

export const heatFullQuery = z.object({
  filter: z.enum(HEAT_FILTERS).default('all'),
  sort: z.enum(HEAT_SORTS).default('score'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type HeatFullQuery = z.infer<typeof heatFullQuery>;

export const candleQuery = z
  .object({
    interval: z.enum(CANDLE_INTERVALS).default('1h'),
    /** Unix seconds, inclusive. */
    from: z.coerce.number().int().min(0).optional(),
    /** Unix seconds, inclusive. */
    to: z.coerce.number().int().min(0).optional(),
  })
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, {
    message: '`from` must not be after `to`',
  });
export type CandleQuery = z.infer<typeof candleQuery>;

/** Shared by Portfolio's history and Trade's tabs (G4: `/api/order`). */
export const orderListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type OrderListQuery = z.infer<typeof orderListQuery>;

/**
 * The order-parse tool's arguments, exactly as the model must return them
 * (plan §5: validate the tool output with Zod before using it). The `*Text`
 * fields are the model quoting the user's own words for each number, which
 * the server then checks against the sentence — see `apps/api/src/llm/grounding.ts`.
 */
export const orderToolOutput = z.object({
  kind: z.enum(['order', 'not_an_order', 'multiple_orders']),
  side: z.enum(['buy', 'sell']).nullable(),
  symbol: z.string().max(12).nullable(),
  symbolText: z.string().max(60).nullable(),
  qty: z.number().nullable(),
  qtyText: z.string().max(40).nullable(),
  amountIssue: z.enum(['notional', 'relative', 'vague']).nullable(),
  orderType: z.enum(['market', 'limit']).nullable(),
  limitPrice: z.number().nullable(),
  limitPriceText: z.string().max(40).nullable(),
});
export type OrderToolOutput = z.infer<typeof orderToolOutput>;

export const orderParseBody = z.object({
  text: z.string().trim().min(1).max(300),
});

/** `POST /api/order/quote` (brief line 354): the same intent shape `OrderIntent` already locks in. */
export const orderQuoteBody = z
  .object({
    side: z.enum(['buy', 'sell']),
    symbol: z
      .string()
      .min(1)
      .max(12)
      .transform((s) => s.toUpperCase())
      .refine((s) => (TRADABLE_SYMBOLS as readonly string[]).includes(s), {
        message: 'not a tradable symbol',
      }),
    qty: z.number().positive().finite(),
    orderType: z.enum(['market', 'limit']),
    limitPrice: z.number().positive().finite().nullable(),
  })
  .refine((q) => q.orderType !== 'limit' || q.limitPrice != null, {
    message: 'a limit order needs a limit price',
    path: ['limitPrice'],
  });
export type OrderQuoteBody = z.infer<typeof orderQuoteBody>;

/** `POST /api/order/record` (brief line 356): the tx hash the wallet returned after signing. */
export const orderRecordBody = z.object({
  orderId: z.string().uuid(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'not a valid transaction hash'),
});
export type OrderRecordBody = z.infer<typeof orderRecordBody>;

export const costBasisBody = z.object({
  symbol: z.string().min(1).max(12).regex(/^[A-Za-z0-9.\-]+$/),
  avgPrice: z.number().positive().finite(),
});
export type CostBasisBody = z.infer<typeof costBasisBody>;

/* ---------- auth (brief §14: SIWE) ---------- */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const nonceQuery = z.object({
  address: z.string().regex(ADDRESS_RE, 'not a valid address'),
});

export const siweVerifyBody = z.object({
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'not a valid signature'),
});
export type SiweVerifyBody = z.infer<typeof siweVerifyBody>;

/* ---------- chat (brief §5, §9) ---------- */

export const chatPageContext = z.object({
  page: z.enum(CHAT_PAGES),
  symbol: z.string().max(12).regex(/^[A-Za-z0-9.\-]+$/).optional(),
  rowSymbol: z.string().max(12).regex(/^[A-Za-z0-9.\-]+$/).optional(),
  // Server-written, not user-editable, but still capped defensively.
  portfolioSummary: z.string().max(2000).optional(),
});

export const chatBody = z.object({
  text: z.string().trim().min(1).max(2000),
  pageContext: chatPageContext.optional(),
});
export type ChatBody = z.infer<typeof chatBody>;

export const chatHistoryQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/* ---------- voice (brief §5 lip-sync, §11 VOICEVOX) ---------- */

/**
 * One chunk of a reply to speak. Capped well below a full reply: the
 * client splits a reply at sentence boundaries and synthesizes the next
 * chunk while the current one plays, so the first words arrive fast
 * instead of waiting on one long CPU synthesis.
 */
export const ttsBody = z.object({
  text: z.string().trim().min(1).max(300),
});

/* ---------- watchlist (brief §5's per-user watchlist) ---------- */

/**
 * `PUT` replaces the whole set — the client sends what it wants the list to
 * be, not a delta. Restricted to `HEAT_SYMBOLS`, the only symbols the Heat
 * page (the watchlist's one consumer so far) can ever show a row for —
 * accepting anything else would let someone save an entry that can never
 * surface data, which fails quietly rather than with a clear error.
 */
export const watchlistBody = z.object({
  symbols: z
    .array(
      z
        .string()
        .min(1)
        .max(12)
        .transform((s) => s.toUpperCase())
        .refine((s) => (HEAT_SYMBOLS as readonly string[]).includes(s), {
          message: 'not a watched symbol',
        }),
    )
    .max(50),
});
export type WatchlistBody = z.infer<typeof watchlistBody>;
