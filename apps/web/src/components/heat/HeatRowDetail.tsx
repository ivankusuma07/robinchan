'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ApiEnvelope, HeatComponentKey, HeatDetail } from '@robinchan/shared';
import { TRADABLE_SYMBOLS, relativeTime } from '@robinchan/shared';

import { DataBlock } from '@/components/DataBlock';
import { ArrowRightIcon, ExternalIcon } from '@/components/icons';
import { Skeleton } from '@/components/ui';
import { getEnvelope, isUnset } from '@/lib/api';
import { safeUrl, sanitizeText } from '@/lib/sanitize';
import { useNow } from '@/lib/usePoll';

import { MiniBar } from './HeatBar';

const LABELS: Record<HeatComponentKey, string> = {
  onchain: 'On-chain',
  news: 'News',
  social: 'Social',
};

/**
 * An opened heat row (plan §6): each component with its note, the stories
 * behind the news score, and Robinchan's read when one exists.
 *
 * Opening a row is a plain read of `GET /api/heat/:symbol` — the read is
 * precomputed by the worker, so this never triggers an LLM call.
 */
export function HeatRowDetail({ symbol, tradeEnabled }: { symbol: string; tradeEnabled: boolean }) {
  const [envelope, setEnvelope] = useState<ApiEnvelope<HeatDetail | null> | null>(null);
  const now = useNow();

  useEffect(() => {
    let cancelled = false;
    void getEnvelope<HeatDetail | null>(`/api/heat/${encodeURIComponent(symbol)}`, null).then(
      (res) => {
        if (!cancelled) setEnvelope(res);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const detail = envelope?.data ?? null;
  const state = envelope == null ? 'loading' : detail == null ? 'error' : envelope.stale && !isUnset(envelope) ? 'stale' : 'ready';

  return (
    <div className="border-t border-border-soft bg-surface-2/40 px-5 py-5">
      <DataBlock
        state={state}
        skeleton={
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-4 w-full max-w-[520px]" />
            ))}
          </div>
        }
        empty={null}
        error="Couldn't load this row's breakdown. Close and reopen it to try again."
      >
        {detail ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="t-eyebrow mb-3">Why it ranks here</p>
              <dl className="space-y-3.5">
                {(Object.keys(LABELS) as HeatComponentKey[]).map((key) => {
                  const part = detail.breakdown[key];
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <dt className="text-[13px] text-text">{LABELS[key]}</dt>
                        <dd className="font-mono text-[12px] text-text-2">
                          {part.score == null ? 'not active yet' : Math.round(part.score * 100)}
                        </dd>
                      </div>
                      <MiniBar value={part.score} label={LABELS[key]} className="mb-1.5" />
                      {part.note ? <p className="text-[12px] text-text-3">{part.note}</p> : null}
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="space-y-5">
              {detail.drivers.length > 0 ? (
                <div>
                  <p className="t-eyebrow mb-3">What moved the news score</p>
                  <ul className="space-y-2">
                    {detail.drivers.map((d) => {
                      const href = safeUrl(d.url);
                      const title = sanitizeText(d.title, 140);
                      return (
                        <li key={d.id} className="text-[13px] leading-snug">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text hover:underline"
                            >
                              {title} <ExternalIcon className="inline align-[-2px] text-text-3" />
                            </a>
                          ) : (
                            <span className="text-text">{title}</span>
                          )}
                          <span className="mt-0.5 block font-mono text-[11px] text-text-3">
                            {sanitizeText(d.source, 28)}
                            {now != null ? ` · ${relativeTime(d.publishedAt, now)}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {/* The read is hidden entirely when absent (plan §6), never a placeholder. */}
              {detail.read ? (
                <div className="rounded-panel border border-accent-2/40 bg-accent/20 p-4">
                  <p className="t-eyebrow mb-2">Robinchan&apos;s read</p>
                  <p className="text-[13px] leading-relaxed text-text">{detail.read}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2.5">
                <Link href="/robinchan" className="btn-ghost min-h-[40px] text-[13px]">
                  Ask Robinchan
                </Link>
                {tradeEnabled && TRADABLE_SYMBOLS.includes(symbol) ? (
                  <Link href={`/trade/${symbol}`} className="btn-primary min-h-[40px] text-[13px]">
                    Open in Trade
                    <ArrowRightIcon />
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </DataBlock>
    </div>
  );
}
