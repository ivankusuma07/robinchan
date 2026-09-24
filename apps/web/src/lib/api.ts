import type { ApiEnvelope } from '@robinchan/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * If the API fails, the page still renders with empty values — no error
 * message on the landing page and the layout must not jump (brief §4). So
 * this client never throws; it returns an empty envelope marked `stale`.
 */
export async function getEnvelope<T>(
  path: string,
  fallback: T,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      // Without this, a client-side re-fetch (a poll tick, a filter/sort
      // change) never sends the session cookie cross-origin, so a
      // wallet-gated route falls back to its public view even for a
      // signed-in caller — every other caller that reads a cookie already
      // sets this explicitly (WalletProvider, useChat, useWatchlist); this
      // is the one that was missed. Harmless on the server (Node's `fetch`
      // has no browser cookie jar to draw from either way) and on public
      // endpoints, which simply have no cookie to read.
      credentials: 'include',
      ...init,
      headers: { accept: 'application/json', ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(6000),
    });
    if (!res.ok) return emptyEnvelope(fallback);
    const body = (await res.json()) as ApiEnvelope<T> | { error: unknown };
    if (!body || typeof body !== 'object' || !('data' in body)) return emptyEnvelope(fallback);
    return body;
  } catch {
    return emptyEnvelope(fallback);
  }
}

export function emptyEnvelope<T>(data: T): ApiEnvelope<T> {
  return { data, stale: true, asOf: new Date(0).toISOString() };
}

/** Never populated at all — different from "populated but stale". */
export function isUnset(envelope: ApiEnvelope<unknown>): boolean {
  return Date.parse(envelope.asOf) === 0;
}

/**
 * The marketing page renders statically and then hydrates on the client
 * (brief §4), so server-side fetches must use a short cache — never
 * `force-cache`.
 */
export function ssr(seconds: number): RequestInit {
  return { next: { revalidate: seconds } } as RequestInit;
}
