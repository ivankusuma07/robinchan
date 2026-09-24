# Implementation Plan — Heat, Portfolio & Trade pages

Sources:
- `robinchan-dev-brief.md` (main brief, 21 Sep 2026): the base contract
- `robinchan-trade-heat-portfolio.en.md` (page brief, 24 Sep 2026): the three SOON pages

**Current state:** M1 (static landing) and M2 (live data: API, worker, Postgres, Redis, providers, heat score without social) are done.

---

## 1. How the three pages fit the existing milestones

The page brief's order (Heat → Portfolio → Trade) still holds. However, each page depends on a milestone that isn't built yet:

| Page | Needs from main brief | Earliest start |
| --- | --- | --- |
| Heat, no-wallet view | M2 (heat score, news, `/api/heat`) ✅ | **Now** |
| Heat, wallet and tier views | M3 (SIWE, `/api/user/tier`, watchlist) | After M3 auth |
| Heat, Robinchan reads | LLM provider (open decision #6) | After the LLM is chosen, which M3 chat needs anyway |
| Portfolio | M3 (SIWE, users, tier), plus `orders` data from M4 for PnL | Layout and holdings after M3; PnL "via Robinchan" becomes real once M4 records fills |
| Trade | M4 pipeline (`/api/order/parse`, `quote`, `record`) | Build as part of M4, behind `FEATURE_TRADING` |
| Robinchan avatar on every page | M3 `<ChatPanel>` + `/api/chat` | After M3 chat |

**Resulting sequence:**

1. **H1: Heat public view** (now, parallel with M3 start)
2. **M3: Wallet & chat** (from the main brief) + chat `pageContext`
3. **H2: Heat gated views + reads**
4. **P1: Portfolio**
5. **M4: Trading pipeline + Trade page**, as one milestone, flag off

---

## 2. Gaps between the two briefs (fix before building)

Mismatches that will cause bugs or rework if not settled first. Suggested resolutions are included; flag any to Bix that change product behavior.

| # | Gap | Why it matters | Suggested resolution |
| --- | --- | --- | --- |
| G1 | `orders` has no fill price, filled qty, or fee | Cost basis and PnL (page brief §8) can't be computed from `qty` + `limit_price` alone | Add `fill_price`, `filled_qty`, `fee_usd`, `filled_at`, populated from the tx receipt when the server confirms the tx |
| G2 | `orders.status` enum is `parsed, quoted, signed, failed, expired` | Trade needs pending/confirmed txs, open limit orders, and cancelled orders | Extend with `pending`, `confirmed`, `open`, `cancelled` (keep existing values) |
| G3 | Prices live only in Redis (TTL 30s), with no history | Trade candles, Heat 7-day sparklines, and Portfolio 24h change all need past prices | Candles come from a provider (GeckoTerminal/DexScreener OHLCV for RH Chain tokens), cached in Redis per `symbol:interval`. No price table in Postgres. |
| G4 | Endpoint naming: main uses `/api/order/*` (singular), page brief adds `/api/orders` (plural) | Two prefixes for one resource | Keep `/api/order/parse,quote,record` as-is (already specced for M4). Add the list and cancel routes as `/api/order` (GET) and `/api/order/:id/cancel` for consistency. Low risk either way, just pick one. |
| G5 | Heat social component: main brief redistributes weights; page brief shows `social: null` | Not a conflict, but both must hold | Score uses the redistributed weights (0.5625 / 0.4375) while `FEATURE_SOCIAL_HEAT=false`. `components.social = { score: null, reason: "not_active" }`. |
| G6 | Heat gating: main brief has 2 levels, page brief has 3 (no wallet / wallet / Tier 1) | Different `/api/heat` behavior | Use the page brief's 3 levels for both `/api/heat` and `/api/heat/full`. The Home panel (`limit=5`) is unaffected. |
| G7 | Limit orders are Tier 3 in the main brief; the page brief doesn't mention tier | Trade ticket's Limit tab needs gating | Show the Limit tab with `TierGate` (Tier 3), blurred, with a label |
| G8 | Order history retention (page brief open Q5) | Main brief already says `orders` is kept forever | Q5 is only about the **display** window. Paginate everything for now. |
| G9 | Portfolio 24h change: "price 24h ago" isn't stored | Same root cause as G3 | Use the 24h change from the quote provider, or the 1h candle from 24h ago |

---

## 3. Shared work (do alongside M3)

### Web (`apps/web`)

- [ ] `<DataBlock>` wrapper for the four states: `loading | empty | error | stale`. Reuse the existing `stale` dimming from M2 so Market and the new pages look the same.
- [ ] Skeletons sized to real content, with no layout shift
- [ ] `<WalletGate>`: real layout with blurred sample data and a centered RainbowKit connect button
- [ ] `<TierGate requiredTier>`: blurred content plus a tier label, via a single `useTier()` hook on `/api/user/tier`
- [ ] Floating Robinchan avatar (bottom-right) that opens the **same** `<ChatPanel>` from `/robinchan`: one chat, one history
- [ ] Sidebar: switch `/heat`, `/portfolio`, and `/trade` from disabled to enabled per page flag, and remove the SOON badge when a page is enabled
- [ ] Reuse the existing Tailwind tokens: "mint" = `accent`/`up`, "salmon" = `down` (`#FF8080`). No new colors.

### API (`apps/api`)

- [ ] `/api/chat` accepts `pageContext` metadata: `{ page, symbol?, rowSymbol?, portfolioSummary? }`, injected as delimited **data**, not instructions (main brief §15)
- [ ] `tierFilter(data, level)` helper for server-side gating
- [ ] Zod schemas for every new route, in `packages/shared`
- [ ] Every new route keeps the `{ data, stale, asOf }` envelope and uppercase error codes

### Config (`.env`)

```bash
FEATURE_HEAT_PAGE=false
FEATURE_PORTFOLIO_PAGE=false
# Trade page reuses FEATURE_TRADING
HEAT_FULL_MIN_TIER=1          # page brief open Q4
HEAT_READ_TOP_N=20
PORTFOLIO_DUST_USD=1
PORTFOLIO_SHOW_UNSUPPORTED=true   # page brief open Q6
```

---

## 4. H1 — Heat public view (start now)

Needs nothing beyond M2.

### Worker

- [ ] Enrich `heat_scores.components` with a per-component `note` (e.g. "Volume 3.2x the 20-day average") and `news.drivers` (IDs of `news_items`)
- [ ] Write `social` as `null` + reason (G5)
- [ ] Keep the 7-day sparkline data available: a small Redis series per symbol, or candles (G3)

### API

- [ ] Extend `GET /api/heat` with 3-level gating (G6). No-wallet behavior stays the same, so Home is unaffected.
- [ ] `GET /api/heat/full?filter=&sort=&page=`: 25 per page. Filters: `all | tokenized | rh_token | watchlist`. Sort: `score | change | volume`.
- [ ] `GET /api/heat/:symbol`: breakdown, drivers resolved to `{ title, publishedAt, url, source }`, and the read if it exists
- [ ] Locked rows returned as `{ rank, locked: true, requiredTier }` with no symbol or score, so nothing leaks in the network tab
- [ ] Redis cache `rc:heat:full:<filter>:<sort>:<page>:<level>`, invalidated on each heat recompute
- [ ] Rate limit: public 60/min/IP (existing rule)

### Web: `/heat`

- [ ] Header (last computed, refresh), filter chips, sort, list, pagination
- [ ] Collapsed row: rank · symbol · heat bar · score · three mini bars · price/24h · sparkline
- [ ] `null` component shown as a grey bar with "not active yet"
- [ ] No-wallet view: top 5, scores rounded, rows not expandable, the rest blurred behind `<WalletGate>`
- [ ] Watchlist chip hidden until M3

**Done when:** `/heat` works publicly without a wallet, and turning off one provider still renders a stale board.

---

## 5. M3 — Wallet & chat (main brief, unchanged)

Build as specced in the main brief §17. Additions for the new pages:

- [ ] Chat accepts `pageContext`
- [ ] Heat read prompt and Portfolio read prompt share the chat's LLM adapter

### LLM: DeepSeek (decided 24 Sep 2026, replaces Claude Haiku 4.5)

DeepSeek's API, which is OpenAI-compatible, via one adapter in `apps/api/src/llm/client.ts`. The provider is configuration (`LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`); no page or route names it. The account exposes `deepseek-flash` (V4.1 Flash) and `deepseek-v4-pro`.

One pinned model for every job. Parsing is testable and consistent (temperature 0 + forced tool call), and the M4 30-sentence test applies directly.

| Job | Model | Settings |
| --- | --- | --- |
| Order parsing (`/api/order/parse`) | `deepseek-flash` | Forced tool call with the intent schema, `temperature: 0`, **thinking mode off** |
| Chat replies | `deepseek-flash` | Streaming through SSE |
| Heat reads, Portfolio reads | `deepseek-flash` | Short `max_tokens`, generated by the worker |

**Provider quirk:** DeepSeek's thinking (reasoning) mode rejects a forced `tool_choice` ("Thinking mode does not support this tool_choice"). Parsing therefore sends `thinking: { type: "disabled" }`, which also keeps it fast (~0.7s against the 8s adapter timeout). The quirk lives in the adapter only.

```bash
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com
LLM_API_KEY=
LLM_MODEL=deepseek-flash
# Optional: a stronger model for parsing only (e.g. deepseek-v4-pro)
LLM_MODEL_PARSE=
```

- [x] One adapter in `apps/api` with the existing timeout, retry, and circuit breaker rules (main brief §11). The breaker moved to `@robinchan/store` so the worker and API share it; 4xx responses aren't retried. It reports as the `llm` row on `/api/sources/status`.
- [x] Parse: the intent is a tool, and its output is validated with the same Zod schema (`orderToolOutput`) before use. Beyond the plan: the model also quotes the user's words for each value, and `grounding.ts` rejects anything not traceable to the sentence (a qty or price not typed, a symbol not named, a side no buy/sell word backs, an unused number, a money amount read as shares, "1,500" read either way). Those become questions back, never guesses.
- [x] M4 30-sentence test run early: **30/30** (16 exact parses, 11 asked back, 3 recognised as non-orders), **0 silent misparses**, stable across two runs. `npm run eval:parse -w @robinchan/api`. Measured ~1,200 input and ~190 output tokens per parse.
- [ ] The model knows nothing about current prices or news. Every read and chat answer must use data injected from Redis/Postgres, wrapped as delimited **data** (main brief §15). Add a prompt rule not to state market facts that aren't in the context.
- [x] Log token usage per job to watch cost (`llm_usage` lines in the API log).
- [ ] **Data residency:** prompts (chat messages, portfolio context for reads) are processed on DeepSeek's servers in China. Bix to confirm this is acceptable alongside the regulatory answers (#12).
- [ ] `POST /api/order/parse` is not exposed yet: a public endpoint that calls a paid LLM needs the M3 session and the per-address rate limit first.

### Cost check: Heat reads

As specced, the worker regenerates reads for the top 20 symbols every 5 minutes. That is about 5,760 calls a day, at roughly 1,500 input and 150 output tokens per read — ~8.6M input and ~0.9M output tokens a day before any chat traffic. (The $13/day figure here was Haiku pricing; re-price against DeepSeek's current rates before launch. The call volume is the thing to cut either way.)

Cut this before launch:

- [ ] Regenerate a read only when that symbol's score or rank changes meaningfully (e.g. ±5 points or a rank shift), not on every recompute
- [ ] Add a minimum age per read (e.g. 30 min), unless its drivers change
- [ ] Keep the system prompt identical across calls so prompt caching can apply if it's long enough

These cuts are likely to reduce reads by an order of magnitude.
- [ ] Guardrail for all "read" outputs: describe conditions, never recommend. Add a simple post-check that rejects outputs containing buy/sell/should/recommend phrasing and regenerates once, else hides the section.

---

## 6. H2 — Heat gated views & Robinchan reads

### Database

```sql
create table heat_reads (
  symbol       text primary key,
  text         text not null,
  computed_at  timestamptz not null default now()
);
```

### Worker

- [ ] Heat reads job runs after each heat recompute (5 min), for the top `HEAT_READ_TOP_N` only, and upserts
- [ ] On-demand read for symbols outside the top N: queued, deduped in Redis, stored

### API & web

- [ ] Wallet level: top 15, full score, expandable rows
- [ ] Tier ≥ `HEAT_FULL_MIN_TIER`: full list, drivers, read, watchlist filter
- [ ] Expanded row (one open at a time): full bars + notes, triggers with links, read (hidden if absent), and "Ask Robinchan" / "Open in Trade" (the latter only when `FEATURE_TRADING` is on)
- [ ] Review a sample of generated reads with Bix before enabling `FEATURE_HEAT_PAGE` in production

**Done when:** someone understands within 10 seconds why a symbol has its rank, and opening a row never calls the LLM.

---

## 7. P1 — Portfolio

### Database

```sql
create table portfolio_snapshots (
  user_id          uuid not null references users(id),
  date             date not null,
  total_value_usd  numeric(20,6) not null,
  holdings         jsonb not null,
  primary key (user_id, date)
);

create table cost_basis_overrides (
  user_id     uuid not null references users(id),
  symbol      text not null,
  avg_price   numeric(30,10) not null check (avg_price > 0),
  updated_at  timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- G1 + G2: needed by both Portfolio and Trade
alter table orders
  add column fill_price  numeric(30,10),
  add column filled_qty  numeric(30,10),
  add column fee_usd     numeric(20,6),
  add column filled_at   timestamptz;
-- extend status check: + 'pending','confirmed','open','cancelled'

create index if not exists orders_user_symbol_created_idx
  on orders (user_id, symbol, created_at);
```

### Cost basis module (`packages/shared/portfolio/costBasis.ts`)

- [ ] Priority: manual override, then confirmed Robinchan orders (`fill_price`, `filled_qty`), then unknown. **Never** fall back to first-seen price.
- [ ] Output per holding: `{ basis: 'full' | 'partial' | 'none', avgPrice?, knownQty, pnl?, pnlPct? }`
- [ ] Total PnL counts only known portions and returns `excludedCount`
- [ ] Unit tests: all-Robinchan, mixed, external-only, sold more than bought via Robinchan, transfer-in, manual override

### Worker

- [ ] Daily snapshot at 00:00 UTC for active users (connected + seen within N days), balances read in batches via viem multicall, per-user failures skipped
- [ ] Add the snapshot job's last-run age to `/api/health`

### API

- [ ] `GET /api/portfolio`: holdings sorted by value, <$`PORTFOLIO_DUST_USD` grouped into `other`, unsupported tokens in a separate section (Q6 toggle), tiles, `excludedCount`
- [ ] `GET /api/portfolio/history?range=24h|7d|30d|all`: 24h from live prices (G9), the rest from snapshots starting at the first snapshot date
- [ ] `PUT /api/portfolio/cost-basis`
- [ ] `GET /api/order?status=`, shared with Trade
- [ ] Wallet rate limit: 20/min/address (existing rule)

### Web: `/portfolio`

- [ ] `<WalletGate>` wrapper
- [ ] Three stat tiles (JetBrains Mono, `up`/`down` colors, no arrows) + "Excludes N assets without a purchase price"
- [ ] Single-line `accent` chart with a gradient, starting at the first snapshot
- [ ] Holdings table: blank average price and "—" PnL when unknown, with an inline cost-basis input
- [ ] Expandable "Other" row
- [ ] Shared `<OrderHistory>` component (reused in the Trade tab)
- [ ] Robinchan read card that describes and never advises
- [ ] Empty state linking to `/market`

**Done when:** a testnet wallet holding a mix of Robinchan-bought and external assets displays with zero fabricated PnL.

---

## 8. M4 + Trade page (behind `FEATURE_TRADING`)

The main brief's M4 is the pipeline; the Trade page is a second front end for it. Build them together so there is only ever one order path.

### Pipeline (main brief §12, plus these additions)

- [ ] The form builds the same intent object that `/api/order/parse` returns, then calls the same `/api/order/quote` → sign → `/api/order/record`
- [ ] Quote bound to the SIWE address; switching wallets invalidates it
- [ ] Server-side tx tracking: the worker polls receipts, sets `confirmed`/`failed`, and fills G1 columns
- [ ] Stuck longer than 2 min: expose speed-up/cancel (replacement tx, same nonce)
- [ ] Contract-level slippage (open decision: default value)
- [ ] Limit orders (Tier 3): the executor depends on main brief open decision #1. If a bot is needed, a 30s monitor job executes orders and queues a Robinchan notification for the next session.

### API

- [ ] `GET /api/market/candles/:symbol?interval=&from=&to=` (G3)
- [ ] `POST /api/order/:id/cancel` (G4)
- [ ] All trade routes return 404 while `FEATURE_TRADING=false`

### Web: `/trade/[symbol]`

- [ ] Symbol header · `lightweight-charts` (736px) · sticky ticket (360px) · bottom tabs
- [ ] Six intervals (limited to what the provider supports), last choice saved in `localStorage`, active limit orders drawn as price lines
- [ ] Ticket: Buy/Sell, Market/Limit (Limit behind `TierGate` Tier 3, per G7), amount with 25/50/75/Max, summary, sign button
- [ ] Reuse `<OrderPreviewCard>`'s countdown and quote-expiry logic; don't write a second copy
- [ ] Inline validation: empty, balance, >20% deviation checkbox, not tradable, insufficient gas
- [ ] Line under the button: *"Robinchan builds the order. You sign it."*
- [ ] Tabs: Open orders (cancel) · History (`<OrderHistory>`) · Positions

### Tests

- [ ] Main brief M4 target: 30 command sentences, at least 28 parsed correctly or asked back, **zero** silently misparsed
- [ ] The same order via chat and via form produces identical calldata (snapshot test)
- [ ] All six edge cases in page brief §4, on testnet

**Done when:** the full flow works on testnet from both chat and form, and the flag stays off in production until the regulatory answers arrive.

---

## 9. Open decisions (merged)

| # | Question | Owner | Blocks | Source |
| --- | --- | --- | --- | --- |
| 1 | Contract address for $RCHAN + treasury | Bix | M3, P1 | Main #2 |
| 2 | Tier balance thresholds | Bix | M3, H2 | Main #3 |
| 3 | Tier needed for full Heat | Bix | H2 (default: Tier 1) | Page #4 |
| 4 | ~~LLM provider~~ **Decided:** DeepSeek (`deepseek-flash`) for all jobs, replacing Haiku 4.5 (§5) | — | — | Main #6 |
| 5 | Portfolio: all tokens or supported only | Bix | P1 (default: all, split) | Page #6 |
| 6 | Order history display window | Bix | P1 (default: paginate all) | Page #5 |
| 7 | Limit-order primitive vs. backend bot | Dev research | M4 limit orders | Main #1, Page #2 |
| 8 | Chart intervals available from the provider | Dev research | Trade chart | Page #1 |
| 9 | Execution DEX + ABI | Bix + dev | M4 | Main #4 |
| 10 | Protocol fee | Bix | M4 | Main #5 |
| 11 | Default slippage; user-adjustable? | Bix | M4 | Page #3 |
| 12 | Regulatory answers (3 points) | Bix + counsel | Trading in production | Main #8 |
| 13 | Schema additions G1/G2 and endpoint naming G4 | Dev (confirm with Bix) | P1, M4 | This plan |

**Can start today:** H1 (Heat public view), the shared components, the `orders` migration (G1/G2), and the candle provider spike (G3). Send decisions 1–3 to Bix now, because they gate M3. The LLM choice is settled (DeepSeek); the adapter and the parse test harness are built, and the 30-sentence target is met.
