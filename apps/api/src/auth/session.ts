import { SignJWT, jwtVerify } from 'jose';

/**
 * Session token: a short-lived JWT in an httpOnly cookie, issued once SIWE
 * verification succeeds (brief §14). The wallet address is never trusted
 * from anywhere else — every authenticated route reads it from here.
 *
 * "Short-lived" per the brief: each token is valid 24h. `GET /api/auth/session`
 * reissues a fresh 24h token on every valid call, so an active user stays
 * signed in; someone inactive for 24h has to sign a new SIWE message. No
 * server-side session store is needed — the JWT itself is the proof, and
 * revocation (sign-out) just clears the cookie.
 */
export const SESSION_COOKIE = 'rc_session';
const TTL_SEC = 24 * 60 * 60;

export type SessionPayload = {
  userId: string;
  address: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET is not set (or too short) — see .env.example');
  }
  return new TextEncoder().encode(secret);
}

export async function issueSession(payload: SessionPayload): Promise<{ token: string; maxAgeSec: number }> {
  const token = await new SignJWT({ addr: payload.address })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SEC}s`)
    .sign(secretKey());
  return { token, maxAgeSec: TTL_SEC };
}

export async function readSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== 'string' || typeof payload.addr !== 'string') return null;
    return { userId: payload.sub, address: payload.addr };
  } catch {
    // Expired, malformed, or signed with a different secret — all just "no session".
    return null;
  }
}
