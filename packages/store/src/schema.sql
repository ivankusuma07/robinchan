-- Robinchan — Postgres schema (dev brief §10).
-- Seven tables. Prices don't go into Postgres, Redis is enough.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  constraint wallet_lowercase check (wallet_address = lower(wallet_address))
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on chat_messages (user_id, created_at desc);

create table if not exists orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  side        text not null check (side in ('buy', 'sell')),
  symbol      text not null,
  qty         numeric not null check (qty > 0),
  limit_price numeric,
  status      text not null check (status in ('parsed', 'quoted', 'signed', 'failed', 'expired')),
  tx_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists orders_user_idx on orders (user_id, created_at desc);

create table if not exists news_items (
  id           text primary key,
  external_id  text not null unique,
  title_hash   text not null,
  cat          text not null check (cat in ('SEC', 'NEWS', 'CHAIN', 'SOCIAL')),
  title        text not null,
  short        text not null,
  symbols      text[] not null default '{}',
  sentiment    real not null default 0,
  url          text not null,
  source       text not null,
  pinned       boolean not null default false,
  published_at timestamptz not null
);
create index if not exists news_items_published_idx on news_items (published_at desc);
create index if not exists news_items_symbols_idx on news_items using gin (symbols);
create index if not exists news_items_title_hash_idx on news_items (title_hash, published_at desc);

create table if not exists heat_scores (
  symbol      text primary key,
  score       real not null,
  components  jsonb not null,
  computed_at timestamptz not null default now()
);
create index if not exists heat_scores_score_idx on heat_scores (score desc);

create table if not exists calendar_events (
  id       text primary key,
  date     date not null,
  title    text not null,
  subtitle text not null default '',
  kind     text not null check (kind in ('earnings', 'macro', 'chain')),
  symbol   text
);
create index if not exists calendar_events_date_idx on calendar_events (date asc);

create table if not exists watchlists (
  user_id  uuid not null references users(id) on delete cascade,
  symbol   text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- ---------------------------------------------------------------------------
-- Trade / Heat / Portfolio plan (robinchan-trade-heat-portfolio.md).
-- Every statement is idempotent: `migrate()` replays this whole file on boot.
-- ---------------------------------------------------------------------------

-- G1: fills, from the tx receipt once the server confirms the tx. Without
-- these, cost basis and PnL can't be computed from `qty` + `limit_price`.
alter table orders add column if not exists fill_price numeric(30,10);
alter table orders add column if not exists filled_qty numeric(30,10);
alter table orders add column if not exists fee_usd    numeric(20,6);
alter table orders add column if not exists filled_at  timestamptz;

-- G2: pending/confirmed txs, open limit orders, and cancellations. The
-- original five values are kept.
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in (
  'parsed', 'quoted', 'signed', 'pending', 'confirmed', 'open', 'cancelled', 'failed', 'expired'
));

create index if not exists orders_user_symbol_created_idx
  on orders (user_id, symbol, created_at);

-- Heat page (plan §4): per-component notes, the news items that drove the
-- news score, and the raw volume ratio used by the `volume` sort. Kept out
-- of `components` so that column keeps its original three-number shape.
alter table heat_scores add column if not exists detail jsonb;
