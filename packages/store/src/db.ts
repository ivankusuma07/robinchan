import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CalendarEvent,
  HeatComponentKey,
  HeatComponents,
  NewsItem,
  OrderSide,
  OrderStatus,
} from '@robinchan/shared';

import { dataDir } from './paths.js';

/** What the heat page needs beyond the three numbers (plan §4). */
export type HeatDetailData = {
  /** Plain-language reason per component, e.g. "Volume 1.6x the 20-day average". */
  notes: Record<HeatComponentKey, string>;
  /** `news_items` ids that fed the news component, newest first. */
  drivers: string[];
  /** Raw on-chain volume ratio vs the 20-day average, for the `volume` sort. */
  volumeRatio: number;
};

export type HeatRow = {
  symbol: string;
  score: number;
  components: HeatComponents;
  computedAt: string;
  /** Absent on rows written before the heat page shipped. */
  detail?: HeatDetailData;
};

export type NewsQuery = {
  limit: number;
  cat?: string;
  symbol?: string;
  pinnedOnly?: boolean;
};

/** A SIWE-verified wallet (brief §14). `walletAddress` is always lowercase. */
export type User = {
  id: string;
  walletAddress: string;
  createdAt: string;
  lastSeenAt: string;
};

/** One turn in `/api/chat`'s history (brief §5, §10 — stored server-side, not localStorage). */
export type ChatMessage = {
  id: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
};

/**
 * A trade order row (brief line 287 + the G1/G2 fill/status columns). The
 * quote itself — price, gas, fee, and its 30-second `expiresAt` — is never
 * stored here: it's short-lived and only ever meaningful within that
 * window, so it lives in the cache instead (`order.ts`'s quote route),
 * keyed by this row's id.
 */
export type Order = {
  id: string;
  userId: string;
  side: OrderSide;
  symbol: string;
  qty: number;
  limitPrice: number | null;
  status: OrderStatus;
  txHash: string | null;
  fillPrice: number | null;
  filledQty: number | null;
  feeUsd: number | null;
  filledAt: string | null;
  createdAt: string;
};

export interface Db {
  migrate(): Promise<void>;
  /** Returns the count of rows that were genuinely new after dedupe. */
  upsertNews(items: NewsItem[]): Promise<number>;
  listNews(query: NewsQuery): Promise<NewsItem[]>;
  /** Resolves heat drivers; unknown ids are skipped, order follows `ids`. */
  getNewsByIds(ids: string[]): Promise<NewsItem[]>;
  upsertHeat(rows: HeatRow[]): Promise<void>;
  listHeat(limit: number): Promise<HeatRow[]>;
  getHeat(symbol: string): Promise<HeatRow | null>;
  upsertCalendar(events: CalendarEvent[]): Promise<void>;
  listCalendar(limit: number): Promise<CalendarEvent[]>;
  /** Finds the user by address, creating one on first sign-in; always touches `last_seen_at`. */
  touchUser(walletAddress: string): Promise<User>;
  getUserByAddress(walletAddress: string): Promise<User | null>;
  insertChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage>;
  /** Oldest first — the order a transcript reads in. */
  listChatMessages(userId: string, limit: number): Promise<ChatMessage[]>;
  /** Oldest-added first. */
  listWatchlist(userId: string): Promise<string[]>;
  /** Replaces the whole set — matches `PUT /api/user/watchlist`'s semantics. */
  setWatchlist(userId: string, symbols: string[]): Promise<void>;
  /** Always starts `status: 'quoted'` — a row only ever exists once a quote has actually been built. */
  insertOrder(order: {
    userId: string;
    side: OrderSide;
    symbol: string;
    qty: number;
    limitPrice: number | null;
  }): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
  /** `quoted` → `signed`, with the hash the wallet returned. */
  recordOrderSignature(id: string, txHash: string): Promise<Order>;
  setOrderStatus(id: string, status: OrderStatus): Promise<void>;
  /** chat_messages 30 days, news_items 90 days (brief §10). */
  pruneRetention(): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * Providers often send the same story under a different id, so besides
 * `external_id` we store a hash of the normalized title and reject
 * duplicates within a 6-hour window (brief §10).
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

