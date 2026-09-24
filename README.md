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

Other commands: `npm run build`, `npm run typecheck`, `npm run lint`,
`npm test -w @robinchan/shared` (cost-basis unit tests), `npm test -w @robinchan/api` (order-parse
guard tests), and `npm run eval:parse -w @robinchan/api` — the M4 30-sentence parse target against
the live LLM (needs `LLM_API_KEY`; exits non-zero if the target is missed).

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
| `ALPHAVANTAGE_API_KEY` | Backup quote source — tried only for whatever symbol Finnhub didn't return a price for, never the full list on every cycle (its free-tier quota is much tighter than Finnhub's) |
| `SEC_EDGAR_USER_AGENT` | SEC filings (must include a reachable contact) |
| `YOUTUBE_API_KEY` | Highlights clips only |
| `NEXT_PUBLIC_RCHAN_ADDRESS` | $RCHAN price from DexScreener |

The live broadcast card doesn't use this key at all: it embeds
`youtube.com/embed/live_stream?channel=<channelId>`, YouTube's own parameter for "whatever is
live on this channel right now," resolved on YouTube's end — no API key, no quota, and no
server-side "which video id is live" lookup. If the embed itself fails to load, the frontend falls
back to a static poster + "Open on YouTube" button.

---

## Structure

```
apps/
  web/          Next.js 15 App Router — Home, Robinchan, Market, and flag-gated Heat/Portfolio/Trade
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

## Voice (VOICEVOX)

Robinchan reads her chat replies out loud in Zundamon's VOICEVOX voice, with the mouth driven by
the audio's amplitude. Behind `FEATURE_VOICE`; off by default for each viewer — the stage's
**Voice** toggle switches it on and the choice is remembered.

Needs a self-hosted VOICEVOX engine:

```bash
docker run -d --name voicevox -p 50021:50021 voicevox/voicevox_engine:cpu-latest
```

then `VOICEVOX_ENDPOINT=http://localhost:50021` and `FEATURE_VOICE=true` in `.env`. The engine takes
a few seconds to load its voices after starting.

**On a server:** the engine has no authentication, and its admin endpoints (settings, user
dictionary) are open to anyone who can reach it. Bind it to localhost and put a reverse proxy in
front that only forwards requests carrying a secret `X-Voice-Key` header; set the same value as
`VOICEVOX_KEY` on the API. With Caddy:

```
voice.example.com {
    @allowed header X-Voice-Key YOUR_KEY
    handle @allowed {
        reverse_proxy 127.0.0.1:50021
    }
    respond 403
}
```

It's CPU-bound: synthesis time scales with cores, and the API gives each chunk 8 seconds.

How it fits together:

- `POST /api/tts` (wallet-gated, like chat — the Voice tier card is the free tier) takes up to 300
  characters and returns `audio/wav`. Not in the brief's endpoint table; it was added with the
  feature. VOICEVOX health shows on the Sources card like any other provider.
- The client speaks each finished reply in sentence-sized chunks (`splitForSpeech` in
  `packages/shared`), synthesizing the next chunk while the current one plays. Measured locally:
  first words about 3s after a reply finishes, then continuous.
- VOICEVOX is a Japanese engine. It turns most English into katakana on its own, but reads digits
  as Japanese numbers, spells out contractions, and spells a few common words as letters. The API
  rewrites text before synthesis (`apps/api/src/voice/voicevoxText.ts`): numbers, `%` and `$`
  become English words, contractions are expanded, and words the engine misreads get a katakana
  spelling. Find new misreads with `npm run probe:voice -w @robinchan/api` (needs a running
  engine) rather than by ear. Expect a strong Japanese accent regardless — that's the engine.
- VOICEVOX's terms require crediting the voice (`VOICEVOX:ずんだもん`); the stage shows it whenever
  voice is on. If the character changes, change `VOICEVOX_SPEAKER`, `NEXT_PUBLIC_VOICE_CREDIT`
  and `NEXT_PUBLIC_LIVE2D_MODEL_URL` together.
- If the engine is down, she stays silent, the mouth stays idle, and the stage says voice is
  unavailable (brief §5).

---

## Heat, Portfolio & Trade

Built from `robinchan-trade-heat-portfolio.md`, as far as the current milestones allow. Each page
is behind a flag in the root `.env` (all `false` by default); the web app reads the `FEATURE_*`
keys from that same file, so a page and its endpoints switch on together, and the sidebar item
turns from "Soon" into a link.

| Page | Flag | State |
| --- | --- | --- |
| `/heat` | `FEATURE_HEAT_PAGE` | **H1 done.** Public view: top 5, scores rounded ×10, the rest locked behind the wallet gate. Filters, sort, pagination, 7-day sparklines. |
| `/portfolio` | `FEATURE_PORTFOLIO_PAGE` | Real layout behind the wallet gate (blurred sample). Data needs SIWE (M3). |
| `/trade/[symbol]` | `FEATURE_TRADING` | Live chart and quote; ticket with inline validation. Quote, sign, and record need M3 + M4. |

New endpoints: `GET /api/heat/full`, `GET /api/heat/:symbol`, `GET /api/market/candles/:symbol`.
Gating is decided on the server (`apps/api/src/lib/access.ts`) — every caller is `public` until M3
adds a session, and locked heat rows carry only their rank, never a symbol or score.

Also in place for later milestones: the `orders` G1/G2 migration (fill columns, extended status),
the cost-basis module (`packages/shared/src/portfolio/costBasis.ts`, never guesses a purchase
price), `<WalletGate>` / `<TierGate>` / `<DataBlock>`, and the shared `<OrderHistory>`.

Candles come from fixtures in `dev` only; a real OHLCV source needs the RH Chain pool addresses
(plan G3 / open decision #8), and until then non-dev environments show an empty chart rather
than an invented one.

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

What needs deciding before M3 is listed in brief §18 ($RCHAN contract address, tier thresholds).
The LLM provider is decided — DeepSeek, behind one adapter in `apps/api/src/llm/`; the order parser
already meets the M4 30-sentence target (see `robinchan-trade-heat-portfolio.md` §5).

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
