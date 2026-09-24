import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { OrderRecord } from '@robinchan/shared';
import { orderQuoteBody, orderRecordBody } from '@robinchan/shared/schemas';
import { getDb, type Order } from '@robinchan/store';

import { SESSION_COOKIE, readSession } from '../auth/session.js';
import { flag } from '../lib/access.js';
import { ApiFailure, envelope } from '../lib/envelope.js';

/** Brief line 354: "Quote berlaku 30 detik." Enforced from the order row's `createdAt` — no separate quote cache needed. */
const QUOTE_TTL_MS = 30_000;

async function requireSession(request: FastifyRequest) {
  const session = await readSession(request.cookies[SESSION_COOKIE]);
  if (!session) throw new ApiFailure('WALLET_REQUIRED', 'connect and sign in first', 401);
  return session;
}

function perAddress(max: number) {
  return {
    max,
    timeWindow: '1 minute',
    keyGenerator: async (request: FastifyRequest) =>
      (await readSession(request.cookies[SESSION_COOKIE]))?.address ?? request.ip,
  };
}

/**
 * Whether there's an actual DEX/router to quote and build a transaction
 * against — brief §18, open decisions #4 (which DEX + its ABI) and #5
 * (protocol fee) are both explicitly marked **blocker for M4**, and neither
 * is answered yet. `TRADE_ROUTER_ADDRESS` is the single switch: unset
 * everywhere today, exactly like `NEXT_PUBLIC_RCHAN_ADDRESS` before $RCHAN
 * launched. Once it's set, the real gas estimate and unsigned payload
 * construction (needing the real ABI) go where the comment below marks.
 */
function tradePipelineConfigured(): boolean {
  return Boolean(process.env.TRADE_ROUTER_ADDRESS);
}

function toOrderRecord(order: Order): OrderRecord {
  return {
    id: order.id,
    side: order.side,
    symbol: order.symbol,
    qty: order.qty,
    limitPrice: order.limitPrice,
    status: order.status,
    txHash: order.txHash,
    fillPrice: order.fillPrice,
    filledQty: order.filledQty,
    feeUsd: order.feeUsd,
    filledAt: order.filledAt,
    createdAt: order.createdAt,
  };
}

/**
 * `/api/order/quote` and `/api/order/record` (brief §12, M4's third and
 * fourth checklist items). Parsing an order into an intent is a separate,
 * already-working step (`parseOrder`, called from chat) — this file starts
 * from an intent that's already been decided (typed by the ticket, or
 * confirmed via chat) and carries it through quote → sign → record.
 */
export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/order/quote', { config: { rateLimit: perAddress(10) } }, async (request) => {
    if (!flag('FEATURE_TRADING')) throw new ApiFailure('NOT_FOUND', 'unknown endpoint', 404);
    await requireSession(request);
    const parsed = orderQuoteBody.safeParse(request.body);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid order');

    // brief §18's open decisions #4 (which DEX + its ABI) and #5 (protocol
    // fee) are both explicit blockers for M4, and neither is answered yet —
    // see `tradePipelineConfigured()`'s doc comment above. There's nothing
    // honest to return past this point: a real quote needs the router's ABI
    // to estimate gas and build the unsigned transaction payload, and the
    // fee rate to compute `protocolFee`.
    if (!tradePipelineConfigured()) {
      throw new ApiFailure(
        'PIPELINE_NOT_CONFIGURED',
        "the order pipeline isn't wired to a DEX yet, so quotes aren't available",
        503,
      );
    }

    // Unreachable today — this is where the real quote (estPrice from
    // livePrice(), estGas + the unsigned payload from the router ABI,
    // protocolFee from the configured rate) gets built and an `orders` row
    // inserted via `insertOrder()`, once TRADE_ROUTER_ADDRESS is set.
    throw new ApiFailure('PIPELINE_NOT_CONFIGURED', 'order pipeline not implemented', 503);
  });

  app.post('/api/order/record', { config: { rateLimit: perAddress(20) } }, async (request) => {
    if (!flag('FEATURE_TRADING')) throw new ApiFailure('NOT_FOUND', 'unknown endpoint', 404);
    const session = await requireSession(request);
    const parsed = orderRecordBody.safeParse(request.body);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid order id or transaction hash');

    const db = getDb();
    const order = await db.getOrder(parsed.data.orderId);
    if (!order || order.userId !== session.userId) {
      throw new ApiFailure('NOT_FOUND', 'no such order');
    }
    if (order.status !== 'quoted') {
      throw new ApiFailure('BAD_REQUEST', `this order is ${order.status}, not awaiting a signature`);
    }
    if (Date.now() - Date.parse(order.createdAt) > QUOTE_TTL_MS) {
      await db.setOrderStatus(order.id, 'expired');
      throw new ApiFailure('QUOTE_EXPIRED', 'this quote expired before it was signed — get a new one', 409);
    }

    const updated = await db.recordOrderSignature(order.id, parsed.data.txHash);
    return envelope(toOrderRecord(updated), { stale: false });
  });
}
