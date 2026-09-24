import type { FastifyRequest } from 'fastify';
import type { HeatLevel } from '@robinchan/shared';

import { SESSION_COOKIE, readSession } from '../auth/session.js';

/**
 * Who is asking, resolved on the server (plan §3, G6) from the SIWE session
 * cookie — never from anything the client asserts. `full` (meeting
 * `HEAT_FULL_MIN_TIER`) needs an on-chain balance read, which is still
 * gated on `NEXT_PUBLIC_RCHAN_ADDRESS` being set (open decision #1); until
 * then every signed-in caller is `wallet`, not `full`.
 */
export async function resolveLevel(request: FastifyRequest): Promise<HeatLevel> {
  const session = await readSession(request.cookies[SESSION_COOKIE]);
  return session ? 'wallet' : 'public';
}

const RANK: Record<HeatLevel, number> = { public: 0, wallet: 1, full: 2 };

export function atLeast(level: HeatLevel, required: HeatLevel): boolean {
  return RANK[level] >= RANK[required];
}

/** Page flags (plan §3 config). Anything but the literal `true` is off. */
export function flag(
  name: 'FEATURE_HEAT_PAGE' | 'FEATURE_PORTFOLIO_PAGE' | 'FEATURE_TRADING',
): boolean {
  return process.env[name] === 'true';
}
