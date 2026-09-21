import type { ApiEnvelope, ApiErrorCode } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

/**
 * Semua respons dibungkus `{ data, stale, asOf }` (brief §9).
 *
 * `stale` bukan "cache miss" — kalau worker telat, API tetap mengembalikan data
 * lama dengan penanda, dan frontend meredupkan teksnya. Selalu sajikan yang
 * basi daripada gagal (brief §8).
 */
export function envelope<T>(data: T, opts: { stale: boolean; asOf?: string }): ApiEnvelope<T> {
  return {
    data,
    stale: opts.stale,
    asOf: opts.asOf ?? new Date().toISOString(),
  };
}

export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

/** Batas umur wajar per domain, detik. Lewat ini data ditandai `stale`. */
export const FRESH_FOR: Record<string, number> = {
  price: 30,
  market: 30,
  news: 120,
  heat: 600,
  media: 900,
  calendar: 7200,
};

export type Cached<T> = { data: T; stale: boolean; asOf: string };

/**
 * Baca satu kunci cache dan tentukan status basinya dari umur nilai.
 * Mengembalikan `null` hanya kalau kuncinya memang belum pernah ditulis.
 */
export async function readCached<T>(domain: string, key: string): Promise<Cached<T> | null> {
  const hit = await getCache().getWithAge<T>(cacheKey(domain, key));
  if (!hit) return null;
  const limit = FRESH_FOR[domain] ?? 60;
  return {
    data: hit.value,
    stale: hit.ageSec > limit,
    asOf: new Date(Date.now() - hit.ageSec * 1000).toISOString(),
  };
}

/**
 * Bentuk respons saat worker belum sempat mengisi apa pun. Layout tidak boleh
 * melompat dan landing page tidak boleh menampilkan error (brief §4), jadi
 * yang dikirim adalah bentuk kosong yang valid, bukan HTTP 5xx.
 */
export function emptyEnvelope<T>(data: T): ApiEnvelope<T> {
  return { data, stale: true, asOf: new Date(0).toISOString() };
}
