/**
 * Finds English words the VOICEVOX engine spells out letter by letter
 * instead of reading — the source of `KATAKANA` in `voicevoxText.ts`.
 *
 *   npm run probe:voice -w @robinchan/api -- [extra words...]
 *
 * Needs a running engine at VOICEVOX_ENDPOINT (default localhost:50021).
 * A word is flagged when its reading equals its letters' reading, or (for a
 * plural) the singular's reading plus a spelled "S". Words already in
 * `KATAKANA` are checked after the substitution, so a stale entry shows up.
 */
import { KATAKANA, toVoicevoxText } from './voicevoxText.js';

const BASE = (process.env.VOICEVOX_ENDPOINT || 'http://localhost:50021').replace(/\/+$/, '');

const COMMON = `the be to of and a in that have i it for not on with he as you do at this but by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are were been has had did said got made may should must might hi
buy sell hold price market trade trading fee gas quote chain token wallet sign news filing earnings report today yesterday tomorrow week month quarter high low open close volume heat score index dollar percent point up down flat rate data live right sure okay yes hello thanks sorry please help vs`;

const PLURALS = `number price stock share market order fee quote token wallet filing report point rate move day week month year hour trade buyer seller dollar index chart signal level gain loss drop jump deal bid investor analyst fund bond coin chain block user reply question answer reason sector company result call holder account detail note alert limit swap pool pair`;

const norm = (kana: string) => kana.replace(/['/_、]/g, '');

async function kana(text: string): Promise<string> {
  const res = await fetch(`${BASE}/audio_query?speaker=3&text=${encodeURIComponent(text)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`engine answered HTTP ${res.status}`);
  return norm(((await res.json()) as { kana: string }).kana);
}

const spelled = async (word: string) => (await kana(toVoicevoxText(word))) === (await kana(word.toUpperCase().split('').join(' ')));

const letterS = await kana('S');
const flagged: string[] = [];

for (const word of [...new Set([...COMMON.split(/\s+/), ...process.argv.slice(2)])]) {
  if (/^[a-z]{2,}$/.test(word) && (await spelled(word))) flagged.push(word);
}
for (const singular of PLURALS.split(/\s+/)) {
  const plural = `${singular}s`;
  if ((await kana(toVoicevoxText(plural))) === (await kana(singular)) + letterS) flagged.push(plural);
}

console.log(flagged.length === 0 ? 'nothing misread' : `misread: ${flagged.join(', ')}`);
console.log(`(${Object.keys(KATAKANA).length} words already respelled in voicevoxText.ts)`);
