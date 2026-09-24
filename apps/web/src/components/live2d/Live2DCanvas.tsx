'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { CUBISM_CORE_URL, MODEL_URL, MOOD_TO_EXPRESSION, type Mood } from './expressions';

export type Live2DHandle = {
  setExpression: (mood: Mood) => void;
  /** Plays `audio` with lip-sync; resolves when it ends or is stopped. One clip at a time — a new call cuts the previous one off. */
  speak: (audio: AudioBuffer | ArrayBuffer) => Promise<void>;
  stopSpeaking: () => void;
  /**
   * Creates/resumes the AudioContext. Call from inside a click handler:
   * some browsers (iOS Safari) only let audio start from a user gesture,
   * and the clips themselves arrive later, after an async fetch.
   */
  unlockAudio: () => void;
};

export type StageStatus = 'loading' | 'ready' | 'unsupported' | 'failed';

/**
 * Live2D canvas wrapper (brief §7).
 *
 * Its contract is two methods: `setExpression()` and `speak(audioBuffer)`.
 * All the heavy imports (`pixi.js`, `pixi-live2d-display`) happen inside the
 * effect, so other pages' bundles don't carry them — this component is
 * itself also loaded via `next/dynamic` with `ssr: false` from `Live2DStage`.
 */
export function Live2DCanvas({
  handleRef,
  onStatus,
  className,
}: {
  handleRef?: Ref<Live2DHandle | null>;
  onStatus?: (status: StageStatus) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<Live2DModelLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const [, setReady] = useState(false);

  useImperativeHandle(
    handleRef,
    () => ({
      setExpression(mood: Mood) {
        const model = modelRef.current;
        if (!model) return;
        // Cubism expressions crossfade by weight rather than hard-swapping:
        // the outgoing one fades out over its own FadeOutTime while the
        // incoming one fades in, both applied every frame in the meantime.
        // Clearing the queue first — instead of letting `expression()` push
        // the next one on top of whatever's still fading out — guarantees
        // only ever one expression is blending at a time, so switching back
        // to a mood already seen this session can never end up reading as
        // "stuck" on whichever one had the larger parameter deltas.
        const expressionManager = model.internalModel?.motionManager?.expressionManager;
        expressionManager?.stopAllExpressions?.();
        model.expression?.(MOOD_TO_EXPRESSION[mood]);
      },
      async speak(audio) {
        await playWithLipSync(audio, audioCtxRef, modelRef, playbackRef);
      },
      stopSpeaking() {
        playbackRef.current?.stop();
      },
      unlockAudio() {
        void audioContext(audioCtxRef).resume();
      },
    }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    let app: PixiAppLike | null = null;

    const boot = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // WebGL fallback: if the context isn't available, don't even try to
      // load the SDK — the page shows a static image and hides the speak
      // button (brief §5).
      if (!hasWebGL()) {
        onStatus?.('unsupported');
        return;
      }

      try {
        await loadCubismCore();
        const PIXI = await import('pixi.js');
        const { Live2DModel } = await import('pixi-live2d-display/cubism4');

        // PixiJS's ShaderSystem code-generates its uniform-sync functions via
        // `new Function(...)` for speed, and throws in its constructor if
        // that's blocked — which our CSP does in production (brief §15: no
        // `unsafe-eval`). `@pixi/unsafe-eval` is PixiJS's own patch for
        // exactly this: it swaps that codegen for a slower but CSP-safe
        // fallback path. Must run before the `Application`/`Renderer` is
        // constructed, since that's what wires up `ShaderSystem`.
        const { install: installUnsafeEvalPatch } = await import('@pixi/unsafe-eval');
        installUnsafeEvalPatch({ ShaderSystem: PIXI.ShaderSystem });

        // pixi-live2d-display uses PIXI's global ticker to auto-update.
        Live2DModel.registerTicker(PIXI.Ticker);

        if (disposed) return;

        app = new PIXI.Application({
          view: canvas,
          autoStart: true,
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
          resizeTo: canvas.parentElement ?? undefined,
        }) as unknown as PixiAppLike;

        const model = (await Live2DModel.from(MODEL_URL, {
          autoInteract: false,
          autoUpdate: true,
        })) as unknown as Live2DModelLike;

        if (disposed) {
          model.destroy?.();
          return;
        }

        app.stage.addChild(model as never);
        modelRef.current = model;
        fit(model, app);

        const onResize = () => fit(model, app as PixiAppLike);
        window.addEventListener('resize', onResize);

        // Track the cursor only while it's over the stage — head movement
        // that follows the cursor across the whole page feels twitchy.
        const parent = canvas.parentElement;
        const onPointerMove = (e: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          model.focus?.(e.clientX - rect.left, e.clientY - rect.top);
        };
        // Resting gaze is straight ahead at the viewer. `focusController`
        // takes a normalized direction in [-1, 1] (0,0 = forward) and eases
        // toward it, so she settles back rather than snapping. Don't use
        // `model.focus()` for this: it takes a *point* and aims at it, so an
        // off-canvas point (the old `-1000,-1000`) leaves her staring up
        // into the top-left corner.
        const lookForward = () => model.internalModel?.focusController?.focus(0, 0);
        lookForward();
        const onPointerLeave = lookForward;
        parent?.addEventListener('pointermove', onPointerMove);
        parent?.addEventListener('pointerleave', onPointerLeave);

        // Drawable opacities (which `fit` uses to skip hidden poses) only
        // reflect the model's real state after it has updated at least once,
        // so fit again a couple of frames in — and hold the skeleton up
        // until then, so the refit never shows as a jump.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (disposed) return;
            fit(model, app as PixiAppLike);
            setReady(true);
            onStatus?.('ready');
          }),
        );

        cleanupRef.current = () => {
          window.removeEventListener('resize', onResize);
          parent?.removeEventListener('pointermove', onPointerMove);
          parent?.removeEventListener('pointerleave', onPointerLeave);
        };
      } catch (err) {
        if (disposed) return;
        console.error('[live2d] failed to load model', err);
        onStatus?.('failed');
      }
    };

    const cleanupRef = { current: null as null | (() => void) };
    void boot();

    return () => {
      disposed = true;
      cleanupRef.current?.();
      // Whatever is playing *now*, not at mount — so `speak()`'s promise
      // resolves instead of hanging once the model is torn down.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      playbackRef.current?.stop();
      modelRef.current?.destroy?.();
      modelRef.current = null;
      app?.destroy?.(false, { children: true });
      void audioCtxRef.current?.close();
      audioCtxRef.current = null;
    };
    // Deliberately runs once: the model only reloads via a component remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

