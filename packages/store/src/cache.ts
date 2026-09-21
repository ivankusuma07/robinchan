import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { dataDir } from './paths.js';

/**
 * Key-value cache with TTL. Keys follow the `rc:<domain>:<key>` pattern (brief §8).
 *
 * The Redis implementation is used when REDIS_URL is set. Otherwise it falls
 * back to a JSON file in `.data/` — not in-memory, because the API and
 * worker are two separate processes and need to keep seeing each other's
 * data in the dev environment.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  /** Returns the value plus its age in seconds, null if it doesn't exist at all. */
  getWithAge<T>(key: string): Promise<{ value: T; ageSec: number } | null>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  /** Delete all keys with a given prefix. */
  keys(prefix: string): Promise<string[]>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function cacheKey(domain: string, key: string): string {
  return `rc:${domain}:${key}`;
}

type Entry = { v: unknown; writtenAt: number; expiresAt: number };

/**
 * A value past its TTL isn't discarded: brief §8 asks the API to always
 * serve stale data rather than fail, so TTL here only marks age.
 */
class FileCache implements Cache {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
  }

  private read(): Record<string, Entry> {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, Entry>;
    } catch {
      return {};
    }
  }

  private write(data: Record<string, Entry>): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, this.file);
  }

  async get<T>(key: string): Promise<T | null> {
    const hit = this.read()[key];
    return hit ? (hit.v as T) : null;
  }

  async getWithAge<T>(key: string): Promise<{ value: T; ageSec: number } | null> {
    const hit = this.read()[key];
    if (!hit) return null;
    return {
      value: hit.v as T,
      ageSec: Math.round((Date.now() - hit.writtenAt) / 1000),
    };
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    const data = this.read();
    data[key] = {
      v: value,
      writtenAt: Date.now(),
      expiresAt: Date.now() + ttlSec * 1000,
    };
    this.write(data);
  }

  async keys(prefix: string): Promise<string[]> {
    return Object.keys(this.read()).filter((k) => k.startsWith(prefix));
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

class RedisCache implements Cache {
  constructor(private readonly redis: import('ioredis').Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw == null) return null;
    // `set()` wraps the value as `{ v, writtenAt }` (see `getWithAge`) —
    // unwrap it here too, or callers get the envelope back typed as their
    // actual value, and every field silently reads as `undefined`.
    const parsed = JSON.parse(raw) as { v: T; writtenAt: number };
    return parsed.v;
  }

  async getWithAge<T>(key: string): Promise<{ value: T; ageSec: number } | null> {
    const raw = await this.redis.get(key);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as { v: T; writtenAt: number };
    return {
      value: parsed.v,
      ageSec: Math.round((Date.now() - parsed.writtenAt) / 1000),
    };
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    // Store at ten times the TTL so stale data can still be served when the
    // worker falls behind, per the "stale beats failing" rule.
    await this.redis.set(
      key,
      JSON.stringify({ v: value, writtenAt: Date.now() }),
      'EX',
      Math.max(ttlSec * 10, 60),
    );
  }

  async keys(prefix: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      found.push(...batch);
    } while (cursor !== '0');
    return found;
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

let cached: Cache | null = null;

export function getCache(): Cache {
  if (cached) return cached;
  const url = process.env.REDIS_URL;
  if (url) {
    // Dynamic import so `ioredis` is never loaded in file mode.
    const require = createRequire(import.meta.url);
    const { default: Redis } = require('ioredis') as typeof import('ioredis');
    cached = new RedisCache(new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false }));
  } else {
    cached = new FileCache(join(dataDir(), 'cache.json'));
  }
  return cached;
}

export function cacheBackend(): 'redis' | 'file' {
  return process.env.REDIS_URL ? 'redis' : 'file';
}
