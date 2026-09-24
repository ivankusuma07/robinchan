import { NonRetryableError, callProvider } from '@robinchan/store';

/**
 * The one LLM adapter (plan §5, brief §11). Pages and routes ask for a job
 * — "parse this", later "chat", "heat read" — and never see a provider
 * name; which model answers is configuration:
 *
 *   LLM_PROVIDER   deepseek (the only one wired today)
 *   LLM_BASE_URL   e.g. https://api.deepseek.com
 *   LLM_API_KEY    server-only; never sent to the browser
 *   LLM_MODEL      default model for every job
 *   LLM_MODEL_PARSE  optional override for order parsing only
 *
 * Calls go through the shared provider wrapper: 8s timeout, three attempts
 * with widening backoff, and a circuit breaker that shows up as the `llm`
 * row on `/api/sources/status`. 4xx responses (bad key, bad request) are not
 * retried — retrying can't fix them.
 */

export type LlmJob = 'parse' | 'chat' | 'heat_read' | 'portfolio_read';

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
};

export type ToolCallResult = {
  /** The raw arguments the model produced — unvalidated; the caller runs Zod on them. */
  args: unknown;
  model: string;
  usage: LlmUsage;
};

export class LlmNotConfigured extends Error {
  constructor() {
    super('LLM_API_KEY is not set');
    this.name = 'LlmNotConfigured';
  }
}

/**
 * Provider quirks, kept here and nowhere else. DeepSeek's reasoning
 * ("thinking") mode rejects a forced `tool_choice` — a forced tool call is
 * what makes parsing structured, so that job needs thinking off regardless.
 * Chat also runs with it off: a companion reply should read as her voice,
 * not have a reasoning preamble streamed ahead of it, and it's faster
 * (~0.7s to first token against the 8s connect budget vs. several seconds
 * of reasoning first).
 */
const PROVIDERS: Record<string, { extraBody: Record<string, unknown> }> = {
  deepseek: { extraBody: { thinking: { type: 'disabled' } } },
};

function settings(job: LlmJob) {
  const provider = process.env.LLM_PROVIDER ?? 'deepseek';
  const quirks = PROVIDERS[provider];
  if (!quirks) throw new Error(`unsupported LLM_PROVIDER "${provider}"`);
  return {
    provider,
    quirks,
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.deepseek.com').replace(/\/+$/, ''),
    apiKey: process.env.LLM_API_KEY ?? '',
    model: (job === 'parse' && process.env.LLM_MODEL_PARSE) || process.env.LLM_MODEL || 'deepseek-flash',
  };
}

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

type Log = (entry: Record<string, unknown>) => void;
let log: Log = (entry) => console.info(JSON.stringify(entry));

/** Route usage lines into the app's logger instead of stdout. */
export function setLlmLogger(next: Log): void {
  log = next;
}

type ChatCompletion = {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
};

/**
 * One forced tool call at temperature 0 — the deterministic shape parsing
 * needs (brief §12: function calling, not regex or free-form prompts).
 */
export async function callTool(req: {
  job: LlmJob;
  system: string;
  user: string;
  tool: ToolSpec;
  maxTokens?: number;
}): Promise<ToolCallResult> {
  const cfg = settings(req.job);
  if (!cfg.apiKey) throw new LlmNotConfigured();

  const started = Date.now();
  const body = await callProvider({ id: 'llm', configured: true }, async () => {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0,
        max_tokens: req.maxTokens ?? 400,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        tools: [{ type: 'function', function: req.tool }],
        tool_choice: { type: 'function', function: { name: req.tool.name } },
        ...cfg.quirks.extraBody,
      }),
    });
    if (!res.ok) {
      // Never echo the response body into logs verbatim — keep it short.
      const detail = (await res.text()).slice(0, 160);
      const message = `LLM HTTP ${res.status}: ${detail}`;
      // 429 and 5xx can clear on their own; other 4xx can't.
      if (res.status !== 429 && res.status < 500) throw new NonRetryableError(message);
      throw new Error(message);
    }
    return (await res.json()) as ChatCompletion;
  });

  const call = body.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === req.tool.name);
  const usage: LlmUsage = {
    promptTokens: body.usage?.prompt_tokens ?? 0,
    completionTokens: body.usage?.completion_tokens ?? 0,
    cachedTokens:
      body.usage?.prompt_cache_hit_tokens ?? body.usage?.prompt_tokens_details?.cached_tokens ?? 0,
  };

  // Per-job usage, to watch cost (plan §5).
  log({
    msg: 'llm_usage',
    job: req.job,
    provider: cfg.provider,
    model: body.model ?? cfg.model,
    ms: Date.now() - started,
    ...usage,
  });

  if (!call?.function?.arguments) {
    throw new Error(`LLM returned no ${req.tool.name} call (finish: ${body.choices?.[0]?.finish_reason ?? 'unknown'})`);
  }

  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments);
  } catch {
    throw new Error(`LLM returned malformed ${req.tool.name} arguments`);
  }
  return { args, model: body.model ?? cfg.model, usage };
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const ZERO_USAGE: LlmUsage = { promptTokens: 0, completionTokens: 0, cachedTokens: 0 };

