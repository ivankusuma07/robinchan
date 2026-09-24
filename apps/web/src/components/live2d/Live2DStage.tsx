'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import {
  STAGE_BACKGROUNDS,
  StageBackdrop,
  type StageBackgroundId,
} from '@/components/effects/StageBackdrop';
import {
  BackgroundIcon,
  CheckIcon,
  PodIcon,
  VoiceOffIcon,
  VoiceOnIcon,
} from '@/components/icons';
import { Pill, cx } from '@/components/ui';

import { useExpressionBus } from './ExpressionBus';
import { MOODS, MOOD_GLOW, MOOD_LABEL, VOICE_CREDIT, type Mood } from './expressions';
import type { Live2DHandle, StageStatus } from './Live2DCanvas';
import { useStageVoice, type StageVoice } from './useStageVoice';

/**
 * The SDK loads dynamically with `ssr: false` so other pages' bundles don't
 * carry it (brief §5).
 */
const Live2DCanvas = dynamic(() => import('./Live2DCanvas').then((m) => m.Live2DCanvas), {
  ssr: false,
  loading: () => null,
});

const BG_STORAGE_KEY = 'robinchan.stage-bg';

/**
 * Live2D stage (brief §5) as the page's centrepiece: a large frame with the
 * selectable video backdrop (`<StageBackdrop>`) filling it, the character
 * full-body in the middle, and its controls floating over the top edge —
 * expressions on the left, background picker on the right. Interaction is
 * held until the model finishes loading, with a skeleton (not a blank
 * screen) while it waits.
 *
 * The page floats the chat and market cards over this frame's sides on wide
 * screens, and the composer under her feet; the canvas area is inset so the
 * figure clears both the top controls and that composer.
 *
 * `voiceEnabled` (FEATURE_VOICE) adds the voice toggle next to the
 * background picker. Without WebGL there's no mouth to move, so the toggle
 * is hidden along with the model (brief §5).
 */
