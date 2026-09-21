import { LockIcon, WaveformIcon } from '@/components/icons';
import { cx } from '@/components/ui';

/**
 * Tiga kartu tier (brief §5): Suara (gratis), Memori panjang (Tier 2),
 * Kepribadian custom (Tier 3).
 *
 * Status kunci sesungguhnya dibaca dari `GET /api/user/tier` di M3. Sampai
 * wallet tersambung, semuanya tampil terkunci dengan CTA connect — itu memang
 * keadaan default yang ditentukan brief, bukan placeholder.
 */

type Tier = {
  id: string;
  name: string;
  tier: string;
  body: string;
  bullets: string[];
  voice?: boolean;
};

const TIERS: Tier[] = [
  {
    id: 'suara',
    name: 'Suara',
    tier: 'Gratis',
    body: 'Robinchan membacakan ringkasan market dan balasannya dengan suara, dengan lip-sync yang ikut bergerak.',
    bullets: [
      'Text-to-speech VOICEVOX',
      'Lip-sync dari amplitudo audio',
      'Mati otomatis kalau TTS turun',
    ],
    voice: true,
  },
  {
    id: 'memori',
    name: 'Memori panjang',
    tier: 'Tier 2',
    body: 'Ingat watchlist, kebiasaan baca, dan konteks percakapan lama — tidak mulai dari nol tiap sesi.',
    bullets: ['Riwayat lintas perangkat', 'Alert per simbol', 'Heat score dengan rincian komponen'],
  },
  {
    id: 'kepribadian',
    name: 'Kepribadian custom',
    tier: 'Tier 3',
    body: 'Atur nada bicara dan seberapa jauh dia boleh memberi pendapat, bukan cuma membacakan angka.',
    bullets: ['Nada bicara custom', 'Limit order', 'Akses penuh heat board'],
  },
];

export function TierCards() {
  return (
    <section aria-label="Tier" className="grid gap-4 md:grid-cols-3">
      {TIERS.map((tier) => (
        <article
          key={tier.id}
          className={cx(
            'card relative flex flex-col overflow-hidden p-6',
            // Terkunci berarti "belum", bukan "rusak" — redup dan lembut,
            // bukan tertutup lapisan abu rata (design.md §5).
            'opacity-[0.82]',
          )}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-text-2">
              {tier.tier}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-3">
              <LockIcon />
              terkunci
            </span>
          </div>

          <h3 className="t-h3 mb-2.5 flex items-center gap-2">
            {tier.name}
            {tier.voice ? <WaveformIcon className="text-companion-pink" /> : null}
          </h3>

          <p className="t-small mb-5 text-[13px] leading-relaxed">{tier.body}</p>

          <ul className="mt-auto space-y-2 border-t border-border-soft pt-5">
            {tier.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-[12px] text-text-3">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-text-3" aria-hidden />
                {bullet}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
