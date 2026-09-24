import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TierState, WatchlistState } from '@robinchan/shared';
import { watchlistBody } from '@robinchan/shared/schemas';
import { getDb } from '@robinchan/store';

import { rchanBalance, tierForBalance, unlockedFor } from '../chain/tier.js';
import { SESSION_COOKIE, readSession } from '../auth/session.js';
import { ApiFailure } from '../lib/envelope.js';

async function requireSession(request: FastifyRequest) {
  const session = await readSession(request.cookies[SESSION_COOKIE]);
  if (!session) throw new ApiFailure('WALLET_REQUIRED', 'connect and sign in first', 401);
  return session;
}

/**
 * `/api/user/*` (brief §9, §14): every route here is wallet-gated.
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/user/tier', async (request) => {
    // Reads the balance from the chain, never from anything the client
    // sends — see `apps/api/src/chain/tier.ts`.
    const session = await requireSession(request);
    const balance = await rchanBalance(session.address);
    const tier = tierForBalance(balance);
    const data: TierState = { tier, balance, unlocked: unlockedFor(tier) };
    return { data, stale: false, asOf: new Date().toISOString() };
  });

  app.get('/api/user/watchlist', async (request) => {
    const session = await requireSession(request);
    const symbols = await getDb().listWatchlist(session.userId);
    const data: WatchlistState = { symbols };
    return { data, stale: false, asOf: new Date().toISOString() };
  });

  app.put('/api/user/watchlist', async (request) => {
    const session = await requireSession(request);
    const parsed = watchlistBody.safeParse(request.body);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid symbols');

    await getDb().setWatchlist(session.userId, parsed.data.symbols);
    const data: WatchlistState = { symbols: parsed.data.symbols };
    return { data, stale: false, asOf: new Date().toISOString() };
  });
}
