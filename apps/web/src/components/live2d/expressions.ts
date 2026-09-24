import { CHAT_MOODS, type ChatMood } from '@robinchan/shared';

/**
 * Expression map (brief §5): `happy`, `focused`, `alert`, `relaxed`.
 *
 * The names on the left are the product contract — used by UI buttons and
 * (now) triggered by LLM replies too, via `ExpressionBus`. The names on the
 * right are entries inside the currently installed asset's `model3.json`.
 * This separation is what lets the model be swapped via
 * `NEXT_PUBLIC_LIVE2D_MODEL_URL` without touching page code.
 *
 * The mood set itself (`CHAT_MOODS`) lives in `@robinchan/shared` so the API
 * can validate a chat reply's mood tag against the same list — re-exported
 * here under this module's existing names so nothing importing `MOODS`/
 * `Mood` from here needs to change.
 */
export const MOODS = CHAT_MOODS;

export type Mood = ChatMood;

export const MOOD_TO_EXPRESSION: Record<Mood, string> = {
  happy: 'exp_smile',
  focused: 'exp_03',
  alert: 'exp_surprise',
  // Not `exp_sleep`: that file selects the same `ParamEyeType4` eye shape as
  // `exp_03` (focused), so the two ended up looking almost identical —
  // `exp_relaxed` is a small custom expression added alongside the asset
  // (apps/web/public/live2d/zundamon/expressions/exp_relaxed.exp3.json)
  // that softens the brows and half-closes the eyes without touching any
  // eye-shape toggle another mood already uses.
  relaxed: 'exp_relaxed',
};

export const MOOD_LABEL: Record<Mood, string> = {
  happy: 'Happy',
  focused: 'Focused',
  alert: 'Alert',
  relaxed: 'Relaxed',
};

/**
 * Subtle shift in stage-frame glow color/intensity per expression
 * (design.md §5). Deliberately small — this is an ambient detail, not a
 * signal.
 */
export const MOOD_GLOW: Record<Mood, string> = {
  happy: '0 0 34px rgba(163, 230, 53, 0.45)',
  focused: '0 0 22px rgba(163, 230, 53, 0.3)',
  alert: '0 0 30px rgba(249, 168, 190, 0.45)',
  relaxed: '0 0 18px rgba(163, 230, 53, 0.2)',
};

export const MODEL_URL =
  process.env.NEXT_PUBLIC_LIVE2D_MODEL_URL ?? '/live2d/zundamon/zundamon.model3.json';

/** Cubism Core isn't published on npm; Live2D's official CDN is the only path. */
export const CUBISM_CORE_URL =
  'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
