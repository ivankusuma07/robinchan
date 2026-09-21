'use client';

import type { ApiEnvelope, HeatScore } from '@robinchan/shared';
import { POLL_MS, WATCHED_SYMBOLS } from '@robinchan/shared';

import { CardHead, StaleBadge, cx } from '@/components/ui';
import { isUnset } from '@/lib/api';
import { usePoll } from '@/lib/usePoll';

/**
 * Heat board (brief §4 block 4): five rows with a score bar.
 *
 * Without a wallet, the API returns scores rounded to the nearest 10 and
 * without component detail (brief §13) — so this card names the rounding
 * outright, rather than showing round numbers as if they were full precision.
 */
export function HeatBoard({ initial }: { initial: ApiEnvelope<HeatScore[]> }) {
  const envelope = usePoll<HeatScore[]>('/api/heat?limit=5', initial, POLL_MS.heat);
  const rows = envelope.data;

  return (
    <section className="card flex flex-col">
      <CardHead
        title="Heat board"
        aside={
          <>
            {envelope.stale && !isUnset(envelope) ? <StaleBadge /> : null}
            <span className="font-mono text-[11px] text-text-3">rounded ×10</span>
          </>
        }
      />

      <div className="flex-1 divide-y divide-border-soft">
        {rows.length === 0
          ? WATCHED_SYMBOLS.slice(0, 5).map((symbol) => (
              <HeatRowEmpty key={symbol} symbol={symbol} />
            ))
          : rows
              .slice(0, 5)
              .map((row) => <HeatRow key={row.symbol} row={row} stale={envelope.stale} />)}
      </div>

      <p className="border-t border-border-soft px-5 py-3.5 text-[12px] leading-relaxed text-text-3">
        Score combines on-chain activity and 24-hour news. The social component ships in phase 3.
      </p>
    </section>
  );
}

function HeatRow({ row, stale }: { row: HeatScore; stale: boolean }) {
  return (
    <div className={cx('flex items-center gap-4 px-5 py-3', stale && 'is-stale')}>
      <div className="w-[68px] shrink-0">
        <p className="font-mono text-[13px] tracking-[0.04em]">{row.symbol}</p>
      </div>
      <HeatBar score={row.score} />
      <span className="w-[34px] shrink-0 text-right font-mono text-[13px]">{row.score}</span>
    </div>
  );
}

function HeatRowEmpty({ symbol }: { symbol: string }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3">
      <div className="w-[68px] shrink-0">
        <p className="font-mono text-[13px] tracking-[0.04em] text-text-3">{symbol}</p>
      </div>
      <div className="h-1.5 flex-1 rounded-full bg-surface-2" />
      <span className="w-[34px] shrink-0 text-right font-mono text-[13px] text-text-3">––</span>
    </div>
  );
}

/**
 * The bar uses a gradient keyed to score tier, not a flat color (design.md §4).
 * High scores shift toward `down` — "hot" doesn't always mean good.
 */
function HeatBar({ score }: { score: number }) {
  const pct = Math.max(3, Math.min(100, score));
  const hot = score >= 70;
  const warm = score >= 45;

  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
      <div
        className={cx(
          'h-full rounded-full',
          hot
            ? 'bg-gradient-to-r from-accent to-down'
            : warm
              ? 'bg-gradient-to-r from-accent to-accent/55'
              : 'bg-accent/45',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
