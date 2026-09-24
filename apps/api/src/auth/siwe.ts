import { randomBytes } from 'node:crypto';

import { cacheKey, getCache } from '@robinchan/store';
import { buildSiweMessage, parseSiweMessage, type SiweFields } from '@robinchan/shared';

import { publicClient } from '../chain/client.js';

/**
 * SIWE nonce + verification (brief §14). The `siwe` npm package is not used
 * — see `packages/shared/src/siwe.ts` for why — so this owns the two things
 * that package would otherwise provide: issuing single-use nonces, and
 * checking a signed message against them before trusting the address in it.
 */

const NONCE_TTL_SEC = 5 * 60;
const MESSAGE_MAX_AGE_SEC = 5 * 60;

export function issueNonce(): Promise<string> {
  const nonce = randomBytes(16).toString('hex');
  // The shared `Cache` is built for "serve stale market data rather than
  // fail" (its Redis backend deliberately stretches TTL 10x past nominal
  // freshness) — wrong shape for a one-time security token. So the value
  // stored is just the issue time, and expiry is checked by hand in
  // `verifySiwe` regardless of backend; the key is deleted outright the
  // moment it's used, which is what actually prevents replay.
  return getCache()
    .set(cacheKey('siwe-nonce', nonce), { issuedAt: Date.now() }, NONCE_TTL_SEC)
    .then(() => nonce);
}

/** Configured origins (`CORS_ORIGIN`), as hostnames — what a SIWE message's `domain` must equal. */
function allowedDomains(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).host;
      } catch {
        return origin;
      }
    });
}

export type SiweVerifyResult =
  | { ok: true; address: string }
  | { ok: false; reason: string };

/**
 * Checks a signed SIWE message end to end: well-formed, addressed to us,
 * fresh, its nonce genuinely ours and unused, and the signature real. Every
 * failure returns a reason rather than throwing, since a rejected sign-in
 * attempt is an ordinary outcome, not a server error.
 */
export async function verifySiwe(message: string, signature: string): Promise<SiweVerifyResult> {
  const fields = parseSiweMessage(message);
  if (!fields) return { ok: false, reason: 'malformed SIWE message' };

  if (!allowedDomains().includes(fields.domain)) {
    return { ok: false, reason: `unexpected domain "${fields.domain}"` };
  }

  const configuredChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 46630);
  if (fields.chainId !== configuredChainId) {
    return { ok: false, reason: `wrong chain (got ${fields.chainId}, expected ${configuredChainId})` };
  }

  const now = Date.now();
  const issuedAt = Date.parse(fields.issuedAt);
  const expiresAt = Date.parse(fields.expirationTime);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    return { ok: false, reason: 'unparseable timestamp' };
  }
  // ±2 min clock skew allowance on issuance; the message itself must not be
  // stale, and its self-declared window must not be absurdly long (a wide
  // window would let a captured signature be replayed much later).
  if (issuedAt > now + 2 * 60_000) return { ok: false, reason: 'issued in the future' };
  if (now > expiresAt) return { ok: false, reason: 'message expired' };
  if (expiresAt - issuedAt > MESSAGE_MAX_AGE_SEC * 1000) {
    return { ok: false, reason: 'validity window too long' };
  }

  const cache = getCache();
  const key = cacheKey('siwe-nonce', fields.nonce);
  const stored = await cache.get<{ issuedAt: number }>(key);
  // Deleted immediately, win or lose — a failed or retried verification
  // can't be replayed with the same nonce either. `delPrefix` with no other
  // key sharing this exact string as a prefix is an exact delete.
  await cache.delPrefix(key);
  if (!stored) return { ok: false, reason: 'unknown or already-used nonce' };
  if (Date.now() - stored.issuedAt > NONCE_TTL_SEC * 1000) {
    return { ok: false, reason: 'nonce expired' };
  }

  const valid = await publicClient()
    .verifyMessage({ address: fields.address as `0x${string}`, message, signature: signature as `0x${string}` })
    .catch(() => false);
  if (!valid) return { ok: false, reason: 'signature does not match the address' };

  return { ok: true, address: fields.address.toLowerCase() };
}

export type { SiweFields };
export { buildSiweMessage };
