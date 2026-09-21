import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CalendarEvent, HeatComponents, NewsItem } from '@robinchan/shared';

import { dataDir } from './paths.js';

export type HeatRow = {
  symbol: string;
  score: number;
  components: HeatComponents;
  computedAt: string;
};

export type NewsQuery = {
  limit: number;
  cat?: string;
  symbol?: string;
  pinnedOnly?: boolean;
};

export interface Db {
  migrate(): Promise<void>;
  /** Mengembalikan jumlah baris yang benar-benar baru setelah dedupe. */
  upsertNews(items: NewsItem[]): Promise<number>;
  listNews(query: NewsQuery): Promise<NewsItem[]>;
  upsertHeat(rows: HeatRow[]): Promise<void>;
  listHeat(limit: number): Promise<HeatRow[]>;
  upsertCalendar(events: CalendarEvent[]): Promise<void>;
  listCalendar(limit: number): Promise<CalendarEvent[]>;
  /** chat_messages 30 hari, news_items 90 hari (brief §10). */
  pruneRetention(): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Provider sering mengirim cerita yang sama dengan id berbeda, jadi selain
 * `external_id` kita simpan hash judul yang dinormalisasi dan menolak duplikat
 * dalam jendela 6 jam (brief §10).
 */
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000;

export function titleHash(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha1').update(normalized).digest('hex');
}

/* ------------------------------------------------------------------ */
/* Postgres                                                            */
/* ------------------------------------------------------------------ */

class PgDb implements Db {
  constructor(private readonly pool: import('pg').Pool) {}

  async migrate(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
    await this.pool.query(sql);
  }

  async upsertNews(items: NewsItem[]): Promise<number> {
    if (items.length === 0) return 0;
    let inserted = 0;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const item of items) {
        const hash = titleHash(item.title);
        const dupe = await client.query(
          `select 1 from news_items
            where title_hash = $1
              and published_at > $2::timestamptz - interval '6 hours'
              and external_id <> $3
            limit 1`,
          [hash, item.publishedAt, item.id],
        );
        if (dupe.rowCount) continue;
        const res = await client.query(
          `insert into news_items
             (id, external_id, title_hash, cat, title, short, symbols, sentiment, url, source, pinned, published_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict (external_id) do update
             set sentiment = excluded.sentiment,
                 pinned = excluded.pinned,
                 title = excluded.title,
                 short = excluded.short
           returning (xmax = 0) as is_new`,
          [
            item.id,
            item.id,
            hash,
            item.cat,
            item.title,
            item.short,
            item.symbols,
            item.sentiment,
            item.url,
            item.source,
            item.pinned ?? false,
            item.publishedAt,
          ],
        );
        if (res.rows[0]?.is_new) inserted += 1;
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
    return inserted;
  }

  async listNews(query: NewsQuery): Promise<NewsItem[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (query.cat) {
      params.push(query.cat);
      where.push(`cat = $${params.length}`);
    }
    if (query.symbol) {
      params.push([query.symbol]);
      where.push(`symbols && $${params.length}`);
    }
    if (query.pinnedOnly) where.push('pinned = true');
    params.push(query.limit);
    const res = await this.pool.query(
      `select * from news_items
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by published_at desc
        limit $${params.length}`,
      params,
    );
    return res.rows.map(rowToNews);
  }

  async upsertHeat(rows: HeatRow[]): Promise<void> {
    for (const row of rows) {
      await this.pool.query(
        `insert into heat_scores (symbol, score, components, computed_at)
         values ($1,$2,$3,$4)
         on conflict (symbol) do update
           set score = excluded.score,
               components = excluded.components,
               computed_at = excluded.computed_at`,
        [row.symbol, row.score, JSON.stringify(row.components), row.computedAt],
      );
    }
  }

  async listHeat(limit: number): Promise<HeatRow[]> {
    const res = await this.pool.query('select * from heat_scores order by score desc limit $1', [
      limit,
    ]);
    return res.rows.map((r: Record<string, unknown>) => ({
      symbol: String(r.symbol),
      score: Number(r.score),
      components: r.components as HeatComponents,
      computedAt: new Date(r.computed_at as string).toISOString(),
    }));
  }

  async upsertCalendar(events: CalendarEvent[]): Promise<void> {
    for (const e of events) {
      await this.pool.query(
        `insert into calendar_events (id, date, title, subtitle, kind, symbol)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update
           set date = excluded.date, title = excluded.title,
               subtitle = excluded.subtitle, kind = excluded.kind, symbol = excluded.symbol`,
        [e.id, e.date, e.title, e.subtitle, e.kind, e.symbol],
      );
    }
  }

