import { join } from 'node:path';

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config as loadEnv } from 'dotenv';
import Fastify from 'fastify';
import { getDb, repoRoot } from '@robinchan/store';

loadEnv({ path: join(repoRoot(), '.env'), quiet: true });

const { ApiFailure } = await import('./lib/envelope.js');
const { marketRoutes } = await import('./routes/market.js');
const { newsRoutes } = await import('./routes/news.js');
const { mediaRoutes } = await import('./routes/media.js');
const { calendarRoutes } = await import('./routes/calendar.js');
const { heatRoutes } = await import('./routes/heat.js');
const { sourcesRoutes } = await import('./routes/sources.js');
const { healthRoutes } = await import('./routes/health.js');

// `PORT` is the convention most PaaS hosts (Railway, Render, Heroku) inject
// automatically for a service with a public domain; `API_PORT` is our own
// override for local dev and anywhere that convention doesn't apply.
const PORT = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
const HOST = process.env.API_HOST ?? '0.0.0.0';

const app = Fastify({
  // Per-request logging is turned down in production via LOG_LEVEL, not via
  // the `disableRequestLogging` option, which is deprecated in Fastify 5.
  logger: {
    level: process.env.LOG_LEVEL ?? (process.env.RC_ENV === 'production' ? 'warn' : 'info'),
  },
});

app.addHook('onSend', async (_req, reply) => {
  reply.removeHeader('x-powered-by');
});

await app.register(helmet, {
  contentSecurityPolicy: false, // Page CSP is set in Next.js, not the API.
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
});

await app.register(cors, {
  origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  methods: ['GET', 'POST', 'PUT'],
});

/** Public endpoints: 60 requests per minute per IP (brief §9). */
await app.register(rateLimit, {
  max: Number(process.env.RATE_LIMIT_PUBLIC ?? 60),
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    error: {
      code: 'RATE_LIMITED',
      message: 'too many requests, try again shortly',
    },
  }),
});

app.setErrorHandler((err, _request, reply) => {
  if (err instanceof ApiFailure) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
  }
  app.log.error(err);
  return reply.status(500).send({
    error: { code: 'INTERNAL', message: 'an internal error occurred' },
  });
});

app.setNotFoundHandler((_request, reply) =>
  reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'unknown endpoint' } }),
);

await app.register(marketRoutes);
await app.register(newsRoutes);
await app.register(mediaRoutes);
await app.register(calendarRoutes);
await app.register(heatRoutes);
await app.register(sourcesRoutes);
await app.register(healthRoutes);

await getDb().migrate();

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => getDb().close())
      .then(() => process.exit(0));
  });
}
