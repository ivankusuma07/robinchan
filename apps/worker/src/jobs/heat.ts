import type { HeatComponents } from '@robinchan/shared';
import { WATCHED_SYMBOLS } from '@robinchan/shared';
import { cacheKey, getCache, getDb, type HeatRow } from '@robinchan/store';

import { fixtureOnchain } from '../providers/fixtures.js';
import { log } from '../lib/log.js';

export const HEAT_TTL_SEC = 600;

/**
 * heat = 100 × ( w_o·s_o + w_n·s_n + w_s·s_s )   — brief §13
 *
 * Each component is normalized to 0..1 first, then multiplied by its weight.
 * Weights are read from the environment so they can be tuned without a
 * redeploy.
 */
function weights(): { onchain: number; news: number; social: number } {
  return {
    onchain: Number(process.env.HEAT_WEIGHT_ONCHAIN ?? 0.45),
    news: Number(process.env.HEAT_WEIGHT_NEWS ?? 0.35),
    social: Number(process.env.HEAT_WEIGHT_SOCIAL ?? 0.2),
  };
}

function socialEnabled(): boolean {
  return process.env.FEATURE_SOCIAL_HEAT === 'true';
}

/**
 * Before social is enabled, its weight is redistributed proportionally to
 * the other two components — leaving it at zero would push every score down
 * and make the heat board look dead (brief §13).
 */
function activeWeights(): { onchain: number; news: number; social: number } {
  const w = weights();
  if (socialEnabled()) return w;
  const rest = w.onchain + w.news;
  if (rest <= 0) return { onchain: 0.5625, news: 0.4375, social: 0 };
  return {
    onchain: w.onchain + (w.social * w.onchain) / rest,
    news: w.news + (w.social * w.news) / rest,
    social: 0,
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Volume ratio, holder growth, liquidity health → a single 0..1 number. */
function onchainScore(symbol: string): number {
  const raw = fixtureOnchain(symbol);
  const volume = clamp01(raw.volumeRatio / 2);
  const holders = clamp01(raw.holderGrowth / 0.08);
  const liquidity = clamp01(raw.liquidityHealth);
  return clamp01(volume * 0.5 + holders * 0.25 + liquidity * 0.25);
}

/** Count of news in the last 24 hours multiplied by average sentiment → 0..1. */
function newsScore(count: number, avgSentiment: number): number {
  const volume = clamp01(count / 8);
  // Sentiment −1..1 maps to 0..1; negative news is still "hot".
  const intensity = clamp01(Math.abs(avgSentiment) * 0.6 + 0.4);
  return clamp01(volume * intensity);
}

export async function runHeat(): Promise<void> {
  const db = getDb();
  const w = activeWeights();
  const recent = await db.listNews({ limit: 200 });
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const computedAt = new Date().toISOString();

  const rows: HeatRow[] = WATCHED_SYMBOLS.map((symbol) => {
    const matched = recent.filter(
      (n) => n.symbols.includes(symbol) && Date.parse(n.publishedAt) > cutoff,
    );
    const avg =
      matched.length > 0 ? matched.reduce((sum, n) => sum + n.sentiment, 0) / matched.length : 0;

    const components: HeatComponents = {
      onchain: Number(onchainScore(symbol).toFixed(4)),
      news: Number(newsScore(matched.length, avg).toFixed(4)),
      social: socialEnabled() ? 0 : null,
    };

    const score =
      100 *
      (w.onchain * components.onchain +
        w.news * components.news +
        w.social * (components.social ?? 0));

    return {
      symbol,
      score: Number(score.toFixed(1)),
      // The underlying components are stored, not just the final score —
      // this is what Robinchan will later use to explain why something is
      // hot (brief §13).
      components,
      computedAt,
    };
  }).sort((a, b) => b.score - a.score);

  await db.upsertHeat(rows);
  await getCache().set(cacheKey('heat', 'top'), rows, HEAT_TTL_SEC);
  log.info('heat', `${rows.length} symbols computed (social ${socialEnabled() ? 'on' : 'off'})`);
}
