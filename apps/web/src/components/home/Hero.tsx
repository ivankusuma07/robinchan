import Link from 'next/link';
import type { ApiEnvelope, Ticker } from '@robinchan/shared';

import { ArrowRightIcon } from '@/components/icons';
import { PulseDot } from '@/components/ui';

import { MarketSnapshot } from './MarketSnapshot';

/**
 * Hero + "Market now" panel (brief §4 blocks 1–2).
 * Left column 660px, right panel 412×384px, 40px gap — artboard numbers.
 */
export function Hero({ snapshot }: { snapshot: ApiEnvelope<Ticker[]> }) {
  return (
    <section className="grid-hero items-start pb-16">
      <div className="max-w-hero">
        <p className="pill mb-7 border-accent/35 font-mono text-accent">
          <PulseDot />
          Live on Robinhood Chain
        </p>

        <h1 className="t-display mb-6">
          Read the market.
          <br />
          Talk it through.
          <br />
          <span className="text-accent">Sign it yourself.</span>
        </h1>

        <p className="t-body mb-9 max-w-[520px] text-[16px]">
          Robinchan reads tokenized stocks, news, and on-chain activity on one screen. Build orders
          in plain sentences — then you&apos;re the one who presses sign in your own wallet. No
          custody, no silent execution.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/robinchan" className="btn-primary">
            Talk to Robinchan
            <ArrowRightIcon />
          </Link>
          <Link href="/market" className="btn-ghost">
            Check the market first
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-border-soft pt-7">
          <Stat label="Chain" value="Robinhood Chain" />
          <Stat label="Token" value="$RCHAN" />
          <Stat label="Custody" value="None" />
        </dl>
      </div>

      <MarketSnapshot initial={snapshot} />
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
