'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiEnvelope, MediaChannel } from '@robinchan/shared';

import { ExternalIcon } from '@/components/icons';
import { CardHead, cx } from '@/components/ui';
import { safeUrl, sanitizeText } from '@/lib/sanitize';
import { usePoll } from '@/lib/usePoll';

/**
 * Live video broadcast (brief §6).
 *
 * Embedded via `embed/live_stream?channel=<channelId>` — YouTube's own
 * parameter for "whatever is live on this channel right now", resolved on
 * YouTube's end. No API key, no `videoId` lookup, and (unlike the previous
 * version) no waiting on the worker to resolve one: the channel id is known
 * the moment the channel list loads, so the embed can always be attempted
 * immediately. Whether anything is actually live is something only YouTube's
 * player itself can tell at this point — there's no cheap, quota-free way to
 * know in advance, so the "LIVE" badge this card used to show is gone; the
 * embed's own state (or the fallback below, on a genuine load failure) is
 * what's now honest to show.
 *
 * - 16:9 slot inside a card, 352px tall
 * - The iframe only mounts once the card enters the viewport, plus `loading="lazy"`
 * - Starts muted; autoplay with sound would be blocked by the browser anyway
 * - Channel tabs swap the embedded channel without a page reload
 */
export function LiveVideo({ initial }: { initial: ApiEnvelope<MediaChannel[]> }) {
  const envelope = usePoll<MediaChannel[]>('/api/media/channels', initial, 10 * 60_000);
  const channels = envelope.data;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  const active = channels.find((c) => c.id === activeId) ?? channels[0] ?? null;

  useEffect(() => {
    setFailed(false);
  }, [active?.channelId]);

  return (
    <section ref={cardRef} className="card overflow-hidden">
      <CardHead
        title="Live broadcast"
        aside={
          active ? (
            <span className="font-mono text-[11px] text-text-3">via YouTube</span>
          ) : null
        }
      />

      {/*
        The box itself is 16:9 (`aspect-video` on the box, not a fixed
        height) so the iframe can just fill it edge to edge — a fixed
        352px height forced a width from `aspect-video` on the *iframe*
        that didn't match the card's actual (responsive) width, and
        `max-w-full` then only capped the width without giving the height
        back, which is what was letterboxing the real video inside it.
      */}
      <div className="relative aspect-video w-full bg-black">
        {!active ? (
          <EmptyState visible={channels.length > 0} />
        ) : failed ? (
          <Poster channel={active} />
        ) : visible ? (
          <iframe
            key={active.channelId}
            // youtube-nocookie + mute=1: autoplay with sound would be blocked anyway.
            src={`https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(active.channelId)}&autoplay=1&mute=1&playsinline=1&rel=0`}
            title={`Live broadcast: ${sanitizeText(active.label, 40)}`}
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : null}
      </div>

      <div
        className="flex flex-wrap gap-2 border-t border-border-soft p-3"
        role="tablist"
        aria-label="Choose a channel"
      >
        {channels.length === 0 ? (
          <span className="px-2 py-1 font-mono text-[11px] text-text-3">
            channel list hasn&apos;t loaded yet
          </span>
        ) : (
          channels.map((channel) => {
            const isActive = channel.id === active?.id;
            return (
              <button
                key={channel.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(channel.id)}
                className={cx(
                  'inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors',
                  isActive
                    ? 'border-accent-2/70 bg-accent/35 text-text'
                    : 'border-border text-text-2 hover:border-text-3 hover:text-text',
                )}
              >
                {sanitizeText(channel.label, 24)}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

/** The card scrolled into view state, before the channel list has loaded — a quiet placeholder, not an error. */
function EmptyState({ visible }: { visible: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
      {visible ? (
        <span className="font-mono text-[11px] text-text-3">loading channels…</span>
      ) : null}
    </div>
  );
}

function Poster({ channel }: { channel: MediaChannel | null }) {
  const href = channel ? safeUrl(channel.url) : null;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-3">
        embed couldn&apos;t load
      </p>
      <p className="max-w-[360px] text-[13px] leading-relaxed text-text-3">
        The channel can still be opened directly.
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-10 text-[13px]"
        >
          Open on YouTube
          <ExternalIcon />
        </a>
      ) : null}
    </div>
  );
}
