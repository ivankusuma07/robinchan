/**
 * Longest chunk sent to `POST /api/tts` — well under its 300-character cap.
 * Measured on a 16-core machine: synthesis runs ~23ms per character (213
 * characters took 5s and made 31s of audio), so 140 keeps one request
 * comfortably inside the API's 8-second provider timeout on a smaller CPU,
 * and playback (several times longer than synthesis) hides the next one.
 */
export const SPEECH_CHUNK_MAX = 140;

/** The first chunk is shorter still: it's the only synthesis the listener actually waits for. */
export const SPEECH_FIRST_CHUNK_MAX = 80;

/**
 * How many chunks of one reply get spoken (~1,300 characters). Replies are
 * meant to be short (persona.ts), so this only trims an unusually long one,
 * rather than queueing a minute and a half of CPU synthesis.
 */
export const SPEECH_MAX_CHUNKS = 6;

/** Text as it should be read aloud: no markdown punctuation, no raw URLs. */
function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A single sentence longer than `max`, cut at the last comma or space that fits. */
function splitLong(sentence: string, max: number): string[] {
  const out: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const window = rest.slice(0, max + 1);
    const cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf(' '));
    const at = cut > max / 2 ? cut + 1 : max;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/**
 * Splits a chat reply into sentence-aligned chunks for TTS, so the client
 * can synthesize chunk N+1 while chunk N plays — the first words start
 * after one short synthesis instead of one long one.
 */
export function splitForSpeech(
  text: string,
  max = SPEECH_CHUNK_MAX,
  maxChunks = SPEECH_MAX_CHUNKS,
  firstMax = Math.min(SPEECH_FIRST_CHUNK_MAX, max),
): string[] {
  const clean = speakable(text);
  if (!clean) return [];

  const sentences = clean
    .split(/(?<=[.!?。！？])\s+/)
    .flatMap((s) => (s.length > max ? splitLong(s, max) : [s]));

  const chunks: string[] = [];
  let current = '';
  const limit = () => (chunks.length === 0 ? firstMax : max);
  for (const sentence of sentences) {
    const pieces =
      chunks.length === 0 && !current && sentence.length > firstMax
        ? splitLong(sentence, firstMax)
        : [sentence];
    for (const piece of pieces) {
      if (!current) current = piece;
      else if (current.length + 1 + piece.length <= limit()) current += ` ${piece}`;
      else {
        chunks.push(current);
        current = piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, maxChunks);
}
