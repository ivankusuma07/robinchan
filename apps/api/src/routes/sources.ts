import type { FastifyInstance } from 'fastify';
import type { SourceState, SourceStatus } from '@robinchan/shared';
import { SOURCE_SLOTS } from '@robinchan/shared';
import { cacheKey, getCache } from '@robinchan/store';

import { envelope } from '../lib/envelope.js';

type StoredHealth = {
  state: SourceState;
  lastOkAt: string | null;
  note: string;
};

const OK_WINDOW_MS = 5 * 60_000;

/**
 * Hijau kalau provider merespons dalam 5 menit terakhir, abu kalau belum
 * dikonfigurasi, merah kalau gagal (brief §6). Kartu ini sekaligus panel
 * diagnosa waktu ada feed yang mati.
 */
export async function sourcesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/sources/status', async () => {
    const cache = getCache();

    const statuses: SourceStatus[] = await Promise.all(
      SOURCE_SLOTS.map(async (slot) => {
        const health = await cache.get<StoredHealth>(cacheKey('source', slot.id));
        if (!health) {
          return {
            ...slot,
            state: 'idle' as const,
            lastOkAt: null,
            note: 'belum dikonfigurasi',
          };
        }

        const fresh =
          health.lastOkAt != null && Date.now() - Date.parse(health.lastOkAt) < OK_WINDOW_MS;

        let state: SourceState = health.state;
        // Pernah hijau tapi sudah lewat lima menit tanpa respons baru: turunkan
        // ke merah, jangan biarkan status lama terlihat masih sehat.
        if (health.state === 'ok' && !fresh) state = 'down';

        return {
          ...slot,
          state,
          lastOkAt: health.lastOkAt,
          note: state === 'down' && health.state === 'ok' ? 'tidak ada respons baru' : health.note,
        };
      }),
    );

    return envelope(statuses, { stale: false });
  });
}
