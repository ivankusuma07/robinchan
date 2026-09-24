import { CHAT_MOODS, type ChatMood } from '@robinchan/shared';

const TAG = /\s*\[\[mood:(happy|focused|alert|relaxed)\]\]\s*$/i;

/**
 * Strips the trailing `[[mood:X]]` tag `persona.ts` asks the model to end
 * every reply with (brief §5's LLM-driven expression changes), and returns
 * the mood it named. Never throws on a missing or malformed tag — a model
 * that forgets it, or gets cut off by a token limit before finishing it,
 * still gets its reply shown as-is; `mood` is just `null` and the Live2D
 * stage simply doesn't change expression for that turn.
 */
export function extractMoodTag(text: string): { visible: string; mood: ChatMood | null } {
  const match = TAG.exec(text);
  if (!match?.[1]) return { visible: text, mood: null };
  const mood = match[1].toLowerCase() as ChatMood;
  if (!CHAT_MOODS.includes(mood)) return { visible: text, mood: null };
  return { visible: text.slice(0, match.index), mood };
}
