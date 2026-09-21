/**
 * Skor sentimen −1..1 berbasis leksikon.
 *
 * Ini penopang fase 1. Brief §11 menaruh Alpha Vantage News Sentiment di fase 2;
 * sampai adaptor itu aktif, feed tetap butuh angka supaya titik sentimen di
 * halaman Market dan komponen berita di heat score punya isi. Begitu
 * `ALPHAVANTAGE_API_KEY` terpasang, skor provider yang dipakai dan fungsi ini
 * turun jadi cadangan.
 */

const POSITIVE = [
  'beat',
  'beats',
  'surge',
  'surges',
  'rally',
  'rallies',
  'record',
  'upgrade',
  'upgraded',
  'outperform',
  'profit',
  'profits',
  'growth',
  'gain',
  'gains',
  'jump',
  'jumps',
  'soar',
  'soars',
  'approval',
  'approved',
  'expands',
  'partnership',
  'buyback',
  'dividend',
  'raises',
  'strong',
  'tops',
  'wins',
];

const NEGATIVE = [
  'miss',
  'misses',
  'plunge',
  'plunges',
  'slump',
  'slumps',
  'downgrade',
  'downgraded',
  'underperform',
  'loss',
  'losses',
  'lawsuit',
  'probe',
  'investigation',
  'subpoena',
  'fraud',
  'recall',
  'layoff',
  'layoffs',
  'bankruptcy',
  'halt',
  'halted',
  'fine',
  'fined',
  'warns',
  'warning',
  'cuts',
  'weak',
  'falls',
  'drops',
  'delays',
  'delisting',
];

const POS = new Set(POSITIVE);
const NEG = new Set(NEGATIVE);

export function scoreSentiment(text: string): number {
  const words = text.toLowerCase().match(/[a-z']+/g);
  if (!words || words.length === 0) return 0;
  let score = 0;
  for (const word of words) {
    if (POS.has(word)) score += 1;
    else if (NEG.has(word)) score -= 1;
  }
  if (score === 0) return 0;
  // Redam supaya satu kata kunci tidak langsung memaksimalkan skor.
  const normalized = score / Math.sqrt(Math.max(words.length, 8));
  return Math.max(-1, Math.min(1, Number(normalized.toFixed(3))));
}
