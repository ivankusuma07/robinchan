import type { ApiEnvelope } from '@robinchan/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Kalau API gagal, halaman tetap dirender dengan nilai kosong — tidak ada pesan
 * error di landing page dan layout tidak boleh melompat (brief §4). Jadi klien
 * ini tidak pernah melempar; ia mengembalikan amplop kosong bertanda `stale`.
 */
export async function getEnvelope<T>(
  path: string,
  fallback: T,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
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

/** Belum pernah terisi sama sekali — beda dari "terisi tapi basi". */
export function isUnset(envelope: ApiEnvelope<unknown>): boolean {
  return Date.parse(envelope.asOf) === 0;
}

/**
 * Halaman marketing dirender statis lalu dihidrasi di client (brief §4), jadi
 * fetch di server hanya boleh memakai cache pendek — bukan `force-cache`.
 */
export function ssr(seconds: number): RequestInit {
  return { next: { revalidate: seconds } } as RequestInit;
}