  async getNewsByIds(ids: string[]): Promise<NewsItem[]> {
    if (ids.length === 0) return [];
    const res = await this.pool.query('select * from news_items where id = any($1)', [ids]);
    const byId = new Map(res.rows.map((r: Record<string, unknown>) => [String(r.id), rowToNews(r)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  async upsertHeat(rows: HeatRow[]): Promise<void> {
    for (const row of rows) {
      await this.pool.query(
        `insert into heat_scores (symbol, score, components, computed_at, detail)
         values ($1,$2,$3,$4,$5)
         on conflict (symbol) do update
           set score = excluded.score,
               components = excluded.components,
               computed_at = excluded.computed_at,
               detail = excluded.detail`,
        [
          row.symbol,
          row.score,
          JSON.stringify(row.components),
          row.computedAt,
          row.detail ? JSON.stringify(row.detail) : null,
        ],
      );
    }
  }

  async listHeat(limit: number): Promise<HeatRow[]> {
    const res = await this.pool.query('select * from heat_scores order by score desc limit $1', [
      limit,
    ]);
    return res.rows.map(rowToHeat);
  }

  async getHeat(symbol: string): Promise<HeatRow | null> {
    const res = await this.pool.query('select * from heat_scores where symbol = $1', [symbol]);
    return res.rows[0] ? rowToHeat(res.rows[0]) : null;
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

  async touchUser(walletAddress: string): Promise<User> {
    const address = walletAddress.toLowerCase();
    const res = await this.pool.query(
      `insert into users (wallet_address)
       values ($1)
       on conflict (wallet_address) do update set last_seen_at = now()
       returning *`,
      [address],
    );
    return rowToUser(res.rows[0]);
  }

  async getUserByAddress(walletAddress: string): Promise<User | null> {
    const res = await this.pool.query('select * from users where wallet_address = $1', [
      walletAddress.toLowerCase(),
    ]);
    return res.rows[0] ? rowToUser(res.rows[0]) : null;
  }

  async insertChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const res = await this.pool.query(
      `insert into chat_messages (user_id, role, content) values ($1,$2,$3) returning *`,
      [msg.userId, msg.role, msg.content],
    );
    return rowToChatMessage(res.rows[0]);
  }

  async listChatMessages(userId: string, limit: number): Promise<ChatMessage[]> {
    const res = await this.pool.query(
      `select * from chat_messages where user_id = $1 order by created_at desc limit $2`,
      [userId, limit],
    );
    return res.rows.map(rowToChatMessage).reverse();
  }

  async listWatchlist(userId: string): Promise<string[]> {
    const res = await this.pool.query(
      'select symbol from watchlists where user_id = $1 order by added_at asc',
      [userId],
    );
    return res.rows.map((r: Record<string, unknown>) => String(r.symbol));
  }

  async setWatchlist(userId: string, symbols: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query('delete from watchlists where user_id = $1', [userId]);
      for (const symbol of symbols) {
        await client.query(
          'insert into watchlists (user_id, symbol) values ($1, $2) on conflict do nothing',
          [userId, symbol],
        );
      }
      await client.query('commit');
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  }

  async insertOrder(order: {
    userId: string;
    side: OrderSide;
    symbol: string;
    qty: number;
    limitPrice: number | null;
  }): Promise<Order> {
    const res = await this.pool.query(
      `insert into orders (user_id, side, symbol, qty, limit_price, status)
       values ($1,$2,$3,$4,$5,'quoted')
       returning *`,
      [order.userId, order.side, order.symbol, order.qty, order.limitPrice],
    );
    return rowToOrder(res.rows[0]);
  }

  async getOrder(id: string): Promise<Order | null> {
    const res = await this.pool.query('select * from orders where id = $1', [id]);
    return res.rows[0] ? rowToOrder(res.rows[0]) : null;
  }

  async recordOrderSignature(id: string, txHash: string): Promise<Order> {
    const res = await this.pool.query(
      `update orders set status = 'signed', tx_hash = $2 where id = $1 returning *`,
      [id, txHash],
    );
    return rowToOrder(res.rows[0]);
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<void> {
    await this.pool.query('update orders set status = $2 where id = $1', [id, status]);
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

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    walletAddress: String(r.wallet_address),
    createdAt: new Date(r.created_at as string).toISOString(),
    lastSeenAt: new Date(r.last_seen_at as string).toISOString(),
  };
}

function rowToOrder(r: Record<string, unknown>): Order {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    side: r.side as OrderSide,
    symbol: String(r.symbol),
    qty: Number(r.qty),
    limitPrice: r.limit_price != null ? Number(r.limit_price) : null,
    status: r.status as OrderStatus,
    txHash: (r.tx_hash as string | null) ?? null,
    fillPrice: r.fill_price != null ? Number(r.fill_price) : null,
    filledQty: r.filled_qty != null ? Number(r.filled_qty) : null,
    feeUsd: r.fee_usd != null ? Number(r.fee_usd) : null,
    filledAt: r.filled_at ? new Date(r.filled_at as string).toISOString() : null,
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function rowToChatMessage(r: Record<string, unknown>): ChatMessage {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    role: r.role as ChatMessage['role'],
    content: String(r.content),
    createdAt: new Date(r.created_at as string).toISOString(),
  };
}

function rowToHeat(r: Record<string, unknown>): HeatRow {
  return {
    symbol: String(r.symbol),
    score: Number(r.score),
    components: r.components as HeatComponents,
    computedAt: new Date(r.computed_at as string).toISOString(),
    ...(r.detail ? { detail: r.detail as HeatDetailData } : {}),
  };
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
/* File fallback — used when DATABASE_URL is empty                     */
/* ------------------------------------------------------------------ */

type StoredNews = NewsItem & { hash: string };

type FileShape = {
  news: StoredNews[];
  heat: HeatRow[];
  calendar: CalendarEvent[];
  users: User[];
  chatMessages: ChatMessage[];
  /** userId -> symbols, oldest-added first. */
  watchlists: Record<string, string[]>;
  orders: Order[];
};

class FileDb implements Db {
  private readonly file: string;

  constructor(file: string) {
    this.file = file;
    mkdirSync(dirname(file), { recursive: true });
  }

  private read(): FileShape {
    try {
      const data = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<FileShape>;
      // `users`/`chatMessages`/`watchlists`/`orders` are newer than this
      // file format; old `.data/db.json` files won't have them yet.
      return {
        news: [],
        heat: [],
        calendar: [],
        users: [],
        chatMessages: [],
        watchlists: {},
        orders: [],
        ...data,
      };
    } catch {
      return {
        news: [],
        heat: [],
        calendar: [],
        users: [],
        chatMessages: [],
        watchlists: {},
        orders: [],
      };
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

  async getNewsByIds(ids: string[]): Promise<NewsItem[]> {
    const byId = new Map(this.read().news.map((n) => [n.id, n]));
    return ids.flatMap((id) => {
      const hit = byId.get(id);
      return hit ? [FileDb.strip(hit)] : [];
    });
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

  async getHeat(symbol: string): Promise<HeatRow | null> {
    return this.read().heat.find((h) => h.symbol === symbol) ?? null;
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

  async touchUser(walletAddress: string): Promise<User> {
    const address = walletAddress.toLowerCase();
    const data = this.read();
    const existing = data.users.find((u) => u.walletAddress === address);
    const now = new Date().toISOString();
    if (existing) {
      existing.lastSeenAt = now;
      this.write(data);
      return existing;
    }
    const created: User = { id: randomUUID(), walletAddress: address, createdAt: now, lastSeenAt: now };
    data.users.push(created);
    this.write(data);
    return created;
  }

  async getUserByAddress(walletAddress: string): Promise<User | null> {
    const address = walletAddress.toLowerCase();
    return this.read().users.find((u) => u.walletAddress === address) ?? null;
  }

  async insertChatMessage(msg: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const data = this.read();
    const created: ChatMessage = { id: randomUUID(), createdAt: new Date().toISOString(), ...msg };
    data.chatMessages.push(created);
    this.write(data);
    return created;
  }

  async listChatMessages(userId: string, limit: number): Promise<ChatMessage[]> {
    return this.read()
      .chatMessages.filter((m) => m.userId === userId)
      .slice(-limit);
  }

  async listWatchlist(userId: string): Promise<string[]> {
    return this.read().watchlists[userId] ?? [];
  }

  async setWatchlist(userId: string, symbols: string[]): Promise<void> {
    const data = this.read();
    data.watchlists[userId] = [...new Set(symbols)];
    this.write(data);
  }

  async insertOrder(order: {
    userId: string;
    side: OrderSide;
    symbol: string;
    qty: number;
    limitPrice: number | null;
  }): Promise<Order> {
    const data = this.read();
    const created: Order = {
      id: randomUUID(),
      userId: order.userId,
      side: order.side,
      symbol: order.symbol,
      qty: order.qty,
      limitPrice: order.limitPrice,
      status: 'quoted',
      txHash: null,
      fillPrice: null,
      filledQty: null,
      feeUsd: null,
      filledAt: null,
      createdAt: new Date().toISOString(),
    };
    data.orders.push(created);
    this.write(data);
    return created;
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.read().orders.find((o) => o.id === id) ?? null;
  }

  async recordOrderSignature(id: string, txHash: string): Promise<Order> {
    const data = this.read();
    const order = data.orders.find((o) => o.id === id);
    if (!order) throw new Error(`no such order: ${id}`);
    order.status = 'signed';
    order.txHash = txHash;
    this.write(data);
    return order;
  }

  async setOrderStatus(id: string, status: OrderStatus): Promise<void> {
    const data = this.read();
    const order = data.orders.find((o) => o.id === id);
    if (!order) return;
    order.status = status;
    this.write(data);
  }

  async pruneRetention(): Promise<void> {
    const chatCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const data = this.read();
    data.chatMessages = data.chatMessages.filter((m) => Date.parse(m.createdAt) > chatCutoff);
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
