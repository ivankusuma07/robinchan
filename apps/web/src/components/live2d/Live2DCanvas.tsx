'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { CUBISM_CORE_URL, MODEL_URL, MOOD_TO_EXPRESSION, type Mood } from './expressions';

export type Live2DHandle = {
  setExpression: (mood: Mood) => void;
  speak: (audio: AudioBuffer | ArrayBuffer) => Promise<void>;
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
        await playWithLipSync(audio, audioCtxRef, modelRef);
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
        const onPointerLeave = () => model.focus?.(-1000, -1000);
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
 * binds on the wide desktop stage, width binds once `grid-stage` collapses
 * to one column below 1280px and the card narrows. Local bounds don't change
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

/**
 * Lip-sync is driven by TTS audio amplitude (brief §5). If TTS is off, this
 * method is never called and the mouth stays idle — no fake mouth animation
 * running without sound.
 */
async function playWithLipSync(
  audio: AudioBuffer | ArrayBuffer,
  ctxRef: { current: AudioContext | null },
  modelRef: { current: Live2DModelLike | null },
): Promise<void> {
  const model = modelRef.current;
  if (!model) return;

  ctxRef.current ??= new AudioContext();
  const ctx = ctxRef.current;
  if (ctx.state === 'suspended') await ctx.resume();

  const buffer =
    audio instanceof AudioBuffer ? audio : await ctx.decodeAudioData(audio.slice(0) as ArrayBuffer);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const samples = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;

  const pump = () => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / samples.length);
    model.internalModel?.coreModel?.setParameterValueById?.(
      'ParamMouthOpenY',
      Math.min(1, rms * 3.2),
    );
    frame = requestAnimationFrame(pump);
  };

  return new Promise<void>((resolve) => {
    source.onended = () => {
      cancelAnimationFrame(frame);
      model.internalModel?.coreModel?.setParameterValueById?.('ParamMouthOpenY', 0);
      resolve();
    };
    source.start();
    pump();
  });
}
