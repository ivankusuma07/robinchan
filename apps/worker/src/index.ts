import { join } from 'node:path';

import { config as loadEnv } from 'dotenv';
import { cacheBackend, dbBackend, getDb, repoRoot } from '@robinchan/store';

loadEnv({ path: join(repoRoot(), '.env'), quiet: true });

const { runPrices } = await import('./jobs/prices.js');
const { runNews } = await import('./jobs/news.js');
const { runHeat } = await import('./jobs/heat.js');
const { runCalendar } = await import('./jobs/calendar.js');
const { runChannels, runClips } = await import('./jobs/media.js');
const { log } = await import('./lib/log.js');

/** Worker schedule — brief §8. */
type Job = {
  name: string;
  everyMs: number;
  run: () => Promise<void>;
};

const JOBS: Job[] = [
  // Brief §8 specifies 10s, but Finnhub's free tier has no batch quote
  // endpoint — one run fetches ~12 symbols individually (WATCHED_SYMBOLS +
  // INDEX_SYMBOLS), and at 10s that's ~72 req/min against a 60 req/min cap.
  // 20s keeps it at ~36 req/min with headroom for the news/calendar jobs'
  // occasional Finnhub calls too. This is exactly the check brief §11 asks
  // devs to do themselves before relying on an interval.
  { name: 'prices', everyMs: 20_000, run: runPrices },
  { name: 'news', everyMs: 60_000, run: runNews },
  { name: 'heat', everyMs: 5 * 60_000, run: runHeat },
  { name: 'channels', everyMs: 10 * 60_000, run: runChannels },
  { name: 'clips', everyMs: 5 * 60_000, run: runClips },
  { name: 'calendar', everyMs: 6 * 60 * 60_000, run: runCalendar },
  {
    name: 'retention',
    everyMs: 12 * 60 * 60_000,
    run: () => getDb().pruneRetention(),
  },
];

const timers: NodeJS.Timeout[] = [];
let stopping = false;

async function safeRun(job: Job): Promise<void> {
  if (stopping) return;
  const started = Date.now();
  try {
    await job.run();
  } catch (err) {
    // One job failing must not bring down the process — other jobs keep running.
    log.error('worker', `${job.name} failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    const ms = Date.now() - started;
    if (ms > 5000) log.warn('worker', `${job.name} took ${ms}ms`);
  }
}

async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  log.info(
    'worker',
    `cache=${cacheBackend()} db=${dbBackend()} env=${process.env.RC_ENV ?? 'dev'}`,
  );

  await getDb().migrate();

  // Initial order matters: news runs first so heat score has material to work with.
  await safeRun(JOBS[1] as Job);
  await Promise.all([safeRun(JOBS[0] as Job), safeRun(JOBS[3] as Job), safeRun(JOBS[4] as Job)]);
  await safeRun(JOBS[5] as Job);
  await safeRun(JOBS[2] as Job);

  if (once) {
    log.info('worker', '--once mode complete');
    await getDb().close();
    return;
  }

  for (const job of JOBS) {
    timers.push(setInterval(() => void safeRun(job), job.everyMs));
  }
  log.info('worker', `${JOBS.length} jobs scheduled`);
}

function shutdown(signal: string): void {
  if (stopping) return;
  stopping = true;
  log.info('worker', `${signal} received, stopping`);
  for (const timer of timers) clearInterval(timer);
  void getDb()
    .close()
    .finally(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

await main();
