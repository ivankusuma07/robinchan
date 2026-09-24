import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ttsBody } from '@robinchan/shared/schemas';
import { NonRetryableError, ProviderSkipped, callProvider } from '@robinchan/store';

import { SESSION_COOKIE, readSession } from '../auth/session.js';
import { ApiFailure } from '../lib/envelope.js';
import { toVoicevoxText } from '../voice/voicevoxText.js';

/**
 * Zundamon's "normal" style — the VOICEVOX voice that belongs to the
 * Live2D model on stage (design.md §1). Configurable for the same reason
 * the model path is: the voice has to swap alongside the character.
 */
const DEFAULT_SPEAKER = 3;

function endpoint(): string | undefined {
  return process.env.VOICEVOX_ENDPOINT?.replace(/\/+$/, '') || undefined;
}

function speaker(): number {
  const n = Number(process.env.VOICEVOX_SPEAKER);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SPEAKER;
}

async function voicevox(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${endpoint()}${path}`, init);
  if (res.ok) return res;
  const detail = `HTTP ${res.status} from VOICEVOX ${path.split('?')[0]}`;
  // A 4xx is a request the engine will never accept (bad speaker id, bad
  // text) — retrying it three times just delays the same answer.
  throw res.status >= 400 && res.status < 500 ? new NonRetryableError(detail) : new Error(detail);
}

/**
 * Katakana-read English comes out slow at the engine's default pace, and
 * synthesis time scales with audio length — a little faster is both easier
 * to listen to and quicker to make.
 */
const SPEED_SCALE = 1.15;

/** audio_query → synthesis, the engine's two-step API. Returns the WAV bytes. */
async function synthesize(text: string): Promise<Buffer> {
  const id = speaker();
  const query = await voicevox(`/audio_query?text=${encodeURIComponent(text)}&speaker=${id}`, {
    method: 'POST',
  });
  const wav = await voicevox(`/synthesis?speaker=${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...((await query.json()) as object), speedScale: SPEED_SCALE }),
  });
  return Buffer.from(await wav.arrayBuffer());
}

/**
 * `POST /api/tts` (brief §5 lip-sync, §11 VOICEVOX). Not in the brief's
 * endpoint table — voice was phase 2 when it was written — so it follows
 * the same rules as the other wallet endpoints: behind a flag, wallet-gated
 * (the Voice tier card is the free tier, i.e. any signed-in wallet), rate
 * limited per address.
 *
 * Success is raw `audio/wav`, not the `{ data }` envelope: base64 inside
 * JSON would add a third to every clip for nothing. Errors keep the usual
 * `{ error }` shape.
 */
export async function ttsRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/tts',
    {
      config: {
        rateLimit: {
          // A reply is spoken in a few sentence-sized chunks, so this is
          // roughly ten replies a minute.
          max: 40,
          timeWindow: '1 minute',
          keyGenerator: async (request: FastifyRequest) =>
            (await readSession(request.cookies[SESSION_COOKIE]))?.address ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      if (process.env.FEATURE_VOICE !== 'true') {
        throw new ApiFailure('NOT_FOUND', 'unknown endpoint', 404);
      }
      const session = await readSession(request.cookies[SESSION_COOKIE]);
      if (!session) throw new ApiFailure('WALLET_REQUIRED', 'connect and sign in first', 401);

      const parsed = ttsBody.safeParse(request.body);
      if (!parsed.success) throw new ApiFailure('BAD_REQUEST', 'text is required (300 characters max)');

      let wav: Buffer;
      try {
        wav = await callProvider({ id: 'voicevox', configured: Boolean(endpoint()) }, () =>
          synthesize(toVoicevoxText(parsed.data.text)),
        );
      } catch (err) {
        if (!(err instanceof ProviderSkipped)) app.log.warn(err, 'voicevox synthesis failed');
        throw new ApiFailure('UPSTREAM_DOWN', 'voice is unavailable right now', 503);
      }

      return reply.header('content-type', 'audio/wav').header('cache-control', 'no-store').send(wav);
    },
  );
}
