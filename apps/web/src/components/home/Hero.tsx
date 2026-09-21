import Link from 'next/link';
import type { ApiEnvelope, Ticker } from '@robinchan/shared';

import { ArrowRightIcon } from '@/components/icons';
import { PulseDot } from '@/components/ui';

import { MarketSnapshot } from './MarketSnapshot';

/**
 * Hero + "Market now" panel (brief §4 blocks 1–2).
 * Left column 660px, right panel 412×384px, 40px gap — artboard numbers.
 *
 * This is the one section on the site allowed a full-bleed decorative
 * background (design.md §10) — two blurred accent/companion-pink blobs
 * drifting slowly behind the content. It's the page's first impression, so
 * it's the one place worth spending that visual weight; nothing past it
 * repeats the treatment.
 */
export function Hero({ snapshot }: { snapshot: ApiEnvelope<Ticker[]> }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute -left-[10%] -top-[20%] h-[520px] w-[520px] animate-orb-drift rounded-full opacity-[0.18] blur-[110px]"
          style={{ background: 'radial-gradient(closest-side, #7BE07B, transparent)' }}
        />
        <div
          className="absolute -right-[8%] top-[5%] h-[420px] w-[420px] animate-orb-drift-slow rounded-full opacity-[0.14] blur-[110px]"
          style={{ background: 'radial-gradient(closest-side, #FFB6C1, transparent)' }}
        />
        {/* Fades the art back to flat black before the next section, so the
            glow reads as "hero backdrop", not a tint over the whole page. */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="page-container grid-hero items-start px-5 pb-16 pt-14 lg:px-10 lg:pt-20">
        <div className="max-w-hero">
          <p className="pill mb-7 animate-hero-in border-accent/35 font-mono text-accent [animation-delay:0ms]">
            <PulseDot />
            Live on Robinhood Chain
          </p>

          <h1 className="t-display mb-6 animate-hero-in [animation-delay:60ms]">
            Read the market.
            <br />
            Talk it through.
            <br />
            <span className="text-accent">Sign it yourself.</span>
          </h1>

          <p className="t-body mb-9 max-w-[520px] animate-hero-in text-[16px] [animation-delay:120ms]">
            Robinchan reads tokenized stocks, news, and on-chain activity on one screen. Build
            orders in plain sentences — then you&apos;re the one who presses sign in your own
            wallet. No custody, no silent execution.
          </p>

          <div className="flex animate-hero-in flex-wrap gap-3 [animation-delay:180ms]">
            <Link href="/robinchan" className="btn-primary group">
              Talk to Robinchan
              <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link href="/market" className="btn-ghost">
              Check the market first
            </Link>
          </div>

          <dl className="mt-12 flex animate-hero-in flex-wrap gap-x-10 gap-y-5 border-t border-border-soft pt-7 [animation-delay:240ms]">
            <Stat label="Chain" value="Robinhood Chain" />
            <Stat label="Token" value="$RCHAN" />
            <Stat label="Custody" value="None" />
          </dl>
        </div>

        <div className="animate-hero-in [animation-delay:140ms]">
          <MarketSnapshot initial={snapshot} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="t-eyebrow mb-2">{label}</dt>
      <dd className="font-mono text-[13px] text-text-2">{value}</dd>
    </div>
  );
}
