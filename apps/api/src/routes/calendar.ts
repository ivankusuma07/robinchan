import type { FastifyInstance } from 'fastify';
import type { CalendarEvent } from '@robinchan/shared';
import { getDb } from '@robinchan/store';
import { z } from 'zod';

import { ApiFailure, envelope, readCached } from '../lib/envelope.js';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(5),
});

export async function calendarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/calendar', async (request) => {
    const parsed = query.safeParse(request.query);
    if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'invalid limit');

    const hit = await readCached<CalendarEvent[]>('calendar', 'upcoming');
    if (hit) return envelope(hit.data.slice(0, parsed.data.limit), hit);

    const rows = await getDb().listCalendar(parsed.data.limit);
    return envelope(rows, { stale: rows.length === 0 });
  });
}
