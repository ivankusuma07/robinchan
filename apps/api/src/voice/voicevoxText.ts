/**
 * Prepares English (and Indonesian) chat text for VOICEVOX, a Japanese
 * engine. Its 0.25 English support converts most words to katakana well,
 * but three things come out wrong — all found by running text through the
 * engine and reading back its `kana` field:
 *
 *  - Digits are read as *Japanese* numbers ("0.61%" → "rei-ten roku ichi
 *    paasento"), so every number, %, and $ is turned into English words.
 *  - Contractions are split at the apostrophe and spelled out ("don't" →
 *    "D-O-N-T"), so they're expanded.
 *  - A handful of common words come out as letter names ("it" → "I-T",
 *    "one" → "on-ee"). Those get a katakana spelling, which the engine
 *    reads natively. An ALL-CAPS word is left alone on purpose: "US",
 *    "IT", and tickers like "NVDA" are meant to be spelled out.
 */

/**
 * Every word here was caught by `npm run probe:voice -w @robinchan/api`
 * (`src/voice/probe.ts`), which runs common words through a live engine and
 * flags the ones it spells out. Add to it the same way — not by ear.
 */
export const KATAKANA: Record<string, string> = {
  a: 'ア',
  as: 'アズ',
  calls: 'コールズ',
  drops: 'ドロップス',
  he: 'ヒー',
  hi: 'ハイ',
  it: 'イット',
  levels: 'レベルズ',
  me: 'ミー',
  no: 'ノー',
  notes: 'ノーツ',
  numbers: 'ナンバーズ',
  one: 'ワン',
  orders: 'オーダーズ',
  stocks: 'ストックス',
  us: 'アス',
  vs: 'バーサス',
  we: 'ウィー',
};

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES: Array<[number, string]> = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
  [1e3, 'thousand'],
];

function underThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}` : `${TENS[Math.floor(n / 10)]}`);
  } else if (n > 0 || parts.length === 0) {
    parts.push(`${ONES[n]}`);
  }
  return parts.join(' ');
}

export function integerToWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) return String(n);
  if (n < 1000) return underThousand(n);
  const parts: string[] = [];
  let rest = n;
  for (const [size, name] of SCALES) {
    if (rest >= size) {
      parts.push(`${underThousand(Math.floor(rest / size))} ${name}`);
      rest %= size;
    }
  }
  if (rest > 0) parts.push(underThousand(rest));
  return parts.join(' ');
}

/** "175.15" → "one hundred seventy five point one five"; digits after the point are read one by one. */
function numberToWords(raw: string): string {
  const [whole = '0', frac] = raw.replace(/,/g, '').split('.');
  const words = integerToWords(Number(whole));
  if (!frac) return words;
  return `${words} point ${[...frac].map((d) => ONES[Number(d)]).join(' ')}`;
}

function ordinal(cardinal: string): string {
  const irregular: Record<string, string> = {
    one: 'first', two: 'second', three: 'third', five: 'fifth',
    eight: 'eighth', nine: 'ninth', twelve: 'twelfth',
  };
  const words = cardinal.split(' ');
  const last = words.pop() ?? '';
  const ord = irregular[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return [...words, ord].join(' ');
}

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bwon['’]t\b/gi, 'will not'],
  [/\bcan['’]t\b/gi, 'cannot'],
  [/\bshan['’]t\b/gi, 'shall not'],
  [/\blet['’]s\b/gi, 'let us'],
  [/\bi['’]m\b/gi, 'I am'],
  [/\b(it|that|what|there|here|he|she|who|where|how)['’]s\b/gi, '$1 is'],
  [/n['’]t\b/gi, ' not'],
  [/['’]re\b/gi, ' are'],
  [/['’]ve\b/gi, ' have'],
  [/['’]ll\b/gi, ' will'],
  [/['’]d\b/gi, ' would'],
  // Anything left is possessive: "Apple's" reads fine as "Apples".
  [/['’]s\b/gi, 's'],
];

const NUMBER = String.raw`\d[\d,]*(?:\.\d+)?`;

export function toVoicevoxText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of CONTRACTIONS) out = out.replace(pattern, replacement);

  out = out
    // $RCHAN is a name, not an amount.
    .replace(/\$(?=[A-Za-z])/g, '')
    .replace(new RegExp(String.raw`([+\-−])?\$\s?(${NUMBER})`, 'g'), (_, sign: string | undefined, n: string) => {
      const amount = numberToWords(n);
      return `${sign ? `${sign}` : ''}${amount} ${amount === 'one' ? 'dollar' : 'dollars'}`;
    })
    .replace(new RegExp(String.raw`(${NUMBER})\s?%`, 'g'), '$1 percent')
    .replace(/(^|[\s(])\+(?=\d)/g, '$1plus ')
    .replace(/(^|[\s(])[-−](?=\d)/g, '$1minus ')
    .replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, n: string) => ordinal(integerToWords(Number(n))))
    .replace(new RegExp(NUMBER, 'g'), (n) => numberToWords(n))
    .replace(/&/g, ' and ');

  return out
    .replace(/[A-Za-z]+/g, (word) => {
      const allCaps = word.length > 1 && word === word.toUpperCase();
      return (!allCaps && KATAKANA[word.toLowerCase()]) || word;
    })
    .replace(/\s+/g, ' ')
    .trim();
}
