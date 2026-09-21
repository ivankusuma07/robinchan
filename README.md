# Robinchan

A Live2D character companion market for tokenized stocks on Robinhood Chain.

This implementation covers **M1 (static landing page)** and **M2 (live data)** from
`robinchan-dev-brief.md` §17. M3 (wallet, SIWE, chat streaming) and M4 (trading) are deliberately
not built yet — see [Scope boundaries](#scope-boundaries).

---

## Running it

Needs Node 20+.

```bash
npm install
cp .env.example .env        # everything can be left empty
npm run dev
```

Three processes run together: web at `http://localhost:3000`, the API at
`http://localhost:4000`, and the worker in the background. The Market page starts filling in
within the first ten seconds.

To populate data once without leaving the worker running continuously:

```bash
npm run once -w @robinchan/worker
```

Other commands: `npm run build`, `npm run typecheck`, `npm run lint`.

### Without Postgres and Redis

An empty `.env` means cache and database fall back to JSON files in `.data/`. This isn't
in-memory storage: the API and worker are two separate processes and need to keep seeing each
other's data.

Set `DATABASE_URL` and `REDIS_URL` to use the real thing — the code is the same, only the
implementation swaps out (`packages/store`). The Postgres schema lives in
`packages/store/src/schema.sql` and runs automatically when the API or worker starts.

### Without provider API keys

A provider without a key yet shows **gray ("not configured")** on the "Sources monitored" card,
not red — not being configured isn't a failure. In `RC_ENV=dev`, a provider that fails or isn't
configured is replaced with fake data that flags itself via the `source` field.

Keys that make the data real:

| Variable | Enables |
| --- | --- |
| `FINNHUB_API_KEY` | Prices, indices, news feed, earnings calendar |
| `SEC_EDGAR_USER_AGENT` | SEC filings (must include a reachable contact) |
| `YOUTUBE_API_KEY` | Active stream id per channel and Highlights clips |
| `NEXT_PUBLIC_RCHAN_ADDRESS` | $RCHAN price from DexScreener |

Without `YOUTUBE_API_KEY`, `videoId` is deliberately left empty so the frontend falls back to a
static poster + "Open on YouTube" button — a fallback path brief §6 actually requires, not a fake
id that would fail to load silently.

---

## Structure

```
apps/
  web/          Next.js 15 App Router — Home, Robinchan, Market
  api/          Fastify — REST, reads from cache and database only
  worker/       Cron — pulls from providers, writes to cache and database
packages/
  shared/       Types, constants, format utils (used by all three)
  store/        Cache and database behind one interface
```

`packages/store` is an addition beyond the structure the brief names in §2. Reason: the API and
worker both need cache and database access, and `packages/shared` must not pull `pg` or `ioredis`
into the frontend bundle.

The worker pulls data on its schedule and writes to cache and database. The API only reads — it
never calls a provider on an incoming request. Effect: pages stay fast, provider rate limits stay
safe, and if a provider goes down, the last known data still gets served with a `stale` flag.

---

## Live2D character

Model: [Zundamon](https://www.live2d.com/en/learn/sample/zundamon/), a Live2D Inc. sample model.
Runtime assets live in `apps/web/public/live2d/zundamon/`.

- The model path is read from `NEXT_PUBLIC_LIVE2D_MODEL_URL`, not hardcoded, so it can be swapped
  without changing code (brief §5).
- The product's expression map (`happy`, `focused`, `alert`, `relaxed`) is kept separate from the
  expression names inside `model3.json`, in
  `apps/web/src/components/live2d/expressions.ts`. Swapping the model means changing just that
  one table.
- Cubism Core loads from Live2D's official CDN — the package isn't published on npm.
- The `model3.json` copied into `public/` has content filled in for the `EyeBlink` and `LipSync`
  groups. Live2D ships them empty; without that, auto-blink and lip-sync have no parameters to
  drive.
- Without WebGL, the stage falls back to a static placeholder and the expression buttons are
  disabled.

**Licensing isn't settled.** The bundled `ReadMe.txt` says commercial use is allowed for
individuals and small businesses under agreed terms, while medium-to-large businesses are limited
to non-public testing. Separately, the Zundamon character has its own usage guidelines from the
Tohoku Zunko / Zundamon Project. Both need confirmation before production — see design.md §9.
Until that's settled, treat this asset as a placeholder. A copy of the original notice is at
`apps/web/public/live2d/zundamon/LICENSE-NOTICE.txt`.

---

## Scope boundaries

What's **not** built because it's outside M1–M2:

- `POST /api/chat`, `/api/order/*`, `/api/user/tier`, `/api/user/watchlist` — M3 and M4. The UI
  skeleton already exists (chat panel, tier cards, `<OrderPreviewCard>`) and renders in a disabled
  state with the reason stated, rather than looking active and failing silently when pressed.
- Wallet connect and SIWE — M3. The button already occupies its space in the topbar so the
  topbar's height doesn't shift when the feature turns on.
- The social component of heat score — phase 3. Its weight is redistributed proportionally to
  on-chain and news per brief §13, not left at zero.
- The buyback logging job — brief §14; not on the M2 list.

What needs deciding before M3 is listed in brief §18 ($RCHAN contract address, tier thresholds,
LLM provider).

### Technical notes

- **News sentiment** uses a lexicon score in `apps/worker/src/lib/sentiment.ts`. Alpha Vantage
  News Sentiment only lands in phase 2, while the sentiment dots and heat score's news component
  already need a number now.
- **Heat score gating** always treats requests as anonymous until real tier verification lands in
  M3. Returning a full score because a client claims to have a tier would make the gating fake.
- **`npm audit`** leaves two findings that can't be closed from here:
  `pixi-live2d-display` lists `gh-pages` as a dependency even though it's its own documentation
  deploy tool and is never imported from `dist/`; and the `postcss` bundled by Next is only fixed
  in Next 16, while the brief locks in Next 14+ with Tailwind v3.