/**
 * A streamed conversational reply. Yields text deltas as they arrive and
 * resolves once the stream ends, with the full text and token usage — the
 * caller (the chat route) forwards each delta to the browser as its own SSE
 * event and persists the joined text as one `chat_messages` row.
 *
 * Only the connection itself goes through the shared provider wrapper
 * (`callProvider`, brief §11) — its 8s timeout covers getting a response
 * and its headers, not how long the reply takes to finish streaming, and a
 * connection failure still counts toward the `llm` circuit breaker exactly
 * like `callTool`'s. Once tokens start arriving there is no retry: replaying
 * a partially-spoken reply from the top would be a worse experience than
 * just ending it, and the user can always send another message.
 */
export async function streamChat(req: {
  job: LlmJob;
  system: string;
  turns: ChatTurn[];
  maxTokens?: number;
  onDelta: (text: string) => void;
  /** Aborted if the caller (e.g. the browser) disconnects mid-reply — stops paying for tokens nobody reads. */
  signal?: AbortSignal;
}): Promise<{ text: string; model: string; usage: LlmUsage }> {
  const cfg = settings(req.job);
  if (!cfg.apiKey) throw new LlmNotConfigured();
  if (req.signal?.aborted) throw new DOMException('aborted before the request started', 'AbortError');

  const started = Date.now();
  const res = await callProvider({ id: 'llm', configured: true }, async () => {
    const r = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      // Connection + headers only — see doc comment above. The caller's
      // signal is layered on top so an early disconnect aborts the
      // in-flight request too, not just the timeout.
      signal: req.signal ? AbortSignal.any([AbortSignal.timeout(8_000), req.signal]) : AbortSignal.timeout(8_000),
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        // A little warmth for a companion voice; still low enough that she
        // doesn't improvise facts (brief §15's "don't state what isn't in
        // the context" rule is enforced by what goes into the prompt, not
        // by temperature, but a lower one keeps her closer to it anyway).
        temperature: 0.4,
        max_tokens: req.maxTokens ?? 500,
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'system', content: req.system }, ...req.turns],
        ...cfg.quirks.extraBody,
      }),
    });
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 160);
      const message = `LLM HTTP ${r.status}: ${detail}`;
      if (r.status !== 429 && r.status < 500) throw new NonRetryableError(message);
      throw new Error(message);
    }
    return r;
  });

  if (!res.body) throw new Error('LLM streaming response had no body');

  let text = '';
  let model = cfg.model;
  let usage = ZERO_USAGE;
  let buffer = '';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const onAbort = () => void reader.cancel('caller disconnected').catch(() => undefined);
  req.signal?.addEventListener('abort', onAbort);
  try {
    while (true) {
      if (req.signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // OpenAI-compatible SSE: `data: {...}\n\n` per event, `data: [DONE]` to close.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const line = event.split('\n').find((l) => l.startsWith('data:'));
        if (!line) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;

        let chunk: {
          model?: string;
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: ChatCompletion['usage'];
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue; // a partial/malformed line — skip rather than abort the whole reply
        }

        if (chunk.model) model = chunk.model;
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          req.onDelta(delta);
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            cachedTokens:
              chunk.usage.prompt_cache_hit_tokens ?? chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          };
        }
      }
    }
  } finally {
    req.signal?.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }

  log({ msg: 'llm_usage', job: req.job, provider: cfg.provider, model, ms: Date.now() - started, ...usage });

  return { text, model, usage };
}
