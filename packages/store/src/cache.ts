import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { dataDir } from './paths.js';

/**
 * Cache key-value dengan TTL. Kunci mengikuti pola `rc:<domain>:<key>` (brief §8).
 *
 * Implementasi Redis dipakai kalau REDIS_URL diisi. Kalau tidak, jatuh ke
 * berkas JSON di `.data/` — bukan in-memory, karena API dan worker adalah dua
 * proses terpisah dan harus tetap saling melihat data di lingkungan dev.
 */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  /** Mengembalikan nilai plus umurnya dalam detik, null kalau tidak ada sama sekali. */
  getWithAge<T>(key: string): Promise<{ value: T; ageSec: number } | null>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  /** Hapus semua kunci dengan prefix. */
  keys(prefix: string): Promise<string[]>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function cacheKey(domain: string, key: string): string {
  return `rc:${domain}:${key}`;
}

type Entry = { v: unknown; writtenAt: number; expiresAt: number };

/**
 * Nilai yang sudah lewat TTL tidak dibuang: brief §8 meminta API selalu
 * menyajikan data basi daripada gagal, jadi TTL hanya menandai umur.
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
    return raw ? (JSON.parse(raw) as T) : null;
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
    // Simpan dua kali umur TTL supaya data basi masih bisa disajikan saat
    // worker telat, sesuai aturan "stale lebih baik daripada gagal".
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
    // Import dinamis supaya `ioredis` tidak pernah dimuat di mode file.
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