/* ------------------------------------------------------------------ */

type PixiAppLike = {
  stage: { addChild: (child: never) => void };
  screen: { width: number; height: number };
  destroy?: (removeView: boolean, options: { children: boolean }) => void;
};

type Live2DModelLike = {
  width: number;
  height: number;
  scale: { set: (value: number) => void };
  anchor?: { set: (x: number, y: number) => void };
  position: { set: (x: number, y: number) => void };
  expression?: (name: string) => void;
  focus?: (x: number, y: number) => void;
  destroy?: () => void;
  internalModel?: {
    on?: (event: string, fn: () => void) => void;
    off?: (event: string, fn: () => void) => void;
    focusController?: { focus: (x: number, y: number, instant?: boolean) => void };
    localTransform?: { a: number; d: number; tx: number; ty: number };
    getDrawableBounds?: (
      index: number,
    ) => { x: number; y: number; width: number; height: number };
    coreModel?: {
      setParameterValueById?: (id: string, value: number) => void;
      getDrawableCount?: () => number;
      getDrawableOpacity?: (index: number) => number;
    };
    motionManager?: {
      expressionManager?: {
        stopAllExpressions?: () => void;
      };
    };
  };
};

type Box = { left: number; top: number; right: number; bottom: number };

/**
 * The box the figure's *visible artwork* occupies, in the model's local
 * (unscaled) coordinates.
 *
 * `model.width`/`height` can't be used for this: they come from the
 * model's Live2D canvas, which the author sized for framing, not to the art —
 * on this Zundamon build it ends above her knees, so fitting to it cropped
 * her legs off. Instead this unions the bounds of every drawable mesh that
 * is actually showing (opacity > 0 skips alternate hand/arm poses parked
 * invisible), then maps them through `localTransform` into the same space
 * the model's position and pivot work in.
 */
function artBounds(model: Live2DModelLike): Box | null {
  const im = model.internalModel;
  const core = im?.coreModel;
  const t = im?.localTransform;
  const count = core?.getDrawableCount?.() ?? 0;
  if (!im?.getDrawableBounds || !t || !count) return null;

  const box: Box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < count; i++) {
    if ((core?.getDrawableOpacity?.(i) ?? 1) <= 0) continue;
    const b = im.getDrawableBounds(i);
    if (!b.width || !b.height) continue;
    box.left = Math.min(box.left, b.x);
    box.top = Math.min(box.top, b.y);
    box.right = Math.max(box.right, b.x + b.width);
    box.bottom = Math.max(box.bottom, b.y + b.height);
  }
  if (!Number.isFinite(box.left)) return null;

  return {
    left: box.left * t.a + t.tx,
    right: box.right * t.a + t.tx,
    top: box.top * t.d + t.ty,
    bottom: box.bottom * t.d + t.ty,
  };
}

