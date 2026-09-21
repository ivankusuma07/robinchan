import type { FastifyInstance } from 'fastify';
import type { MediaChannel, MediaClip } from '@robinchan/shared';

import { emptyEnvelope, envelope, readCached } from '../lib/envelope.js';

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/media/channels', async () => {
    const hit = await readCached<MediaChannel[]>('media', 'channels');
    if (!hit) return emptyEnvelope<MediaChannel[]>([]);
    return envelope(hit.data, hit);
  });

  app.get('/api/media/clips', async () => {
    const hit = await readCached<MediaClip[]>('media', 'clips');
    if (!hit) return emptyEnvelope<MediaClip[]>([]);
    return envelope(hit.data, hit);
  });
}
