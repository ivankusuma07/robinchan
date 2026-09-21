'use client';

import type { ApiEnvelope, CalendarEvent, MediaClip, SourceStatus } from '@robinchan/shared';
import { POLL_MS } from '@robinchan/shared';

import { ClipCard } from '@/components/NewsCard';
import { CardHead, StatusDot, cx } from '@/components/ui';
import { sanitizeText } from '@/lib/sanitize';
import { useNow, usePoll } from '@/lib/usePoll';

/** Kartu klip "Sorotan" — refresh 5 menit (brief §6). */
export function Highlights({ initial }: { initial: ApiEnvelope<MediaClip[]> }) {
  const envelope = usePoll<MediaClip[]>('/api/media/clips', initial, POLL_MS.clips);
  const now = useNow(60_000);

  return (
    <section className="card">
      <CardHead title="Sorotan" />
      <div className="space-y-2.5 p-4">
        {envelope.data.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-3">Belum ada klip.</p>
        ) : (
          envelope.data.slice(0, 4).map((clip) => <ClipCard key={clip.id} clip={clip} now={now} />)
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const KIND_LABEL: Record<CalendarEvent['kind'], string> = {
  earnings: 'EARN',
  macro: 'MAKRO',
  chain: 'CHAIN',
};

/** Katalis berikutnya — refresh 1 jam (brief §6). */
export function Catalysts({ initial }: { initial: ApiEnvelope<CalendarEvent[]> }) {
  const envelope = usePoll<CalendarEvent[]>('/api/calendar?limit=5', initial, POLL_MS.calendar);

  return (
    <section className="card">
      <CardHead title="Katalis berikutnya" />
      <ul className="divide-y divide-border-soft">
        {envelope.data.length === 0 ? (
          <li className="px-5 py-8 text-center text-[13px] text-text-3">Kalender belum terisi.</li>
        ) : (
          envelope.data.slice(0, 5).map((event) => (
            <li key={event.id} className="flex gap-3.5 px-5 py-3.5">
              <div className="w-[52px] shrink-0">
                <p className="font-mono text-[12px] text-text">{formatDay(event.date)}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-3">
                  {KIND_LABEL[event.kind]}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-text">
                  {sanitizeText(event.title, 70)}
                </p>
                {event.subtitle ? (
                  <p className="mt-1 text-[12px] leading-snug text-text-3">
                    {sanitizeText(event.subtitle, 70)}
                  </p>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function formatDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

/* ------------------------------------------------------------------ */

/**
 * "Sumber yang dipantau" (brief §6): delapan slot dalam grid dua kolom dengan
 * status sungguhan dari `/api/sources/status`. Ini juga panel diagnosa waktu
 * ada feed yang mati.
 */
export function SourcePanel({ initial }: { initial: ApiEnvelope<SourceStatus[]> }) {
  const envelope = usePoll<SourceStatus[]>('/api/sources/status', initial, POLL_MS.sources);
  const sources = envelope.data;
  const down = sources.filter((s) => s.state === 'down').length;

  return (
    <section className="card">
      <CardHead
        title="Sumber yang dipantau"
        aside={
          <span className={cx('font-mono text-[11px]', down > 0 ? 'text-down' : 'text-text-3')}>
            {down > 0 ? `${down} bermasalah` : `${sources.length} slot`}
          </span>
        }
      />
      <ul className="grid grid-cols-2 gap-px bg-border-soft">
        {sources.length === 0
          ? Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="bg-surface px-4 py-3">
                <span className="font-mono text-[12px] text-text-3">—</span>
              </li>
            ))
          : sources.map((source) => (
              <li key={source.id} className="bg-surface px-4 py-3" title={source.note}>
                <div className="flex items-center gap-2">
                  <StatusDot state={source.state} />
                  <span className="truncate font-mono text-[11px] text-text-2">{source.label}</span>
                </div>
                <p className="mt-1 truncate pl-4 text-[11px] text-text-3">{source.note}</p>
              </li>
            ))}
      </ul>
    </section>
  );
}
