import { LockIcon, WaveformIcon } from '@/components/icons';
import { cx } from '@/components/ui';

/**
 * Three tier cards (brief §5): Voice (free), Long-term memory (Tier 2),
 * Custom personality (Tier 3).
 *
 * The real lock state is read from `GET /api/user/tier` in M3. Until a
 * wallet is connected, everything shows locked with a connect CTA — that's
 * the actual default state the brief specifies, not a placeholder.
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
    id: 'voice',
    name: 'Voice',
    tier: 'Free',
    body: 'Robinchan reads out market summaries and her replies out loud, with lip-sync moving along.',
    bullets: [
      'VOICEVOX text-to-speech',
      'Lip-sync driven by audio amplitude',
      'Falls back to idle automatically if TTS goes down',
    ],
    voice: true,
  },
  {
    id: 'memory',
    name: 'Long-term memory',
    tier: 'Tier 2',
    body: "Remembers your watchlist, reading habits, and past conversation context — no starting from zero every session.",
    bullets: ['History across devices', 'Per-symbol alerts', 'Heat score with full component detail'],
  },
  {
    id: 'personality',
    name: 'Custom personality',
    tier: 'Tier 3',
    body: "Tune her tone and how far she's allowed to offer an opinion, not just read out numbers.",
    bullets: ['Custom speaking tone', 'Limit orders', 'Full heat board access'],
  },
];

export function TierCards() {
  return (
    <section aria-label="Tiers" className="grid gap-4 md:grid-cols-3">
      {TIERS.map((tier) => (
        <article
          key={tier.id}
          className={cx(
            'card relative flex flex-col overflow-hidden p-6',
            // Locked means "not yet", not "broken" — dim and soft, not
            // covered by a flat gray overlay (design.md §5).
            'opacity-[0.82]',
          )}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-text-2">
              {tier.tier}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-3">
              <LockIcon />
              locked
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
