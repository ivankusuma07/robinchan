'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { splitForSpeech } from '@robinchan/shared';

import { API_BASE } from '@/lib/api';

import { useExpressionBus } from './ExpressionBus';
import type { Live2DHandle } from './Live2DCanvas';

const VOICE_STORAGE_KEY = 'robinchan.voice';

export type StageVoice = {
  on: boolean;
  /** The last clip request failed — she stays silent and the mouth idle (brief §5), and says so. */
  unavailable: boolean;
  toggle: () => void;
};

/** `null` on any failure: a voice that can't be fetched is simply not played. */
async function fetchClip(text: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/**
 * The stage's voice (brief §5, VOICEVOX): speaks each finished chat reply
 * when switched on. A reply is split into sentence-sized chunks and the
 * next chunk is synthesized while the current one plays, so she starts
 * talking after one short synthesis rather than one long one. A new reply,
 * or switching voice off, cuts off whatever is still playing.
 *
 * Off by default — sound shouldn't start on its own (the same reason the
 * market broadcast starts muted) — and remembered per viewer once turned on.
 */
export function useStageVoice(
  handle: RefObject<Live2DHandle | null>,
  { enabled, ready }: { enabled: boolean; ready: boolean },
): StageVoice {
  const bus = useExpressionBus();
  const [on, setOn] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const live = useRef({ on: false, ready: false });
  const run = useRef<AbortController | null>(null);

  useEffect(() => {
    live.current = { on, ready };
  }, [on, ready]);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (window.localStorage.getItem(VOICE_STORAGE_KEY) === 'on') setOn(true);
    } catch {
      /* Storage unavailable — stay off. */
    }
  }, [enabled]);

  const stop = useCallback(() => {
    run.current?.abort();
    run.current = null;
    handle.current?.stopSpeaking();
  }, [handle]);

  const speak = useCallback(
    async (text: string) => {
      stop();
      const [first, ...rest] = splitForSpeech(text);
      if (!first) return;
      const controller = new AbortController();
      run.current = controller;

      let pending = fetchClip(first, controller.signal);
      for (const upcoming of [...rest, null]) {
        const clip = await pending;
        if (controller.signal.aborted) return;
        if (!clip) {
          setUnavailable(true);
          return;
        }
        setUnavailable(false);
        pending = upcoming ? fetchClip(upcoming, controller.signal) : Promise.resolve(null);
        await handle.current?.speak(clip);
        if (controller.signal.aborted) return;
      }
    },
    [handle, stop],
  );

  useEffect(
    () =>
      bus.subscribeSpeech((text) => {
        if (live.current.on && live.current.ready) void speak(text);
      }),
    [bus, speak],
  );

  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => {
    const next = !on;
    // Inside the click itself, so browsers that only allow audio from a
    // user gesture (iOS Safari) let the later, fetched clips play.
    if (next) handle.current?.unlockAudio();
    else {
      stop();
      setUnavailable(false);
    }
    setOn(next);
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      /* Not persisted; the choice still applies for this visit. */
    }
  }, [on, handle, stop]);

  return { on: enabled && on, unavailable, toggle };
}
