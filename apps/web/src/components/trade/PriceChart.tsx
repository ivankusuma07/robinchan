'use client';

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, IPriceLine, UTCTimestamp } from 'lightweight-charts';
import type { Candle, CandleInterval } from '@robinchan/shared';
import { CANDLE_INTERVALS, POLL_MS } from '@robinchan/shared';

import { StaleBadge, cx } from '@/components/ui';
import { getEnvelope, isUnset } from '@/lib/api';

const INTERVAL_KEY = 'robinchan.trade.interval';

export type PriceLineSpec = { price: number; label: string; side: 'buy' | 'sell' };

/** Stable default, so the price-line effect doesn't re-run on every render. */
const NO_LINES: PriceLineSpec[] = [];

function readInterval(): CandleInterval {
  try {
    const saved = window.localStorage.getItem(INTERVAL_KEY);
    return (CANDLE_INTERVALS as readonly string[]).includes(saved ?? '')
      ? (saved as CandleInterval)
      : '1h';
  } catch {
    return '1h';
  }
}

/**
 * Trade chart (plan §8): candles from `GET /api/market/candles/:symbol`,
 * six intervals with the last choice remembered per browser, and the
 * caller's open limit orders drawn as price lines.
 *
 * `lightweight-charts` is imported inside the effect, so it only ever loads
 * in the browser and never on pages that don't show a chart.
 */
export function PriceChart({
  symbol,
  priceLines = NO_LINES,
}: {
  symbol: string;
  priceLines?: PriceLineSpec[];
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const [interval, setIntervalState] = useState<CandleInterval>('1h');
  const [bars, setBars] = useState<Candle[] | null>(null);
  const [stale, setStale] = useState(false);
  const [ready, setReady] = useState(false);

  // Restore the saved interval after mount, so SSR and first paint agree.
  useEffect(() => {
    setIntervalState(readInterval());
  }, []);

  const pick = (next: CandleInterval) => {
    setIntervalState(next);
    try {
      window.localStorage.setItem(INTERVAL_KEY, next);
    } catch {
      /* Not persisted; applies for this visit. */
    }
  };

  // Create the chart once.
  useEffect(() => {
    let disposed = false;
    void import('lightweight-charts').then(({ createChart, CandlestickSeries, ColorType }) => {
      if (disposed || !host.current) return;
      // The chart draws on a canvas, which can't resolve `var(...)` — read
      // the mono family next/font actually registered.
      const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
      const chart = createChart(host.current, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: '#FFFFFF' },
          textColor: '#6B7280',
          fontFamily: `${mono ? `${mono}, ` : ''}ui-monospace, monospace`,
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#F1F5EF' },
          horzLines: { color: '#F1F5EF' },
        },
        rightPriceScale: { borderColor: '#E5EDE7' },
        timeScale: { borderColor: '#E5EDE7', timeVisible: true, secondsVisible: false },
        crosshair: { horzLine: { labelBackgroundColor: '#1F2937' }, vertLine: { labelBackgroundColor: '#1F2937' } },
      });
      seriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#22C55E',
        downColor: '#EF4444',
        wickUpColor: '#22C55E',
        wickDownColor: '#EF4444',
        borderVisible: false,
      });
      chartRef.current = chart;
      setReady(true);
    });
    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      linesRef.current = [];
    };
  }, []);

  // Fetch candles for the current symbol and interval, and keep polling.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await getEnvelope<Candle[]>(
        `/api/market/candles/${encodeURIComponent(symbol)}?interval=${interval}`,
        [],
      );
      if (cancelled) return;
      setBars(res.data);
      setStale(res.stale && !isUnset(res));
    };
    setBars(null);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS.candles);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, interval]);

  // Push data into the series.
  useEffect(() => {
    const series = seriesRef.current;
    if (!ready || !series || !bars) return;
    series.setData(
      bars.map((b) => ({ time: b.t as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })),
    );
    chartRef.current?.timeScale().fitContent();
  }, [ready, bars]);

  // Open limit orders as dashed price lines.
  useEffect(() => {
    const series = seriesRef.current;
    if (!ready || !series) return;
    for (const line of linesRef.current) series.removePriceLine(line);
    linesRef.current = priceLines.map((l) =>
      series.createPriceLine({
        price: l.price,
        color: l.side === 'buy' ? '#15803D' : '#DC2626',
        lineWidth: 1,
        lineStyle: 2, // LineStyle.Dashed
        axisLabelVisible: true,
        title: l.label,
      }),
    );
  }, [ready, priceLines]);

  const empty = bars != null && bars.length === 0;

  return (
    <section className="card overflow-hidden" aria-label={`${symbol} price chart`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-4 py-2.5">
        <div className="flex gap-1" role="group" aria-label="Interval">
          {CANDLE_INTERVALS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={interval === i}
              className={cx(
                'h-8 min-w-[40px] rounded-full px-2.5 font-mono text-[12px] transition-colors',
                interval === i ? 'bg-text text-surface' : 'text-text-2 hover:bg-surface-2 hover:text-text',
              )}
            >
              {i}
            </button>
          ))}
        </div>
        {stale ? <StaleBadge /> : null}
      </div>

      <div className="relative h-[420px]">
        <div ref={host} className={cx('absolute inset-0', stale && 'is-stale')} />
        {bars == null ? (
          <div className="absolute inset-0 animate-breathe bg-surface-2/60" aria-hidden />
        ) : null}
        {empty ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-text-3">
            No price history for {symbol} yet. It appears once the candle provider is connected.
          </div>
        ) : null}
      </div>
    </section>
  );
}
