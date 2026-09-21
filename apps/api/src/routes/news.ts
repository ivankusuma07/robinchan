import type { FastifyInstance } from 'fastify';
import type { NewsItem } from '@robinchan/shared';
import { NEWS_CATEGORIES } from '@robinchan/shared';
import { getDb } from '@robinchan/store';
import { z } from 'zod';

import { ApiFailure, envelope, readCached } from '../lib/envelope.js';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cat: z.enum(NEWS_CATEGORIES).optional(),
  symbol: z
    .string()
    .regex(/^[A-Za-z0-9.\-]{1,12}$/)
    .optional(),
  pinned: z.enum(['true', 'false']).optional(),
});

export async function newsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/news', async (request) => {
    const parsed = query.safeParse(request.query);
    if (!parsed.success) {
      throw new ApiFailure('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'query tidak valid');
    }
    const { limit, cat, symbol, pinned } = parsed.data;

    // Jalur cepat: feed default dilayani langsung dari cache yang ditulis worker.
    if (!cat && !symbol && !pinned) {
      const hit = await readCached<NewsItem[]>('news', 'latest');
      if (hit) return envelope(hit.data.slice(0, limit), hit);
    }

    // Query bersaring jatuh ke Postgres — masih baca dari penyimpanan sendiri,
    // tidak pernah memanggil provider saat permintaan masuk (brief §8).
    const rows = await getDb().listNews({
      limit,
      cat,
      symbol: symbol?.toUpperCase(),
      pinnedOnly: pinned === 'true',
    });

    const newest = rows[0]?.publishedAt;
    return envelope(rows, {
      stale: newest ? Date.now() - Date.parse(newest) > 30 * 60_000 : true,
    });
  });
}
