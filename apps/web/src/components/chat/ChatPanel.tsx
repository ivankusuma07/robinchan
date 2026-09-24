'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatPageContext } from '@robinchan/shared';

import { Avatar } from '@/components/Avatar';
import { ArrowRightIcon } from '@/components/icons';
import { CardHead, cx } from '@/components/ui';
import { useWallet } from '@/components/providers/WalletProvider';
import { useChat } from '@/lib/useChat';

/**
 * Chat on the `/robinchan` page (brief §5) — real chat, not the static demo
 * on Home. Messages stream in over SSE from `POST /api/chat`; history is
 * kept on the server (`GET /api/chat/history`), never in `localStorage`, so
 * it's the same conversation from any device. Wallet sign-in gates it
 * (`useWallet()`, brief §14) — connected-but-not-signed-in still reads as
 * locked, the same distinction every other gate in the app makes.
 *
 * On the stage layout the transcript and the composer live in different
 * places — the transcript is a card floating at the stage's left, the
 * composer a bar docked bottom-centre under the character — so this renders
 * the two as siblings and the page positions each through its own
 * className. They stay one component so the chat state has one owner.
 */

const INTRO_TEXT =
  "Hi. I can read out price moves, filings, and news — and help build an order if you want one. Signing is still done from your own wallet.";

const DEFAULT_CONTEXT: ChatPageContext = { page: 'robinchan' };

export function ChatPanel({
  logClassName,
  composerClassName,
  pageContext = DEFAULT_CONTEXT,
}: {
  logClassName?: string;
  composerClassName?: string;
  pageContext?: ChatPageContext;
}) {
  const wallet = useWallet();
  const signedIn = wallet.status === 'signed-in';
  const chat = useChat(pageContext, signedIn);
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages]);

  const composerState: 'locked' | 'connecting' | 'ready' =
    !signedIn ? 'locked' : chat.sending ? 'connecting' : 'ready';

  const placeholder =
    composerState === 'locked'
      ? 'Connect a wallet to chat with Robinchan'
      : composerState === 'connecting'
        ? 'Robinchan is replying…'
        : 'Ask about a price, a filing, or build an order';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (composerState !== 'ready' || !draft.trim()) return;
    chat.send(draft);
    setDraft('');
  };

  return (
    <>
      <section className={cx('card-glass flex min-h-0 flex-col', logClassName)}>
        <CardHead
          title="Conversation"
          aside={
            chat.loadingHistory ? (
              <span className="font-mono text-[11px] text-text-3">loading…</span>
            ) : null
          }
        />

        <div
          ref={logRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          role="log"
          aria-label="Message history"
        >
          <Bubble fromHer text={INTRO_TEXT} />

          {chat.messages.map((message) => (
            <Bubble
              key={message.id}
              fromHer={message.role === 'assistant'}
              text={message.content}
              pending={message.pending}
            />
          ))}

          {chat.error ? (
            <p className="pl-[47px] text-[12px] text-down" role="alert">
              {chat.error}
            </p>
          ) : null}
        </div>
      </section>

      <form
        className={cx(
          'card-glass flex items-center gap-2 rounded-full p-1.5 pl-5',
          composerClassName,
        )}
        onSubmit={submit}
        aria-label="Send a message"
      >
        <label htmlFor="chat-input" className="sr-only">
          Write a message to Robinchan
        </label>
        <input
          id="chat-input"
          type="text"
          value={draft}
          disabled={composerState !== 'ready'}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 bg-transparent text-[14px] text-text placeholder:text-text-3 focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={composerState !== 'ready' || !draft.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-shadow disabled:opacity-45 enabled:hover:shadow-glow-pink"
          aria-label="Send"
        >
          <ArrowRightIcon />
        </button>
      </form>
    </>
  );
}

function Bubble({ fromHer, text, pending }: { fromHer: boolean; text: string; pending?: boolean }) {
  if (!fromHer) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[86%] rounded-[16px] rounded-br-[6px] border border-border bg-surface-2 px-3.5 py-2.5 text-[14px] leading-relaxed">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar />
      <p className="max-w-[86%] rounded-[16px] rounded-bl-[6px] border border-accent-2/40 bg-accent/20 px-3.5 py-2.5 text-[13.5px] leading-relaxed">
        {text}
        {/* Streaming-token cursor: a soft accent blink, not a plain caret. */}
        {pending ? (
          <span
            className="ml-0.5 inline-block h-[13px] w-[2px] translate-y-[2px] animate-caret-blink rounded-full bg-accent-2"
            aria-hidden
          />
        ) : null}
      </p>
    </div>
  );
}