  async listCalendar(limit: number): Promise<CalendarEvent[]> {
    const res = await this.pool.query(
      'select * from calendar_events where date >= current_date order by date asc limit $1',
      [limit],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      date: new Date(r.date as string).toISOString().slice(0, 10),
      title: String(r.title),
      subtitle: String(r.subtitle ?? ''),
      kind: r.kind as CalendarEvent['kind'],
      symbol: (r.symbol as string | null) ?? null,
    }));
  }

  async pruneRetention(): Promise<void> {
    await this.pool.query(
      "delete from chat_messages where created_at < now() - interval '30 days'",
    );
    await this.pool.query("delete from news_items where published_at < now() - interval '90 days'");
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function rowToNews(r: Record<string, unknown>): NewsItem {
  return {
    id: String(r.id),
    cat: r.cat as NewsItem['cat'],
    title: String(r.title),
    short: String(r.short),
    symbols: (r.symbols as string[]) ?? [],
    sentiment: Number(r.sentiment),
    url: String(r.url),
    source: String(r.source),
    pinned: Boolean(r.pinned),
    publishedAt: new Date(r.published_at as string).toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Fallback berkas — dipakai kalau DATABASE_URL kosong                 */
/* ------------------------------------------------------------------ */

type StoredNews = NewsItem & { hash: string };

type FileShape = {
  news: StoredNews[];
  heat: HeatRow[];
  calendar: CalendarEvent[];
};

class FileDb implements Db {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
  }

  private read(): FileShape {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as FileShape;
    } catch {
      return { news: [], heat: [], calendar: [] };
    }
  }

  private write(data: FileShape): void {
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, this.file);
  }

  private static strip(row: StoredNews): NewsItem {
    const { hash: _hash, ...rest } = row;
    return rest;
  }

  async migrate(): Promise<void> {
    this.write(this.read());
  }

  async upsertNews(items: NewsItem[]): Promise<number> {
    const data = this.read();
    let inserted = 0;
    for (const item of items) {
      const hash = titleHash(item.title);
      const published = Date.parse(item.publishedAt);
      const existingIdx = data.news.findIndex((n) => n.id === item.id);
      if (existingIdx >= 0) {
        data.news[existingIdx] = { ...item, hash };
        continue;
      }
      const dupe = data.news.some(
        (n) =>
          n.hash === hash && Math.abs(Date.parse(n.publishedAt) - published) < DEDUPE_WINDOW_MS,
      );
      if (dupe) continue;
      data.news.push({ ...item, hash });
      inserted += 1;
    }
    data.news.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    data.news = data.news.slice(0, 500);
    this.write(data);
    return inserted;
  }

  async listNews(query: NewsQuery): Promise<NewsItem[]> {
    return this.read()
      .news.filter((n) => (query.cat ? n.cat === query.cat : true))
      .filter((n) => (query.symbol ? n.symbols.includes(query.symbol) : true))
      .filter((n) => (query.pinnedOnly ? n.pinned === true : true))
      .slice(0, query.limit)
      .map(FileDb.strip);
  }

  async upsertHeat(rows: HeatRow[]): Promise<void> {
    const data = this.read();
    const bySymbol = new Map(data.heat.map((h) => [h.symbol, h]));
    for (const row of rows) bySymbol.set(row.symbol, row);
    data.heat = [...bySymbol.values()].sort((a, b) => b.score - a.score);
    this.write(data);
  }

  async listHeat(limit: number): Promise<HeatRow[]> {
    return this.read().heat.slice(0, limit);
  }

  async upsertCalendar(events: CalendarEvent[]): Promise<void> {
    const data = this.read();
    const byId = new Map(data.calendar.map((e) => [e.id, e]));
    for (const e of events) byId.set(e.id, e);
    data.calendar = [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
    this.write(data);
  }

  async listCalendar(limit: number): Promise<CalendarEvent[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.read()
      .calendar.filter((e) => e.date >= today)
      .slice(0, limit);
  }

  async pruneRetention(): Promise<void> {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const data = this.read();
    data.news = data.news.filter((n) => Date.parse(n.publishedAt) > cutoff);
    this.write(data);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

let db: Db | null = null;

export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (url) {
    const require = createRequire(import.meta.url);
    const { Pool } = require('pg') as typeof import('pg');
    db = new PgDb(new Pool({ connectionString: url, max: 8 }));
  } else {
    db = new FileDb(join(dataDir(), 'db.json'));
  }
  return db;
}

export function dbBackend(): 'postgres' | 'file' {
  return process.env.DATABASE_URL ? 'postgres' : 'file';
}
