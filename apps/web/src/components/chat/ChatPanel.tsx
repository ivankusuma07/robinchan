'use client';

import { useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { ArrowRightIcon } from '@/components/icons';
import { CardHead, cx } from '@/components/ui';

/**
 * Panel chat halaman `/robinchan` (brief §5).
 *
 * Ini kerangka chat sungguhan — daftar pesan, komposer, dan slot untuk
 * menyisipkan kartu order di tengah alur. Sambungan SSE ke `POST /api/chat`
 * dan riwayat di server baru masuk di M3 bersama SIWE, jadi komposernya
 * dimatikan dan alasannya disebut terang-terangan, bukan dibiarkan terlihat
 * aktif lalu gagal diam-diam saat ditekan.
 */

type Message = { id: string; role: 'user' | 'chan'; text: string };

const SEED: Message[] = [
  {
    id: 'm1',
    role: 'chan',
    text: 'Halo. Aku bisa bacakan pergerakan harga, filing, dan berita — lalu bantu susun order kalau kamu mau. Tanda tangannya tetap dari wallet kamu sendiri.',
  },
  {
    id: 'm2',
    role: 'chan',
    text: 'Chat penuh menyala di milestone M3, setelah connect wallet dan SIWE jalan. Sementara ini halaman Market sudah terisi data sungguhan.',
  },
];

export function ChatPanel() {
  const [draft, setDraft] = useState('');

  return (
    <section className="card flex h-full min-h-[560px] flex-col">
      <CardHead
        title="Percakapan"
        aside={<span className="font-mono text-[11px] text-text-3">M3</span>}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-4" role="log" aria-label="Riwayat pesan">
        {SEED.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}

        {/* Kursor token streaming: kedipan aksen lembut, bukan caret polos. */}
        <div className="flex gap-3 pl-[40px]">
          <span
            className="inline-block h-[15px] w-[2px] animate-caret-blink rounded-full bg-accent"
            aria-hidden
          />
        </div>
      </div>

      <form
        className="border-t border-border-soft p-3"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Kirim pesan"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Tulis pesan untuk Robinchan
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={draft}
            disabled
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Chat aktif setelah wallet tersambung (M3)"
            className={cx(
              'min-h-[44px] flex-1 resize-none rounded-panel border border-border bg-surface-2 px-3.5 py-3',
              'text-[14px] text-text placeholder:text-text-3 disabled:cursor-not-allowed disabled:opacity-70',
            )}
          />
          <button
            type="submit"
            disabled
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-shadow disabled:opacity-45 enabled:hover:shadow-glow-pink"
            aria-label="Kirim"
          >
            <ArrowRightIcon />
          </button>
        </div>
        <p className="mt-2.5 px-1 text-[11px] leading-relaxed text-text-3">
          Riwayat disimpan di server, bukan di browser, supaya konsisten lintas perangkat.
        </p>
      </form>
    </section>
  );
}

function Bubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[86%] rounded-[16px] rounded-br-[6px] border border-border bg-surface-2 px-3.5 py-2.5 text-[14px] leading-relaxed">
          {message.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar />
      <p className="max-w-[86%] rounded-[16px] rounded-bl-[6px] border border-accent/20 bg-accent/[0.05] px-3.5 py-2.5 text-[14px] leading-relaxed">
        {message.text}
      </p>
    </div>
  );
}
