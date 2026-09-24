'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CHAT_MOODS, type ChatHistoryMessage, type ChatMood, type ChatPageContext } from '@robinchan/shared';

import { useExpressionBus } from '@/components/live2d/ExpressionBus';
import { API_BASE } from '@/lib/api';

function isChatMood(value: string | undefined): value is ChatMood {
  return CHAT_MOODS.includes(value as ChatMood);
}

export type ChatUiMessage = ChatHistoryMessage & { pending?: boolean };

export type ChatState = {
  /** Persisted turns plus, while one is in flight, a pending assistant bubble. */
  messages: ChatUiMessage[];
  loadingHistory: boolean;
  sending: boolean;
  error: string | null;
  send: (text: string) => void;
};

function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Real chat over `POST /api/chat` (brief §5): loads server-side history
 * once, then streams each reply in over SSE — parsed by hand rather than
 * `EventSource`, since `EventSource` can't send a POST body.
 */
export function useChat(pageContext: ChatPageContext, signedIn: boolean): ChatState {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const expressionBus = useExpressionBus();

  // Load history once, right after signing in.
  useEffect(() => {
    if (!signedIn) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    fetch(`${API_BASE}/api/chat/history?limit=50`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: ChatHistoryMessage[] } | null) => {
        if (cancelled || !body?.data) return;
        setMessages(body.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setError(null);
      setSending(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatUiMessage = {
        id: localId(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      const pendingId = localId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: pendingId, role: 'assistant', content: '', createdAt: new Date().toISOString(), pending: true },
      ]);

      void streamReply({
        text: trimmed,
        pageContext,
        signal: controller.signal,
        onToken: (delta) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === pendingId ? { ...m, content: m.content + delta } : m)),
          );
        },
        onMood: (mood) => expressionBus.requestExpression(mood),
        onDone: () => {
          setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, pending: false } : m)));
          setSending(false);
        },
        onError: (message) => {
          setMessages((prev) => prev.filter((m) => m.id !== pendingId));
          setError(message);
          setSending(false);
        },
      });
    },
    [pageContext, sending, expressionBus],
  );

  return { messages, loadingHistory, sending, error, send };
}

async function streamReply(opts: {
  text: string;
  pageContext: ChatPageContext;
  signal: AbortSignal;
  onToken: (delta: string) => void;
  onMood: (mood: ChatMood) => void;
  onDone: () => void;
  onError: (message: string) => void;
}): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      credentials: 'include',
      signal: opts.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: opts.text, pageContext: opts.pageContext }),
    });

    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      opts.onError(body?.error?.message ?? "Couldn't reach the chat right now.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // The server always ends with a `done` or `error` frame before closing
    // the connection — this guards the (unexpected) case of the connection
    // just dropping without either, so the UI doesn't hang on "sending".
    let settled = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const eventLine = frame.split('\n').find((l) => l.startsWith('event:'));
        const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.slice(6).trim();
        let data: { text?: string; message?: string; mood?: string };
        try {
          data = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }

        if (event === 'token' && data.text) opts.onToken(data.text);
        else if (event === 'mood' && isChatMood(data.mood)) opts.onMood(data.mood);
        else if (event === 'error') {
          settled = true;
          opts.onError(data.message ?? 'Something went wrong.');
        } else if (event === 'done') {
          settled = true;
          opts.onDone();
        }
      }
    }
    if (!settled) opts.onDone();
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') return;
    opts.onError("Couldn't reach the chat right now.");
  }
}
