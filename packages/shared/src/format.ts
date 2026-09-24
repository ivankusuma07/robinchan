import { SENTIMENT_NEG, SENTIMENT_POS } from './constants.js';

const NUM = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '––––';
  return NUM.format(value);
}

export function formatChange(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '––––';
  return `${value >= 0 ? '+' : '−'}${NUM.format(Math.abs(value))}`;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '––%';
  return `${value >= 0 ? '+' : '−'}${NUM.format(Math.abs(value))}%`;
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export type Direction = 'up' | 'down' | 'flat';

export function direction(value: number | null | undefined): Direction {
  if (value == null || !Number.isFinite(value) || value === 0) return 'flat';
  return value > 0 ? 'up' : 'down';
}

export type Sentiment = 'pos' | 'neg' | 'neu';

/** Brief §9: threshold −0.15 / +0.15. */
export function sentimentBucket(score: number | null | undefined): Sentiment {
  if (score == null || !Number.isFinite(score)) return 'neu';
  if (score > SENTIMENT_POS) return 'pos';
  if (score < SENTIMENT_NEG) return 'neg';
  return 'neu';
}

/**
 * Relative time is computed from the UTC timestamp on the client (brief §6),
 * not sent by the server, so it doesn't go stale when the response is cached.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hour = Math.round(min / 60);
  if (hour < 24) return `${hour}h ago`;
  const day = Math.round(hour / 24);
  return `${day}d ago`;
}

/**
 * UTC, not the viewer's local time zone — matching `formatDay` in
 * `Rail.tsx`. Without a fixed zone, this renders differently on the server
 * (whatever zone the Node process runs in) than in the browser, which is a
 * real, confirmed cause of a React hydration text mismatch (error #418) on
 * `/robinchan` and `/market`, the two pages that render this clock.
 */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'UTC' });
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function shortAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
