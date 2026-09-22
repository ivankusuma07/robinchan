# Robinchan — Design Direction

**Companion-forward** · character: Zundamon (VOICEVOX Live2D sample model) · derived from `robinchan-dev-brief.md` · 21 September 2026

This file translates the dev brief's design tokens and layout rules into a concrete visual direction for implementation. It is a working spec, not the final artboards — when Bix shares the canvas (`Main.dc.html`, `Character.dc.html`, `Market.dc.html`, `Mobile.dc.html`), those are the source of truth for exact spacing/sizing. This doc governs everything the artboards don't pin down: motion, personality, and how the character's presence should read across the whole shell, not just the `/robinchan` page.

---

## 1. Direction

**Companion-forward, anchored to Zundamon.** With the character now picked — [Zundamon](https://www.live2d.com/en/learn/sample/zundamon/), the free VOICEVOX mascot — the companion-forward direction isn't just a stylistic choice, it's a match to the character's actual design:

- Zundamon's palette is green-and-white with pink as a warm secondary accent (rosy cheeks, ribbon, boot soles) — this lines up almost exactly with the brief's existing `accent: #7BE07B`. No token changes needed; the brand color and the character color were already the same family.
- Her silhouette is soft, round, "mochi"-like, with rounded overalls, puffed sleeves, and edamame-pod-shaped ear antennae — this directly supports the pill/rounded-card language in §2 below, rather than being decoration layered on top of an unrelated shape system.
- She's a chibi/mascot character: approachable and cheerful, not slick or corporate. The UI shell can afford real warmth (§3–§5) precisely because the data itself (prices, quotes, order state) stays strict and monospace — the contrast is what makes the character read as charming rather than the app read as unserious.
- **Bonus alignment**: the brief already specifies VOICEVOX as the TTS engine (§2, §11 of the dev brief) — Zundamon *is* the VOICEVOX mascot. Lip-sync and voice output were always going to be tuned for VOICEVOX's cadence; pairing it with Zundamon's own model means the voice and the face were built for each other, not stitched together after the fact.

The balance to hold: playful shell, serious numbers. Never let motion or ornamentation delay or obscure a price, a quote countdown, or an order confirmation.

---

## 2. Design tokens

Pulled directly from the brief — do not deviate without a reason recorded here.

```ts
// tailwind.config.ts
colors: {
  bg: '#0A0A0A',
  surface: '#111111',
  'surface-2': '#151515',
  border: '#242424',
  'border-soft': '#1C1C1C',
  text: '#FFFFFF',
  'text-2': '#9C9C9C',
  'text-3': '#6E6E6E',
  accent: '#7BE07B',
  'accent-ink': '#06240A',
  up: '#6EE787',
  down: '#FF8080',

  // Companion accent — decorative only, see note below
  'companion-pink': '#FFB6C1',
}
```

**On `companion-pink`.** This is new, not in the original brief token table — added because Zundamon's design uses pink (ribbon, cheeks, boot soles) as her only non-green/white accent. Scope it tightly:

- Allowed: the `/robinchan` page's character-adjacent chrome (ribbon-shaped tier badge accents, a small blush highlight in the stage card's idle state, the chat panel's send-button hover if it needs to feel distinct from the accent green elsewhere)
- Not allowed: anything semantic (never near `up`/`down`), anything on `/market`, anything that could be confused with a price or status signal
- If in doubt, don't use it — `accent` alone is always the safe default, and this exists purely to let Zundamon's own coloring show through in one or two character-specific spots, not to become a second brand color

**Typography**

| Role | Font | Notes |
|---|---|---|
| Heading | Space Grotesk | Slightly wide tracking on large headlines for personality |
| Body | Instrument Sans | Default UI text |
| Numeric | JetBrains Mono | Prices, tickers, timestamps, addresses — always tabular-nums |

**Radius — companion-forward adjustment**

The brief specifies 20px large / 14–16px small / 999px pill. Under companion-forward direction, push toward the top of those ranges rather than the bottom, and prefer pill shapes for anything interactive (buttons, tabs, badges, tier chips) rather than rounded rectangles — this now has a direct source: Zundamon's own rounded, mochi-soft silhouette. Data-table rows and dense list items stay sharper (8–10px) so the Market page doesn't feel mushy under a wall of numbers.

**Glow/accent usage**

- Active nav item: 1px accent border + faint accent glow (`box-shadow: 0 0 24px rgba(123,224,123,0.15)`), not just a bg fill
- Live/streaming indicators (video badge, "quote live" countdown): soft pulsing accent dot, 2s ease-in-out loop, respects `prefers-reduced-motion`
- Order preview card's sign button: accent fill with a subtle glow on hover, not a flat color swap

---

## 3. Shell (sidebar + topbar)

- Sidebar 248px, topbar 76px, shared layout — as specified in the brief.
- Sidebar active-item indicator: pill-shaped highlight behind the icon+label, not just a text color change — this is where companion personality shows up in daily navigation.
- Disabled items (`/trade`, `/heat`, `/portfolio`): visible but at `text-3` opacity, no hover state, small "Soon" pill badge in `border` color — communicates "coming," not "broken."
- Below 1024px: sidebar becomes a drawer. Drawer open/close transition should feel soft (spring-ish ease, ~250ms), matching the companion tone — not an instant snap.
- Optional detail: a small static Zundamon glyph (just the ear-antenna/edamame-pod silhouette, not the full character) as the sidebar's `/robinchan` nav icon, so the character's motif is legible even collapsed. Keep every other nav icon plain/geometric — one character touch, not a theme applied to all icons.

---

## 4. Home (`/`)

Direction: the hero and feature blocks get the most personality; the data-driven cards (Market panel, Heat board) stay closer to terminal-clean since they're carrying real numbers.

- **Hero**: headline in Space Grotesk, generous line-height, badge pill with a small pulsing accent dot ("Live on Robinhood Chain" or similar status copy). Two CTAs — primary filled pill in accent, secondary ghost/outline pill. If a hero illustration is used, a small/cropped Zundamon pose (not full-body, keep it light so the hero still reads as a serious product) is the one place on this page her actual likeness could appear outside `/robinchan`.
- **Market snapshot panel (412×384px)**: terminal-clean card, sharper internal rows, but the card *shell* itself gets the 20px+ radius and a soft border glow so it doesn't feel like a foreign object next to the softer hero.
- **"Ngobrol, jadi order" demo card**: this is the best place for companion personality — chat bubbles rounded and soft, a small static Zundamon avatar/icon next to her chat lines, playful copy in the fake conversation. It's static, so it can afford to be the most "designed" card on the page.
- **Heat board**: bars use accent-to-down gradient per score tier rather than a flat bar, rounded pill-track.
- **Marquees**: gradient-masked edges, pill-shaped ticker chips (not square), soft border glow on the chips carrying positive movement.
- **Feature cards / capital-flow strip / footer**: stay simple and static as the brief specifies — don't over-decorate content that never changes.

---

## 5. Robinchan (`/robinchan`)

This page is the anchor for the whole direction — everything else takes its cue from here, at a lower intensity.

- **Live2D stage card**: the most rounded, softest-edged card on the site. Idle-state skeleton should be a soft breathing/pulsing placeholder in `accent` (not gray) — it should already feel alive before the model loads. A nice, cheap detail given the source character: three small soft dots arranged like an edamame pod as the loading indicator, instead of a generic spinner.
- **Expression-linked UI**: when Zundamon's expression changes (`senang`, `fokus`, `waspada`, `santai`), a very subtle ambient shift in the stage card's border glow color/intensity — e.g. `waspada` = slightly warmer glow (can lean toward `companion-pink` at low opacity), `santai` = softer/dimmer accent glow. Small enough to be a nice detail, never so strong it competes with the chat.
- **Chat panel**: rounded message bubbles, generous padding, streaming-token cursor styled as a soft accent blink rather than a plain caret. Her avatar in the message list can use a small ribbon/pink accent ring, consistent with her actual design, without it becoming a competing color in the chat itself.
- **Order preview card embedded in chat**: even though this is the most "serious" component on the page, keep its card radius consistent with the surrounding chat bubbles so it doesn't look like a jarring institutional insert. The countdown timer can use the pulsing-dot pattern from the Home hero badge. No character theming here — this card should look identical whether or not the user notices Zundamon is in the room.
- **Tier cards**: three pill-badged cards, locked state uses a soft blurred/dimmed treatment with a small lock glyph, not a flat gray overlay — locked should feel like "not yet," not "broken." The "Suara" (voice) tier card is the natural place for a small VOICEVOX/Zundamon voice-waveform icon, tying the tier directly to the character's own voice.

---

## 6. Market (`/market`)

This page stays closest to terminal-clean — it's the highest-density, most numbers-per-pixel screen. The character choice doesn't change this page's direction at all: no Zundamon imagery, no `companion-pink`, no extra motion beyond what's already specified. Density and trust matter more here than anywhere else in the product.

- Index strip, feed, and "sumber yang dipantau" grid: sharper corners (8–10px), tight spacing, monospace numerals throughout.
- The one place to let personality in: the **tape** (marquee headline strip) and the **video channel tabs** — pill-shaped, accent-highlighted active tab, small live-pulse dot next to "LIVE."
- Sentiment dots (green/red/gray): slightly larger than a typical status dot, soft glow on green (positive) only — reinforces the accent-heavy palette without touching the red down-color's clinical/warning read.
- Stale-data state: dim text as specified in the brief, and add a small pill badge ("stale") near the timestamp rather than relying on color dimming alone — keeps it legible and on-brand with the pill-heavy UI language used elsewhere.

---

## 7. Shared components — design notes

| Component | Companion-forward treatment |
|---|---|
| `<Marquee>` | Pill-shaped chips inside the track, gradient edge masks, respects `prefers-reduced-motion` (per brief) |
| `<Live2DStage>` | Soft/rounded card frame, breathing skeleton state (edamame-pod loading dots), optional ambient glow tied to expression |
| `<ChatPanel>` | Rounded bubbles, soft accent streaming-cursor, small pink-ring avatar treatment consistent with the character, never bleeding into message content styling |
| `<OrderPreviewCard>` | Radius matches surrounding context (chat bubble radius on `/robinchan`, slightly sharper if reused on `/trade`); countdown uses pulsing-dot pattern; no character theming — never sacrifices legibility of numbers for style |
| `<TickerCard>` / `<NewsCard>` | Pill category badges, soft glow on positive-sentiment items only, monospace for all numeric/time fields |

---

## 8. What NOT to do

- Don't apply glow/pulse effects to more than one element at a time within a single card — it reads as noisy, not alive.
- Don't soften the Market page to match the Home/Robinchan warmth — density and trust matter more there.
- Don't let character-driven motion block or delay: quote countdowns, sign-button state, streaming chat tokens, or price updates. Personality is decorative; correctness and speed are not negotiable (ties back to the brief's non-custodial / user-decides-last principle).
- Don't let `companion-pink` migrate beyond the scope in §2 — it's a one-character accent, not a second brand color.
- Don't put Zundamon's likeness on `/market` or inside `<OrderPreviewCard>` anywhere it's reused (e.g. future `/trade`) — those surfaces should look the same with or without the character theme.
- Don't hardcode the Live2D model or its expression-glow mapping — keep it reading from `LIVE2D_MODEL_URL` as the brief specifies, so the visual system survives an asset swap if the Zundamon asset can't clear licensing (see §9).

