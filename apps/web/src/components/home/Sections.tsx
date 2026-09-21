import Link from 'next/link';

import { ChatIcon, GridIcon, KeyIcon } from '@/components/icons';

/**
 * Static Home blocks (brief §4 blocks 6–8). Their content is fixed and can be
 * hardcoded; since it never changes, the visual treatment is kept simple
 * (design.md §4) — though on the marketing page specifically, "simple"
 * still leaves room for a hover state and one accent color per card
 * (design.md §10). Two of three lean on brand green; the middle one gets
 * `ember`, the marketing layout's one supporting color, so the row reads as
 * three distinct ideas rather than three copies of the same card.
 */

const FEATURES = [
  {
    title: 'One screen, not six tabs',
    body: 'Prices, SEC filings, news, and on-chain activity collected into one feed with relative time and sentiment — not six sources you have to stitch together yourself.',
    Icon: GridIcon,
    tone: 'accent',
  },
  {
    title: 'Commands in plain sentences',
    body: 'Write what you want in normal language. If anything is unclear, Robinchan asks back — it never guesses, because guessing wrong here means you lose money.',
    Icon: ChatIcon,
    tone: 'ember',
  },
  {
    title: 'Keys stay in your hands',
    body: 'The server builds the transaction payload, then stops there. No private key, seed phrase, or session key is ever stored — every transaction needs a fresh signature from you.',
    Icon: KeyIcon,
    tone: 'accent',
  },
] as const;

const TONE_STYLES = {
  accent: {
    badge: 'bg-accent/10 text-accent',
    hoverBorder: 'hover:border-accent/40',
    hoverShadow: 'hover:shadow-[0_0_28px_rgba(123,224,123,0.10)]',
  },
  ember: {
    badge: 'bg-ember/10 text-ember',
    hoverBorder: 'hover:border-ember/40',
    hoverShadow: 'hover:shadow-[0_0_28px_rgba(242,166,90,0.10)]',
  },
} satisfies Record<string, { badge: string; hoverBorder: string; hoverShadow: string }>;

export function FeatureCards() {
  return (
    <section className="grid gap-4 py-4 md:grid-cols-3" aria-label="Core capabilities">
      {FEATURES.map(({ title, body, Icon, tone }) => {
        const styles = TONE_STYLES[tone];
        return (
          <article
            key={title}
            className={`card-soft group flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 ${styles.hoverBorder} ${styles.hoverShadow}`}
          >
            <span
              className={`mb-5 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${styles.badge}`}
            >
              <Icon />
            </span>
            <h3 className="t-h3 mb-3">{title}</h3>
            <p className="t-small text-[13px] leading-relaxed">{body}</p>
          </article>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    label: 'Trading fees',
    body: 'A portion of every order fee flows to the treasury address.',
  },
  {
    label: 'Premium tiers',
    body: 'Tier subscriptions flow into the same treasury.',
  },
  {
    label: 'Treasury',
    body: 'Balance and accrual are logged hourly, open for anyone to read.',
  },
  {
    label: 'Buyback $RCHAN',
    body: 'Purchase execution is run manually, not by the server.',
  },
];

export function CapitalFlow() {
  return (
    <section className="card p-6 md:p-8" aria-label="Capital flow">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-eyebrow mb-2.5">Capital flow</p>
          <h2 className="t-h3">Where the fees go</h2>
        </div>
        <p className="max-w-[380px] text-[12px] leading-relaxed text-text-3">
          Buyback is deliberately not automated. A server that can move funds means a server
          holding keys, which conflicts with the non-custodial principle.
        </p>
      </div>

      <ol className="grid gap-px overflow-hidden rounded-panel bg-border-soft md:grid-cols-4">
        {STEPS.map((step, i) => (
          <li
            key={step.label}
            className="group bg-surface p-5 transition-colors duration-200 hover:bg-surface-2"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border font-mono text-[10px] text-text-3 transition-colors duration-200 group-hover:border-accent/50 group-hover:text-accent">
                {i + 1}
              </span>
              <span className="font-display text-[14px] font-medium">{step.label}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-text-3">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

type FooterLink = { label: string; href?: string };

/** Phase-2 pages have no route yet, so they're named without a link — not a dead link. */
const FOOTER_LINKS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: 'Product',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Robinchan', href: '/robinchan' },
      { label: 'Market', href: '/market' },
    ],
  },
  {
    heading: 'Coming soon',
    links: [{ label: 'Trade' }, { label: 'Heat' }, { label: 'Portfolio' }],
  },
  {
    heading: 'Token',
    links: [
      { label: 'Tiers & gating', href: '/robinchan' },
      { label: '$RCHAN on Pons' },
      { label: 'Buyback' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-4 border-t border-border-soft pt-10">
      <div className="grid gap-10 pb-10 md:grid-cols-[1fr_auto] md:gap-16">
        <div className="max-w-[420px]">
          <p className="font-display text-[15px] font-semibold tracking-[0.01em]">Robinchan</p>
          <p className="mt-3 text-[13px] leading-relaxed text-text-3">
            A character companion market for tokenized stocks on Robinhood Chain.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {FOOTER_LINKS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="t-eyebrow mb-4">{column.heading}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link
                        href={link.href}
                        className="text-[13px] text-text-2 transition-colors hover:text-text"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-text-3">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-border-soft py-8">
        <p className="max-w-[760px] text-[12px] leading-relaxed text-text-3">
          Not financial advice. Tokenized stocks are securities and their availability varies by
          jurisdiction. Trading features stay behind a feature flag that&apos;s off by default until
          licensing and disclosure requirements are reviewed. Price and news data come from
          third-party providers and may be delayed or incomplete.
        </p>
      </div>
    </footer>
  );
}
