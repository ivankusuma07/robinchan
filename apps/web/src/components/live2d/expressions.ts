/**
 * Peta ekspresi (brief §5): `senang`, `fokus`, `waspada`, `santai`.
 *
 * Nama di kiri adalah kontrak produk — dipakai tombol di UI dan nanti dipicu
 * balasan LLM di M3. Nama di kanan adalah isi `model3.json` milik aset yang
 * sedang dipasang. Pemisahan ini yang membuat model bisa ditukar lewat
 * `NEXT_PUBLIC_LIVE2D_MODEL_URL` tanpa menyentuh kode halaman.
 */
export const MOODS = ['senang', 'fokus', 'waspada', 'santai'] as const;

export type Mood = (typeof MOODS)[number];

export const MOOD_TO_EXPRESSION: Record<Mood, string> = {
  senang: 'exp_smile',
  fokus: 'exp_03',
  waspada: 'exp_surprise',
  santai: 'exp_sleep',
};

export const MOOD_LABEL: Record<Mood, string> = {
  senang: 'Senang',
  fokus: 'Fokus',
  waspada: 'Waspada',
  santai: 'Santai',
};

/**
 * Pergeseran halus warna dan kekuatan glow bingkai stage per ekspresi
 * (design.md §5). Sengaja kecil — ini detail ambien, bukan sinyal.
 */
export const MOOD_GLOW: Record<Mood, string> = {
  senang: '0 0 34px rgba(123, 224, 123, 0.20)',
  fokus: '0 0 22px rgba(123, 224, 123, 0.12)',
  waspada: '0 0 30px rgba(255, 182, 193, 0.16)',
  santai: '0 0 18px rgba(123, 224, 123, 0.07)',
};

export const MODEL_URL =
  process.env.NEXT_PUBLIC_LIVE2D_MODEL_URL ?? '/live2d/zundamon/zundamon.model3.json';

/** Cubism Core tidak dipublikasikan di npm; CDN resmi Live2D satu-satunya jalur. */
export const CUBISM_CORE_URL =
  'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
