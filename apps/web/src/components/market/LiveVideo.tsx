'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiEnvelope, MediaChannel } from '@robinchan/shared';

import { ExternalIcon } from '@/components/icons';
import { CardHead, PulseDot, cx } from '@/components/ui';
import { safeUrl, sanitizeText } from '@/lib/sanitize';
import { usePoll } from '@/lib/usePoll';

/**
 * Siaran video live (brief §6).
 *
 * - Slot 16:9 di dalam kartu setinggi 352px
 * - Iframe baru di-mount saat kartu masuk viewport, dan `loading="lazy"`
 * - Mulai dalam keadaan mute; autoplay bersuara akan diblokir browser
 * - Tab channel mengganti `videoId` tanpa reload halaman
 * - Kalau `videoId` belum ada atau iframe gagal, tampilkan poster + tombol ke
 *   YouTube — `videoId` datang dari API, tidak pernah di-hardcode di sini
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
  }, [active?.videoId]);

  return (
    <section ref={cardRef} className="card overflow-hidden">
      <CardHead
        title="Siaran langsung"
        aside={
          active?.live ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent">
              <PulseDot />
              LIVE
            </span>
          ) : (
            <span className="font-mono text-[11px] text-text-3">tidak ada stream aktif</span>
          )
        }
      />

      <div className="flex h-[352px] items-center justify-center bg-black">
        {active && active.videoId && visible && !failed ? (
          <iframe
            key={active.videoId}
            // youtube-nocookie + mute=1: autoplay bersuara pasti diblokir.
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(active.videoId)}?autoplay=1&mute=1&playsinline=1&rel=0`}
            title={`Siaran langsung ${sanitizeText(active.label, 40)}`}
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onError={() => setFailed(true)}
            className="aspect-video h-full w-auto max-w-full border-0"
          />
        ) : (
          <Poster channel={active} />
        )}
      </div>

      <div
        className="flex flex-wrap gap-2 border-t border-border-soft p-3"
        role="tablist"
        aria-label="Pilih channel"
      >
        {channels.length === 0 ? (
          <span className="px-2 py-1 font-mono text-[11px] text-text-3">
            daftar channel belum terisi
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
                    ? 'border-accent/45 bg-accent/[0.07] text-text'
                    : 'border-border text-text-2 hover:border-text-3 hover:text-text',
                )}
              >
                {channel.live ? <PulseDot /> : null}
                {sanitizeText(channel.label, 24)}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function Poster({ channel }: { channel: MediaChannel | null }) {
  const href = channel ? safeUrl(channel.url) : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-3">
        stream tidak bisa dimuat
      </p>
      <p className="max-w-[360px] text-[13px] leading-relaxed text-text-3">
        Id siaran aktif belum bisa dipastikan dari penyedia. Channel-nya tetap bisa dibuka langsung.
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost h-10 text-[13px]"
        >
          Buka di YouTube
          <ExternalIcon />
        </a>
      ) : null}
    </div>
  );
}