---

## 9. Open items

- **Waiting on Bix's actual canvas** (`Main.dc.html`, `Character.dc.html`, `Market.dc.html`, `Mobile.dc.html`) for exact pixel values — this doc should be reconciled against those once shared, not treated as a replacement for them.
- **Character license — now concrete, not generic.** The brief (§15, open decision #7) already flags that Live2D character/TTS licensing needs clearing before shipping final assets; with Zundamon specifically chosen, there are two separate things to verify before this ships to production, not one:
  1. The model file at `live2d.com/en/learn/sample/zundamon/` is published by Live2D Inc. as a **sample model** for testing tracking software — sample models are commonly licensed for demos/streaming but may explicitly restrict embedding in a commercial product's UI. This needs checking against Live2D Inc.'s own terms for that specific download, separate from the character IP itself.
  2. Zundamon as a character belongs to the **Tohoku Zunko / Zundamon Project**, which publishes its own character usage guidelines (separate from the Live2D file license) — commercial use, especially in a product tied to a token launch and real trading, likely needs its own review against those guidelines.
  Until both are confirmed, keep `LIVE2D_MODEL_URL` swappable (already required by the brief) so M1–M3 can proceed with this model as a placeholder without blocking on legal clearance.
- The "expression-linked ambient glow" idea in §5 and the `companion-pink` token in §2 don't depend on final art clearing — they're safe to build now. Anything that renders Zundamon's actual likeness (hero illustration in §4, sidebar glyph in §3, chat avatar in §5) should be treated as placeholder-swappable until §9's licensing items clear, same as the stage model itself.

---

## 10. Home gets its own layout, not the dashboard shell

Amendment, added post-M1/M2 build. Home (`/`) has moved off the sidebar+topbar shell in §3 and onto a dedicated marketing layout. The dashboard shell still applies to `/robinchan` and `/market` exactly as before — this section only concerns `/`.

**Why.** A landing page's one job is to get a first-time visitor to understand and trust the product in one scroll. A 248px sidebar reserving space for `/trade`, `/heat`, `/portfolio` — pages that don't exist yet — works against that; it makes Home look like a workspace someone already committed to, not an invitation. Splitting the shell is a routing-level change (Next.js route groups: `(dashboard)` wraps `/robinchan` and `/market` in `<AppShell>`; `(marketing)` wraps `/` in a plain top nav), not a fork of the design system — both shells share the same color tokens, type scale, and `.page-container` width (1112px), so navigating between them doesn't feel like leaving the product.

**What the marketing shell gets that the dashboard doesn't:**

- **`<LandingHeader>`** — a sticky top nav, transparent over the hero and picking up a solid blurred background once scrolled past it. Logo left, `Robinchan` / `Market` links, one primary CTA ("Launch app" → `/robinchan`). No wallet-connect placeholder, no "Soon" items — those belong to the workspace, not the pitch.
- **A full-bleed hero backdrop** — a slow WebGL fiber field behind the hero content only (`<HeroBackground>`, recoloring React Bits' GhostFibers to accent-green lines and a companion-pink glow, tuned well below its own out-of-the-box defaults — fewer layers, slower motion, lower brightness — and blended in at 60% opacity so it stays peripheral rather than competing with the headline). This is the one place on the whole product a decorative background effect is allowed, and the one place `companion-pink` is allowed outside strictly character-adjacent chrome (§2) — it's brand-mood, not a UI signal. It fades to flat black before the next section so it reads as "hero backdrop," not a site-wide tint, and fails silently (no background, not an error state) on a browser without WebGL2 — it's decoration, not the product, so it doesn't get the Live2D stage's explicit fallback UI.
- **Scroll-triggered entrances** — `<Reveal>` (`lib/useReveal.ts`, an IntersectionObserver hook, fires once) fades and rises each section into view as the visitor scrolls: the chat-demo/heat-board row, the marquees, the feature cards, capital flow. The hero itself uses a one-shot mount animation (`animate-hero-in`, staggered per element) instead, since it's already on screen at load — nothing above the fold should make a visitor wait for it to animate in. Every one of these motions is a plain CSS `transition`/`animation`, so the existing global `prefers-reduced-motion` rule (§8, and the one in `globals.css`) neutralizes all of it automatically — no separate reduced-motion handling needed per component.
- **`ember` (`#F2A65A`)** — one new supporting color, marketing-layout-only. Used on exactly one of the three feature cards (the middle one) so the row reads as three distinct ideas instead of three copies of the same green card, without turning into a second general-purpose brand color the way §2 already warns against for `companion-pink`. It does not appear on `/market` or `/robinchan`.
- **Hover feedback everywhere a card or step is a real destination or a real idea** — feature pillars pick up their tone color on hover; capital-flow steps highlight on hover. None of this touches `/market` or the dashboard's data-driven cards — those still follow §6/§8 exactly as written.

**What does NOT change:** the dashboard shell (§3), the Market page's terminal-clean density (§6), the Robinchan stage and chat treatment (§5), and the restraint rules in §8 — all of that still governs `/robinchan` and `/market` unmodified. This section only grants Home the room the rest of the product deliberately doesn't get.

### 10.1 Landing-page scale

Second amendment, after an audit of the built page. The split in §10 gave Home its own shell but left it wearing the dashboard's typography and spacing, so it still read as a workspace screen with a nav bar swapped in. Four changes, all scoped to the marketing route:

- **A display scale that only Home uses.** `.t-display` now runs to 100px (from 56px), and three marketing-only classes join it: `.t-section` (section headings, to 48px), `.t-stat` (proof-band numerals, to 64px), `.t-lead` (hero and CTA lead paragraphs). These are deliberately *not* changes to `.t-h2`/`.t-h3`, which are shared with `PageHeader`, `TierCards`, and `/robinchan` and must stay small there. **Tracking inverts at this scale:** §2's "slightly looser tracking on large headlines" (+0.006em) was written for a 56px ceiling and still holds there, but past roughly 72px it reads as gaps between letters, so `.t-display` and `.t-section` run negative instead.
- **The hero headline spans the full container**, with the lead/CTA/market-panel row beneath it, rather than sitting in the artboard's 660px left column. At 100px that column would break "Read the market." across two lines and cost the copy its three-beat rhythm. `<HeroBackground>`'s band is now per-breakpoint (380px / 620px) because the headline it covers is ~118px tall at the mobile floor and ~294px at the desktop ceiling.
- **Section rhythm (`.section-y`, 72–144px) and section headings.** Home previously ran `py-4` between blocks and gave most of them no heading at all, so the feature row and marquees read as stacked widgets rather than as an argument with parts. `<SectionHead>` (eyebrow, statement heading, optional aside for the caveat) now introduces each one.
- **Varied treatment per section, instead of `card` everywhere.** A page where every block has identical chrome gives a reader no way to tell the thesis from the footnote. The feature block drops to numbered hairline rules (01–03); the stat band and capital flow use hairline-separated grids; the closing CTA is the only other block allowed a decorative wash, and it's static — the hero keeps the page's one *animated* background.

**On the proof band.** Landing pages in this category lead with headline metrics — TVL, 24h volume, holders. Robinchan is pre-launch and has none, and fabricating them would be a lie printed at 64px. `<StatBand>` states what the system verifiably *is* instead: keys stored (0), symbols tracked (13 = `WATCHED_SYMBOLS` + `INDEX_SYMBOLS`), price refresh (20s, the `prices` job interval), feeds running (6 scheduled collectors, excluding `retention`). **Every figure there is read off the code and carries a comment saying where — anything added to that band later must clear the same bar.**