export function Live2DStage({
  className,
  voiceEnabled = false,
}: {
  className?: string;
  voiceEnabled?: boolean;
}) {
  const handle = useRef<Live2DHandle | null>(null);
  const [status, setStatus] = useState<StageStatus>('loading');
  const [mood, setMood] = useState<Mood>('relaxed');
  const [bg, setBg] = useState<StageBackgroundId>('valley');
  const expressionBus = useExpressionBus();
  const voice = useStageVoice(handle, { enabled: voiceEnabled, ready: status === 'ready' });

  // The picked background is a per-viewer convenience, so it lives in
  // localStorage — read after mount to keep SSR and first paint in sync, and
  // wrapped because storage can be blocked or throw.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BG_STORAGE_KEY);
      if (STAGE_BACKGROUNDS.some((b) => b.id === saved)) setBg(saved as StageBackgroundId);
    } catch {
      /* Storage unavailable — keep the default. */
    }
  }, []);

  const pickBg = (next: StageBackgroundId) => {
    setBg(next);
    try {
      window.localStorage.setItem(BG_STORAGE_KEY, next);
    } catch {
      /* Not persisted; the choice still applies for this visit. */
    }
  };

  const ready = status === 'ready';
  const noWebGL = status === 'unsupported' || status === 'failed';

  // The model boots with no expression applied at all — `mood` defaults to
  // 'relaxed' as a UI label, but nothing has told the model to actually show
  // it yet. Apply it for real the moment the stage is ready, once, and hand
  // this stage's handle to the expression bus so a chat reply elsewhere on
  // the page can drive it too (brief §5).
  useEffect(() => {
    if (!ready) return;
    handle.current?.setExpression(mood);
    expressionBus.registerHandle(handle.current);
    return () => expressionBus.registerHandle(null);
    // Only ever meant to fire on the ready transition, not on every mood change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keeps the button row in sync regardless of *what* triggered the change
  // — a manual click and a chat-driven mood both flow through the bus.
  useEffect(() => expressionBus.subscribe(setMood), [expressionBus]);

  const pick = (next: Mood) => {
    // Re-clicking the mood that's already showing would still clear and
    // re-push the same expression (see Live2DCanvas's `setExpression`) —
    // harmless, but skip the no-op work.
    if (next === mood) return;
    expressionBus.requestExpression(next);
  };

  return (
    <section
      aria-label="Robinchan stage"
      className={cx(
        'relative overflow-hidden rounded-card border border-border bg-surface-2 transition-shadow duration-700',
        className,
      )}
      style={{ boxShadow: ready ? MOOD_GLOW[mood] : undefined }}
    >
      <StageBackdrop active={bg} className="absolute inset-0" />

      {/* Canvas area. Inset from the top so her head clears the controls,
          and on xl from the bottom so her feet clear the composer the page
          docks there. Pixi sizes itself to this box (`resizeTo` = parent). */}
      <div className="absolute inset-x-0 bottom-3 top-[120px] sm:top-[76px] xl:bottom-[88px]">
        {noWebGL ? (
          <StaticFallback reason={status} />
        ) : (
          <Live2DCanvas handleRef={handle} onStatus={setStatus} className="h-full w-full" />
        )}
      </div>
      {status === 'loading' ? <StageSkeleton /> : null}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!ready ? (
            <Pill tone="muted" className="h-11 bg-bg/60 backdrop-blur-md">
              {status === 'loading'
                ? 'loading model'
                : status === 'unsupported'
                  ? 'WebGL unavailable'
                  : 'model unavailable'}
            </Pill>
          ) : null}

          <div
            role="group"
            aria-label="Expression"
            className="card-glass flex flex-wrap gap-1 rounded-full p-1"
          >
            {MOODS.map((option) => (
              <button
                key={option}
                type="button"
                // Interaction is held until the model finishes loading.
                disabled={!ready}
                onClick={() => pick(option)}
                aria-pressed={mood === option}
                className={cx(
                  'h-11 rounded-full px-4 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                  mood === option && ready
                    ? 'bg-accent text-accent-ink'
                    : 'text-text-2 hover:bg-text/[0.06] hover:text-text',
                )}
              >
                {MOOD_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {voiceEnabled && !noWebGL ? <VoiceToggle voice={voice} disabled={!ready} /> : null}
          <BackgroundMenu value={bg} onChange={pickBg} />
        </div>
      </div>

      {/* VOICEVOX credit, required wherever the voice is heard. Bottom-right
          is the one corner the page never floats a card or the composer
          over, at any width. */}
      {voice.on ? (
        <p
          className={cx(
            'absolute bottom-3 right-4 rounded-full bg-bg/80 px-2.5 py-1 font-mono text-[11px] backdrop-blur-md',
            voice.unavailable ? 'text-down' : 'text-text-2',
          )}
          aria-live="polite"
        >
          {voice.unavailable ? 'voice unavailable right now' : VOICE_CREDIT}
        </p>
      ) : null}
    </section>
  );
}

function VoiceToggle({ voice, disabled }: { voice: StageVoice; disabled: boolean }) {
  const label = voice.on ? 'Voice on' : 'Voice off';
  return (
    <button
      type="button"
      onClick={voice.toggle}
      disabled={disabled}
      aria-pressed={voice.on}
      title={voice.on ? 'Robinchan reads her replies out loud' : 'Let Robinchan read her replies out loud'}
      className={cx(
        'card-glass flex h-[52px] items-center gap-2 rounded-full px-5 text-[13px] transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-45',
        voice.on ? 'text-text' : 'text-text-2',
      )}
    >
      {voice.on ? <VoiceOnIcon className="text-accent" /> : <VoiceOffIcon />}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  );
}

/**
 * The background picker: a single glass button that opens a short list of
 * the stage loops. Closes on a pick, Escape, or a click anywhere outside.
 */
function BackgroundMenu({
  value,
  onChange,
}: {
  value: StageBackgroundId;
  onChange: (next: StageBackgroundId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="card-glass flex h-[52px] items-center gap-2 rounded-full px-5 text-[13px] text-text transition-colors hover:border-white/25"
      >
        <BackgroundIcon />
        <span className="hidden sm:inline">Background</span>
        <span className="sr-only sm:hidden">Background</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Stage background"
          className="card-glass absolute right-0 top-[calc(100%+8px)] z-10 w-[200px] p-1.5"
        >
          {STAGE_BACKGROUNDS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={value === option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
              className={cx(
                'flex h-11 w-full items-center justify-between gap-3 rounded-panel px-3.5 text-left text-[13px] transition-colors',
                value === option.id
                  ? 'text-text'
                  : 'text-text-2 hover:bg-text/[0.06] hover:text-text',
              )}
            >
              {option.label}
              {value === option.id ? <CheckIcon className="text-accent" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
 * the model. Sits on a glass pane since the stage video runs behind it.
 */
function StaticFallback({ reason }: { reason: StageStatus }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="card-glass flex max-w-[360px] flex-col items-center gap-4 p-6 text-center">
        <span className="flex h-[92px] w-[92px] items-center justify-center rounded-full border border-border bg-surface text-accent">
          <PodIcon width={38} height={38} />
        </span>
        <p className="text-[13px] leading-relaxed text-text-2">
          {reason === 'unsupported'
            ? "This browser doesn't provide WebGL, so the model can't be drawn."
            : "The model failed to load. The asset may be incomplete, or Cubism Core couldn't be fetched."}{' '}
          Chat and market data keep working as usual.
        </p>
      </div>
    </div>
  );
}
