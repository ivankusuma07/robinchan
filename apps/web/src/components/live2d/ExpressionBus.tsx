'use client';

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { Live2DHandle } from './Live2DCanvas';
import type { Mood } from './expressions';

/**
 * Lets a chat reply drive the Live2D stage — its expression (brief §5's
 * "LLM-driven expression changes") and its voice — without `ChatPanel` and
 * `Live2DStage` needing a direct reference to each other: they're laid out
 * as siblings on the page, not parent/child. `Live2DStage` registers the
 * model handle it already owns and subscribes to both channels; anything
 * under the provider can request a mood or ask for a reply to be spoken.
 *
 * Speech is a request, not a command: the stage decides whether to act on
 * it (voice switched on, model loaded), so chat never needs to know.
 */
type ExpressionBus = {
  registerHandle: (handle: Live2DHandle | null) => void;
  requestExpression: (mood: Mood) => void;
  subscribe: (fn: (mood: Mood) => void) => () => void;
  requestSpeech: (text: string) => void;
  subscribeSpeech: (fn: (text: string) => void) => () => void;
};

const noopBus: ExpressionBus = {
  registerHandle: () => undefined,
  requestExpression: () => undefined,
  subscribe: () => () => undefined,
  requestSpeech: () => undefined,
  subscribeSpeech: () => () => undefined,
};

const ExpressionBusContext = createContext<ExpressionBus | null>(null);

export function ExpressionBusProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<Live2DHandle | null>(null);
  const moodListeners = useRef(new Set<(mood: Mood) => void>());
  const speechListeners = useRef(new Set<(text: string) => void>());

  const registerHandle = useCallback((handle: Live2DHandle | null) => {
    handleRef.current = handle;
  }, []);

  const requestExpression = useCallback((mood: Mood) => {
    handleRef.current?.setExpression(mood);
    moodListeners.current.forEach((fn) => fn(mood));
  }, []);

  const subscribe = useCallback((fn: (mood: Mood) => void) => {
    moodListeners.current.add(fn);
    return () => {
      moodListeners.current.delete(fn);
    };
  }, []);

  const requestSpeech = useCallback((text: string) => {
    speechListeners.current.forEach((fn) => fn(text));
  }, []);

  const subscribeSpeech = useCallback((fn: (text: string) => void) => {
    speechListeners.current.add(fn);
    return () => {
      speechListeners.current.delete(fn);
    };
  }, []);

  const bus = useMemo<ExpressionBus>(
    () => ({ registerHandle, requestExpression, subscribe, requestSpeech, subscribeSpeech }),
    [registerHandle, requestExpression, subscribe, requestSpeech, subscribeSpeech],
  );

  return <ExpressionBusContext.Provider value={bus}>{children}</ExpressionBusContext.Provider>;
}

/**
 * Safe to call with no provider mounted — a no-op bus, not a thrown error.
 * `useChat()` calls this from wherever the chat panel ends up rendered, and
 * a missing stage to control shouldn't break chat itself.
 */
export function useExpressionBus(): ExpressionBus {
  return useContext(ExpressionBusContext) ?? noopBus;
}
