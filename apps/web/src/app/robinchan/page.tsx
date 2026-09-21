import type { Metadata } from 'next';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { TierCards } from '@/components/chat/TierCards';
import { Live2DStage } from '@/components/live2d/Live2DStage';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Robinchan',
  description: 'Companion Live2D yang membaca market dan membantu menyusun order.',
};

/**
 * Halaman karakter (brief §5): stage Live2D 736px di kiri, panel chat di
 * kanan, tiga kartu tier di bawah.
 */
export default function RobinchanPage() {
  return (
    <>
      <PageHeader
        eyebrow="Karakter"
        title="Robinchan"
        lead="Dia membaca market, menjelaskan kenapa sesuatu bergerak, dan menyusun order dari kalimat biasa. Yang tidak bisa dia lakukan: menandatangani apa pun atas namamu."
      />

      <div className="grid-stage items-stretch pb-4">
        <Live2DStage />
        <ChatPanel />
      </div>

      <div className="pt-4">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="t-eyebrow mb-2.5">Tier</p>
            <h2 className="t-h3">Yang terbuka seiring saldo $RCHAN</h2>
          </div>
          <p className="max-w-[420px] text-[12px] leading-relaxed text-text-3">
            Ambang tiap tier dibaca dari saldo on-chain, bukan dari klaim di sisi browser. Angka
            ambangnya belum final dan disimpan sebagai konfigurasi.
          </p>
        </div>

        <TierCards />
      </div>
    </>
  );
}
