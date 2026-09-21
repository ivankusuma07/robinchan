import type { SourceState } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

/**
 * Aturan umum adaptor (brief §11): timeout 8 detik, tiga percobaan dengan jeda
 * melebar, dan circuit breaker — setelah lima kegagalan beruntun, provider
 * dijeda 10 menit dan ditandai merah di `/api/sources/status`.
 */
const TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;
const TRIP_AFTER = 5;
const TRIP_FOR_MS = 10 * 60 * 1000;

export type ProviderHealth = {
  state: SourceState;
  lastOkAt: string | null;
  failures: number;
  /** Timestamp saat breaker boleh dicoba lagi. */
  openUntil: number | null;
  note: string;
};

const HEALTH_TTL_SEC = 3600;

export function healthKey(id: string): string {
  return cacheKey('source', id);
}

export async function readHealth(id: string): Promise<ProviderHealth> {
  const stored = await getCache().get<ProviderHealth>(healthKey(id));
  return (
    stored ?? {
      state: 'idle',
      lastOkAt: null,
      failures: 0,
      openUntil: null,
      note: 'belum dikonfigurasi',
    }
  );
}

async function writeHealth(id: string, health: ProviderHealth): Promise<void> {
  await getCache().set(healthKey(id), health, HEALTH_TTL_SEC);
}

export class ProviderSkipped extends Error {
  constructor(
    readonly providerId: string,
    reason: string,
  ) {
    super(`${providerId}: ${reason}`);
    this.name = 'ProviderSkipped';
  }
}

function backoffMs(attempt: number): number {
  return 500 * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bungkus satu panggilan provider. `configured: false` menandai provider yang
 * belum punya API key — statusnya abu, bukan merah, karena bukan kegagalan.
 */
export async function callProvider<T>(
  opts: { id: string; configured?: boolean },
  fn: () => Promise<T>,
): Promise<T> {
  const { id, configured = true } = opts;
  const health = await readHealth(id);

  if (!configured) {
    await writeHealth(id, {
      ...health,
      state: 'idle',
      note: 'belum dikonfigurasi',
    });
    throw new ProviderSkipped(id, 'API key belum diisi');
  }

  if (health.openUntil && Date.now() < health.openUntil) {
    const waitSec = Math.ceil((health.openUntil - Date.now()) / 1000);
    throw new ProviderSkipped(id, `circuit terbuka, coba lagi ${waitSec}s`);
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await withTimeout(fn(), TIMEOUT_MS);
      await writeHealth(id, {
        state: 'ok',
        lastOkAt: new Date().toISOString(),
        failures: 0,
        openUntil: null,
        note: 'merespons normal',
      });
      return result;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) await sleep(backoffMs(attempt));
    }
  }

  const failures = health.failures + 1;
  const tripped = failures >= TRIP_AFTER;
  await writeHealth(id, {
    state: 'down',
    lastOkAt: health.lastOkAt,
    failures,
    openUntil: tripped ? Date.now() + TRIP_FOR_MS : null,
    note: tripped
      ? `dijeda 10 menit setelah ${failures} kegagalan beruntun`
      : `gagal ${failures}×: ${errText(lastErr)}`,
  });
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 120);
  return String(err).slice(0, 120);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () =>
          reject(new Error(`timeout setelah ${ms}ms`)),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch JSON dengan abort signal sendiri, dipanggil dari dalam `callProvider`. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
