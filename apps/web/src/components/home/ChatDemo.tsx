import type { OrderQuote } from '@robinchan/shared';

import { Avatar } from '@/components/Avatar';
import { OrderPreviewCard } from '@/components/OrderPreviewCard';
import { CardHead, cx } from '@/components/ui';

/**
 * Kartu "Ngobrol, jadi order" (brief §4 blok 3).
 *
 * Isinya tetap dan di-hardcode. Ini bukan chat sungguhan dan tidak tersambung
 * ke API — chat yang asli ada di `/robinchan`. Karena statis, kartu ini boleh
 * jadi yang paling "didesain" di halaman ini (design.md §4).
 */

const DEMO_QUOTE: OrderQuote = {
  intent: {
    side: 'buy',
    symbol: 'NVDA',
    qty: 4,
    orderType: 'limit',
    limitPrice: 172,
  },
  estPrice: 172.0,
  estTotal: 688.42,
  estGas: 0.31,
  protocolFee: 0.11,
  expiresAt: new Date(0).toISOString(),
  warnings: [],
};

type Turn = { from: 'user' | 'chan'; text: string };

const TURNS: Turn[] = [
  { from: 'user', text: 'nvda lagi gimana hari ini?' },
  {
    from: 'chan',
    text: 'Naik 2,1% sejak pembukaan. Ada satu filing 8-K soal perjanjian pasokan baru sejam lalu, dan volumenya di atas rata-rata 20 hari.',
  },
  { from: 'user', text: 'ambil 4 lembar kalau turun ke 172' },
  {
    from: 'chan',
    text: 'Oke — limit beli 4 NVDA di 172. Aku susunkan quote-nya, tapi yang menekan tanda tangan tetap kamu.',
  },
];

export function ChatDemo() {
  return (
    <section className="card overflow-hidden">
      <CardHead
        title="Ngobrol, jadi order"
        aside={<span className="font-mono text-[11px] text-text-3">contoh percakapan</span>}
      />

      <div className="space-y-4 p-5">
        {TURNS.map((turn, i) => (
          <Bubble key={i} turn={turn} />
        ))}

        <div className="pl-10">
          <OrderPreviewCard quote={DEMO_QUOTE} demo />
        </div>
      </div>
    </section>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.from === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[78%] rounded-[16px] rounded-br-[6px] border border-border bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-text">
          {turn.text}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Avatar />
      <p
        className={cx(
          'max-w-[78%] rounded-[16px] rounded-bl-[6px] border border-accent/20 bg-accent/[0.05]',
          'px-4 py-2.5 text-[14px] leading-relaxed text-text',
        )}
      >
        {turn.text}
      </p>
    </div>
  );
}
