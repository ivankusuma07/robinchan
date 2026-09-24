import type { FastifyInstance } from 'fastify';
import { nonceQuery, siweVerifyBody } from '@robinchan/shared/schemas';
import { getDb } from '@robinchan/store';

import { issueNonce, verifySiwe } from '../auth/siwe.js';
import { SESSION_COOKIE, issueSession, readSession } from '../auth/session.js';
import { ApiFailure } from '../lib/envelope.js';

/**
 * `web` and `api` are deployed on genuinely different sites (`robinchan.tech`
 * vs. a `railway.app` subdomain — different registrable domains, not just
 * different origins), so every browser request from the page to the API is
 * cross-site. `SameSite=Lax` cookies are withheld from cross-site
 * `fetch()`/XHR by design — they only ride along on top-level navigations —
 * so a `Lax` session cookie gets set fine on sign-in and then silently never
 * reaches any later `fetch('/api/...')` call. That's what produced "connect
 * and sign in first" right after a successful sign-in.
 *
 * The fix is `SameSite=None`, which the spec requires to be paired with
 * `Secure`. Local dev is plain HTTP (`Secure` cookies are dropped there) and
 * `localhost:3000`→`:4000` is same-site anyway, so `None` is only turned on
 * in production — `Lax` still applies locally, where it already worked.
 */
function sessionCookieOptions(maxAgeSec: number) {
  const production = process.env.RC_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? ('none' as const) : ('lax' as const),
    path: '/',
    maxAge: maxAgeSec,
  };
}

/**
 * Sign-In with Ethereum (brief §14). Three endpoints:
 *
 *   GET  /api/auth/nonce     — a fresh one-time nonce to put in the SIWE message
 *   POST /api/auth/verify    — the signed message; on success, sets the session cookie
 *   GET  /api/auth/session   — who's signed in, if anyone; slides the session forward
 *   POST /api/auth/logout    — clears the cookie
 *
 * The wallet address that ends up in the session is never taken from
 * anything the client asserts directly — it only comes out of a signature
 * that `verifySiwe` checked against a nonce this server issued.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/auth/nonce', async (request) => {
    // `address` isn't used to scope the nonce (SIWE nonces are anti-replay,
    // not per-address), but requiring it lets the same rate-limit rule as
    // other wallet-facing endpoints apply per-address rather than per-IP.
    const parsed = nonceQuery.safeParse(request.query);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'address query param required');
    const nonce = await issueNonce();
    return { data: { nonce }, stale: false, asOf: new Date().toISOString() };
  });

  app.post('/api/auth/verify', async (request, reply) => {
    const parsed = siweVerifyBody.safeParse(request.body);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'message and signature required');

    const result = await verifySiwe(parsed.data.message, parsed.data.signature);
    if (!result.ok) {
      // Wrong signature is a normal, expected outcome (user cancelled, or
      // an attacker without the key) — 401, not 400/500.
      throw new ApiFailure('BAD_REQUEST', result.reason, 401);
    }

    const user = await getDb().touchUser(result.address);
    const { token, maxAgeSec } = await issueSession({ userId: user.id, address: user.walletAddress });

    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));

    return { data: { address: user.walletAddress }, stale: false, asOf: new Date().toISOString() };
  });

  app.get('/api/auth/session', async (request, reply) => {
    const session = await readSession(request.cookies[SESSION_COOKIE]);
    if (!session) {
      return { data: { signedIn: false as const }, stale: false, asOf: new Date().toISOString() };
    }

    // Sliding session: a valid, active caller gets a fresh 24h cookie so
    // they stay signed in without re-signing, while someone inactive for a
    // full 24h has to sign a new SIWE message (session.ts).
    const { token, maxAgeSec } = await issueSession(session);
    reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(maxAgeSec));

    return {
      data: { signedIn: true as const, address: session.address },
      stale: false,
      asOf: new Date().toISOString(),
    };
  });

  app.post('/api/auth/logout', async (_request, reply) => {
    // Matching attributes aren't strictly required to clear a cookie
    // (browsers key on name + domain + path), but keeping them identical to
    // how it was set avoids relying on that.
    reply.clearCookie(SESSION_COOKIE, sessionCookieOptions(0));
    return { data: { signedIn: false as const }, stale: false, asOf: new Date().toISOString() };
  });
}