/**
 * The Zundamon model is shown full-body — head to shoes, the whole figure
 * inside the canvas — standing on the stage backdrop rather than cropped.
 *
 * Framed on the measured artwork (`artBounds`), contained like
 * `object-fit: contain` would if we could use it on a WebGL canvas: height
 * binds on the wide desktop stage, width binds on narrow screens where
 * the stage is taller than it is wide. Local bounds don't change
 * with the model's scale, so repeated fits on resize don't compound.
 */
function fit(model: Live2DModelLike, app: PixiAppLike): void {
  const { width, height } = app.screen;
  const box =
    artBounds(model) ??
    (model.width && model.height
      ? { left: 0, top: 0, right: model.width, bottom: model.height }
      : null);
  if (!box) return;

  const artW = box.right - box.left;
  const artH = box.bottom - box.top;
  /* 5% headroom above her, 3% under her feet — she stands near the floor of
     the frame rather than floating in the middle of it. */
  const scale = Math.min((height * 0.92) / artH, (width * 0.9) / artW);

  model.scale.set(scale);
  model.anchor?.set(0, 0);
  model.position.set(
    width / 2 - ((box.left + box.right) / 2) * scale,
    height * 0.97 - box.bottom * scale,
  );
}

function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(
      probe.getContext('webgl2') ??
      probe.getContext('webgl') ??
      probe.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

let corePromise: Promise<void> | null = null;

function loadCubismCore(): Promise<void> {
  if (typeof window !== 'undefined' && 'Live2DCubismCore' in window) return Promise.resolve();
  if (corePromise) return corePromise;

  corePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CUBISM_CORE_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cubism Core failed to load'));
    document.head.appendChild(script);
  });
  return corePromise;
}

type Playback = { stop: () => void };

/**
 * Tuned against real VOICEVOX output, which is quiet: voiced 512-sample
 * windows measured RMS 0.036 median, 0.068 at the 80th percentile, 0.19 at
 * peak. Below the gate counts as silence (mouth fully shut); the gain puts
 * a typical syllable around a third open, stressed ones near fully open.
 */
const MOUTH_GATE = 0.01;
const MOUTH_GAIN = 14;

function audioContext(ref: { current: AudioContext | null }): AudioContext {
  ref.current ??= new AudioContext();
  return ref.current;
}

/**
 * Lip-sync is driven by TTS audio amplitude (brief §5). If TTS is off, this
 * is never called and the mouth stays with whatever the idle motion does —
 * no fake mouth animation running without sound.
 *
 * The mouth is written from the model's own `beforeModelUpdate` hook, not a
 * separate `requestAnimationFrame` loop: every Zundamon motion animates
 * `ParamMouthOpenY` itself, and pixi-live2d-display re-applies motions and
 * then restores the post-motion parameters each frame, so a value written
 * from outside its update loop loses to the motion. That hook runs after
 * motions, expressions and physics, right before the mesh is computed.
 */
async function playWithLipSync(
  audio: AudioBuffer | ArrayBuffer,
  ctxRef: { current: AudioContext | null },
  modelRef: { current: Live2DModelLike | null },
  playbackRef: { current: Playback | null },
): Promise<void> {
  const internal = modelRef.current?.internalModel;
  if (!internal?.on || !internal.off) return;

  const ctx = audioContext(ctxRef);
  if (ctx.state === 'suspended') await ctx.resume();
  const buffer =
    audio instanceof AudioBuffer ? audio : await ctx.decodeAudioData(audio.slice(0) as ArrayBuffer);

  // One voice at a time.
  playbackRef.current?.stop();

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const samples = new Uint8Array(analyser.fftSize);
  let level = 0;
  const onUpdate = () => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / samples.length);
    const target = Math.min(1, Math.max(0, rms - MOUTH_GATE) * MOUTH_GAIN);
    // Opens quickly, closes a little slower: raw per-frame RMS reads as chattering.
    level += (target - level) * (target > level ? 0.6 : 0.3);
    internal.coreModel?.setParameterValueById?.('ParamMouthOpenY', level);
  };

  return new Promise<void>((resolve) => {
    let finished = false;
    const playback: Playback = {
      stop: () => {
        try {
          source.stop();
        } catch {
          /* Already stopped. */
        }
        finish();
      },
    };
    function finish() {
      if (finished) return;
      finished = true;
      // No need to close the mouth: once the hook is gone, the next frame
      // falls back to whatever the motion sets.
      internal?.off?.('beforeModelUpdate', onUpdate);
      if (playbackRef.current === playback) playbackRef.current = null;
      resolve();
    }

    playbackRef.current = playback;
    source.onended = finish;
    internal.on?.('beforeModelUpdate', onUpdate);
    source.start();
  });
}
