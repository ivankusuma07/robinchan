'use client';

import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

import type { Live2DHandle } from './Live2DCanvas';
import type { Mood } from './expressions';

/**
 * Lets a chat reply drive the Live2D stage's expression (brief §5's
 * "LLM-driven expression changes") without `ChatPanel` and `Live2DStage`
 * needing a direct reference to each other — they're laid out as siblings
 * on the page, not parent/child. `Live2DStage` registers the model handle
 * it already owns; anything under the provider can request a mood, and
 * `Live2DStage` also subscribes so its own mood buttons stay in sync with
 * an expression chat just triggered.
 */
type ExpressionBus = {
  registerHandle: (handle: Live2DHandle | null) => void;
  requestExpression: (mood: Mood) => void;
  subscribe: (fn: (mood: Mood) => void) => () => void;
};

const noopBus: ExpressionBus = {
  registerHandle: () => undefined,
  requestExpression: () => undefined,
  subscribe: () => () => undefined,
};

const ExpressionBusContext = createContext<ExpressionBus | null>(null);

export function ExpressionBusProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<Live2DHandle | null>(null);
  const listeners = useRef(new Set<(mood: Mood) => void>());

  const registerHandle = useCallback((handle: Live2DHandle | null) => {
    handleRef.current = handle;
  }, []);

  const requestExpression = useCallback((mood: Mood) => {
    handleRef.current?.setExpression(mood);
    listeners.current.forEach((fn) => fn(mood));
  }, []);

  const subscribe = useCallback((fn: (mood: Mood) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const bus: ExpressionBus = { registerHandle, requestExpression, subscribe };

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
