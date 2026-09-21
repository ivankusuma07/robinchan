import type { FastifyInstance } from 'fastify';
import type { SourceState } from '@robinchan/shared';
import { SOURCE_SLOTS } from '@robinchan/shared';
import { cacheBackend, cacheKey, dbBackend, getCache, getDb } from '@robinchan/store';

/**
 * One health endpoint that checks Postgres, Redis, and the age of each
 * provider's last update (brief §16). A feed that hasn't refreshed in over
 * 15 minutes is flagged so it can drive an alert.
 */
const ALERT_AFTER_MS = 15 * 60_000;

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    const cache = getCache();
    const [cacheOk, dbOk] = await Promise.all([cache.ping(), getDb().ping()]);

    const feeds = await Promise.all(
      SOURCE_SLOTS.map(async (slot) => {
        const health = await cache.get<{
          state: SourceState;
          lastOkAt: string | null;
        }>(cacheKey('source', slot.id));
        const ageMs = health?.lastOkAt ? Date.now() - Date.parse(health.lastOkAt) : null;
        return {
          id: slot.id,
          state: health?.state ?? 'idle',
          ageSec: ageMs == null ? null : Math.round(ageMs / 1000),
          alerting: health?.state === 'ok' && ageMs != null && ageMs > ALERT_AFTER_MS,
        };
      }),
    );

    const healthy = cacheOk && dbOk;
    reply.status(healthy ? 200 : 503);
    return {
      status: healthy ? 'ok' : 'degraded',
      backends: { cache: cacheBackend(), db: dbBackend() },
      checks: { cache: cacheOk, db: dbOk },
      feeds,
      asOf: new Date().toISOString(),
    };
  });
}
