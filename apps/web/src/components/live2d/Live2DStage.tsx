'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { PodIcon } from '@/components/icons';
import { CardHead, Pill, cx } from '@/components/ui';

import { MOODS, MOOD_GLOW, MOOD_LABEL, type Mood } from './expressions';
import type { Live2DHandle, StageStatus } from './Live2DCanvas';

/**
 * The SDK loads dynamically with `ssr: false` so other pages' bundles don't
 * carry it (brief §5).
 */
const Live2DCanvas = dynamic(() => import('./Live2DCanvas').then((m) => m.Live2DCanvas), {
  ssr: false,
  loading: () => null,
});

/**
 * Live2D stage (brief §5): a 400px canvas inside a card, interaction held
 * until the model finishes loading, and a skeleton — not a blank screen —
 * while it waits.
 */
export function Live2DStage() {
  const handle = useRef<Live2DHandle | null>(null);
  const [status, setStatus] = useState<StageStatus>('loading');
  const [mood, setMood] = useState<Mood>('relaxed');

  const ready = status === 'ready';
  const noWebGL = status === 'unsupported' || status === 'failed';

  // The model boots with no expression applied at all — `mood` defaults to
  // 'relaxed' as a UI label, but nothing has told the model to actually show
  // it yet. Apply it for real the moment the stage is ready, once.
  useEffect(() => {
    if (ready) handle.current?.setExpression(mood);
    // Only ever meant to fire on the ready transition, not on every mood change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const pick = (next: Mood) => {
    // Re-clicking the mood that's already showing would still clear and
    // re-push the same expression (see Live2DCanvas's `setExpression`) —
    // harmless, but skip the no-op work.
    if (next === mood) return;
    setMood(next);
    handle.current?.setExpression(next);
  };

  return (
    <section
      className="card overflow-hidden transition-shadow duration-700"
      style={{ boxShadow: ready ? MOOD_GLOW[mood] : undefined }}
    >
      <CardHead
        title="Robinchan"
        aside={
          <Pill tone={ready ? 'accent' : 'muted'}>
            {status === 'loading' ? 'loading model' : ready ? MOOD_LABEL[mood] : 'static mode'}
          </Pill>
        }
      />

      <div className="relative h-[400px] bg-surface-2">
        {noWebGL ? (
          <StaticFallback reason={status} />
        ) : (
          <Live2DCanvas handleRef={handle} onStatus={setStatus} className="h-full w-full" />
        )}
        {status === 'loading' ? <StageSkeleton /> : null}
      </div>

      <div className="border-t border-border-soft p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="t-eyebrow">Expression</span>
          {noWebGL ? (
            <span className="font-mono text-[11px] text-text-3">
              {status === 'unsupported' ? 'WebGL unavailable' : 'Model unavailable'}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {MOODS.map((option) => (
            <button
              key={option}
              type="button"
              // Interaction is held until the model finishes loading.
              disabled={!ready}
              onClick={() => pick(option)}
              aria-pressed={mood === option}
              className={cx(
                'min-h-[40px] rounded-full border px-4 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                mood === option && ready
                  ? 'border-accent/45 bg-accent/[0.07] text-text'
                  : 'border-border text-text-2 hover:border-text-3 hover:text-text',
              )}
            >
              {MOOD_LABEL[option]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-text-3">
          In M3 this expression switches on its own from chat replies. The voice button ships
          alongside VOICEVOX in phase 2 — until then, her mouth is deliberately left idle.
        </p>
      </div>
    </section>
  );
}

/**
 * A skeleton that breathes in accent color, not gray — the stage should
 * already feel alive before the model arrives. Three dots arranged like an
 * edamame pod, not a generic spinner (design.md §5).
 */
function StageSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-surface-2">
      <div className="h-[168px] w-[120px] animate-breathe rounded-[60px] bg-accent/25" />
      <div className="flex items-end gap-1.5" role="status" aria-label="Loading model">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-pod-bounce rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Fallback without WebGL (brief §5): a static character image, speak button
 * hidden.
 *
 * The `.moc3` file isn't an image, and the raw texture is just an atlas of
 * body-part cutouts, so nothing in the model package can be used as-is. Until
 * a proper static render of Zundamon is available separately, this slot gets
 * an honest placeholder — and its path stays in one place, swapped alongside
 * the model.
 */
function StaticFallback({ reason }: { reason: StageStatus }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-border bg-surface text-accent">
        <PodIcon width={38} height={38} />
      </span>
      <p className="max-w-[320px] text-[13px] leading-relaxed text-text-3">
        {reason === 'unsupported'
          ? "This browser doesn't provide WebGL, so the model can't be drawn."
          : "The model failed to load. The asset may be incomplete, or Cubism Core couldn't be fetched."}{' '}
        Chat and market data keep working as usual.
      </p>
    </div>
  );
}
