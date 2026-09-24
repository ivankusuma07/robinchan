import type { FastifyInstance } from 'fastify';
import type { TierState } from '@robinchan/shared';

import { rchanBalance, tierForBalance, unlockedFor } from '../chain/tier.js';
import { SESSION_COOKIE, readSession } from '../auth/session.js';
import { ApiFailure } from '../lib/envelope.js';

/**
 * `/api/user/tier` (brief §9, §14): wallet-gated. Reads the balance from
 * the chain, never from anything the client sends — see
 * `apps/api/src/chain/tier.ts`.
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/user/tier', async (request) => {
    const session = await readSession(request.cookies[SESSION_COOKIE]);
    if (!session) throw new ApiFailure('WALLET_REQUIRED', 'connect and sign in first', 401);

    const balance = await rchanBalance(session.address);
    const tier = tierForBalance(balance);
    const data: TierState = { tier, balance, unlocked: unlockedFor(tier) };
    return { data, stale: false, asOf: new Date().toISOString() };
  });
}
