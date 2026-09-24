import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ChatHistoryMessage, ChatPageContext } from '@robinchan/shared';
import { chatBody, chatHistoryQuery } from '@robinchan/shared/schemas';
import { getDb } from '@robinchan/store';

import { describeOrder } from '../chat/orderReply.js';
import { buildSystemPrompt } from '../chat/persona.js';
import { streamChat, type ChatTurn } from '../llm/client.js';
import { parseOrder } from '../llm/parseOrder.js';
import { sideSignals } from '../llm/grounding.js';
import { SESSION_COOKIE, readSession } from '../auth/session.js';
import { ApiFailure } from '../lib/envelope.js';

/** Real chat turns kept as context, on top of the system prompt — short-term memory, not the gated "long-term memory" tier feature. */
const CONTEXT_TURNS = 12;

/** A message needs at least one buy/sell word to be worth a second LLM call to `parseOrder` (plan §5 cost discipline). */
function looksLikeOrder(text: string): boolean {
  const s = sideSignals(text);
  return s.buy || s.sell;
}

async function requireSession(request: FastifyRequest) {
  const session = await readSession(request.cookies[SESSION_COOKIE]);
  if (!session) throw new ApiFailure('WALLET_REQUIRED', 'connect and sign in first', 401);
  return session;
}

const perAddressRateLimit = {
  max: 20,
  timeWindow: '1 minute',
  // Wallet endpoints are limited per address, not per IP (brief §9) —
  // falls back to IP only if unauthenticated, which the handler itself
  // still rejects outright.
  keyGenerator: async (request: FastifyRequest) =>
    (await readSession(request.cookies[SESSION_COOKIE]))?.address ?? request.ip,
};

/**
 * `/api/chat` (brief §5, §9): streamed replies over SSE, history kept on
 * the server so it's consistent across devices — never in `localStorage`.
 *
 * An order-shaped message never reaches the conversational model at all —
 * `parseOrder` (already grounded and tested, brief §12) decides it, and the
 * reply is deterministic text (`orderReply.ts`), not model-written, so a
 * trade-adjacent reply can't hallucinate a number.
 */
export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/chat/history',
    { config: { rateLimit: perAddressRateLimit } },
    async (request) => {
      const session = await requireSession(request);
      const parsed = chatHistoryQuery.safeParse(request.query);
      if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid limit');

      const rows = await getDb().listChatMessages(session.userId, parsed.data.limit);
      const data: ChatHistoryMessage[] = rows
        .filter((m) => m.role !== 'system')
        .map((m) => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content, createdAt: m.createdAt }));
      return { data, stale: false, asOf: new Date().toISOString() };
    },
  );

  app.post(
    '/api/chat',
    { config: { rateLimit: perAddressRateLimit } },
    async (request, reply) => {
      const session = await requireSession(request);
      const parsed = chatBody.safeParse(request.body);
      if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'text is required');
      const { text, pageContext } = parsed.data;

      const db = getDb();

      // Built from history *before* the new message is persisted, so the
      // turn sent to the model isn't duplicated (once from history, once
      // as "the current message").
      const priorHistory = await db.listChatMessages(session.userId, CONTEXT_TURNS);
      const turns: ChatTurn[] = priorHistory
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      turns.push({ role: 'user', content: text });

      await db.insertChatMessage({ userId: session.userId, role: 'user', content: text });

      // Fastify's own reply lifecycle (serialization, onSend hooks) doesn't
      // fit a hand-written SSE stream — hijack() hands the raw response
      // over, so nothing else tries to write to it after this point.
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        // In case this ever sits behind a proxy that buffers by default.
        'x-accel-buffering': 'no',
      });
      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const controller = new AbortController();
      res.on('close', () => controller.abort());

      try {
        const reply_ = looksLikeOrder(text)
          ? await runOrderAware(text, turns, pageContext, send, controller.signal)
          : await runConversation(turns, pageContext, send, controller.signal);

        if (!controller.signal.aborted) {
          await db.insertChatMessage({ userId: session.userId, role: 'assistant', content: reply_ });
          send('done', {});
        }
      } catch (err) {
        app.log.error(err, 'chat reply failed');
        if (!controller.signal.aborted) {
          send('error', { message: "Something went wrong on my end — try sending that again." });
        }
      } finally {
        res.end();
      }
    },
  );
}

/** Order-shaped messages: `parseOrder` decides, deterministic text replies — no model-written trade talk. */
async function runOrderAware(
  text: string,
  turns: ChatTurn[],
  pageContext: ChatPageContext | undefined,
  send: (event: string, data: unknown) => void,
  signal: AbortSignal,
): Promise<string> {
  const result = await parseOrder(text);
  const orderText = describeOrder(result);
  if (orderText == null) {
    // `parseOrder` decided this wasn't actually an order after all — e.g.
    // "should I buy apple?" has a buy word but resolves to not_an_order.
    // Falls through to real chat rather than staying silent.
    return runConversation(turns, pageContext, send, signal);
  }
  send('token', { text: orderText });
  return orderText;
}

async function runConversation(
  turns: ChatTurn[],
  pageContext: ChatPageContext | undefined,
  send: (event: string, data: unknown) => void,
  signal: AbortSignal,
): Promise<string> {
  const system = await buildSystemPrompt(pageContext);
  const { text } = await streamChat({
    job: 'chat',
    system,
    turns,
    signal,
    onDelta: (delta) => send('token', { text: delta }),
  });
  return text;
}
