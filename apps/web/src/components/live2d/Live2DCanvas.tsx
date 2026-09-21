'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

import { CUBISM_CORE_URL, MODEL_URL, MOOD_TO_EXPRESSION, type Mood } from './expressions';

export type Live2DHandle = {
  setExpression: (mood: Mood) => void;
  speak: (audio: AudioBuffer | ArrayBuffer) => Promise<void>;
};

export type StageStatus = 'loading' | 'ready' | 'unsupported' | 'failed';

/**
 * Pembungkus canvas Live2D (brief §7).
 *
 * Kontraknya dua method: `setExpression()` dan `speak(audioBuffer)`. Semua
 * impor berat (`pixi.js`, `pixi-live2d-display`) terjadi di dalam efek, jadi
 * bundle halaman lain tidak ikut kebawa — komponen ini sendiri juga dimuat
 * lewat `next/dynamic` dengan `ssr: false` dari `Live2DStage`.
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
        modelRef.current?.expression?.(MOOD_TO_EXPRESSION[mood]);
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

      // Fallback WebGL: kalau konteksnya tidak ada, jangan coba muat SDK sama
      // sekali — halaman menampilkan gambar statis dan menyembunyikan tombol
      // bicara (brief §5).
      if (!hasWebGL()) {
        onStatus?.('unsupported');
        return;
      }

      try {
        await loadCubismCore();
        const PIXI = await import('pixi.js');
        const { Live2DModel } = await import('pixi-live2d-display/cubism4');

        // pixi-live2d-display memakai ticker global PIXI untuk update otomatis.
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

        // Arahkan pandangan ke kursor hanya saat kursor ada di atas stage —
        // gerak kepala yang mengikuti kursor ke seluruh halaman terasa gelisah.
        const parent = canvas.parentElement;
        const onPointerMove = (e: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          model.focus?.(e.clientX - rect.left, e.clientY - rect.top);
        };
        const onPointerLeave = () => model.focus?.(-1000, -1000);
        parent?.addEventListener('pointermove', onPointerMove);
        parent?.addEventListener('pointerleave', onPointerLeave);

        setReady(true);
        onStatus?.('ready');

        cleanupRef.current = () => {
          window.removeEventListener('resize', onResize);
          parent?.removeEventListener('pointermove', onPointerMove);
          parent?.removeEventListener('pointerleave', onPointerLeave);
        };
      } catch (err) {
        if (disposed) return;
        console.error('[live2d] gagal memuat model', err);
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
    // Sengaja sekali jalan: model dimuat ulang hanya lewat remount komponen.
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
    coreModel?: {
      setParameterValueById?: (id: string, value: number) => void;
    };
  };
};

/**
 * Model Zundamon digambar seluruh badan. Canvas stage cuma 400px, jadi
 * skalanya dipatok ke tinggi dan titik jangkarnya digeser ke atas supaya
 * wajahnya yang terlihat, bukan sepatunya.
 */
function fit(model: Live2DModelLike, app: PixiAppLike): void {
  const { width, height } = app.screen;
  if (!model.width || !model.height) return;
  const scale = (height / model.height) * 1.55;
  model.scale.set(scale);
  model.anchor?.set(0.5, 0.5);
  model.position.set(width / 2, height * 0.62);
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
    script.onerror = () => reject(new Error('Cubism Core gagal dimuat'));
    document.head.appendChild(script);
  });
  return corePromise;
}

/**
 * Lip-sync digerakkan amplitudo audio TTS (brief §5). Kalau TTS mati, method
 * ini tidak pernah dipanggil dan mulut tetap idle — tidak ada animasi mulut
 * palsu yang jalan tanpa suara.
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
