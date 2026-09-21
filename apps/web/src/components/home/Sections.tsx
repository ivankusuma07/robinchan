import Link from 'next/link';

/**
 * Blok statis Home (brief §4 blok 6–8). Isinya tetap dan boleh di-hardcode;
 * karena tidak pernah berubah, tampilannya juga dijaga tetap sederhana
 * (design.md §4).
 */

const FEATURES = [
  {
    title: 'Satu layar, bukan enam tab',
    body: 'Harga, filing SEC, berita, dan aktivitas on-chain dikumpulkan jadi satu feed dengan waktu relatif dan sentimen — bukan enam sumber yang harus kamu jahit sendiri.',
  },
  {
    title: 'Perintah dalam kalimat biasa',
    body: 'Tulis niatmu seperti biasa. Kalau ada yang kurang jelas, Robinchan bertanya balik — tidak pernah menebak, karena salah tebak di sini artinya kamu rugi uang.',
  },
  {
    title: 'Kunci tetap di tanganmu',
    body: 'Server menyusun payload transaksi, lalu berhenti di situ. Tidak ada private key, seed phrase, atau session key yang disimpan — setiap transaksi butuh tanda tangan baru darimu.',
  },
];

export function FeatureCards() {
  return (
    <section className="grid gap-4 py-4 md:grid-cols-3" aria-label="Kemampuan utama">
      {FEATURES.map((feature, i) => (
        <article key={feature.title} className="card-soft flex flex-col p-6">
          <span className="t-eyebrow mb-5">{String(i + 1).padStart(2, '0')}</span>
          <h3 className="t-h3 mb-3">{feature.title}</h3>
          <p className="t-small text-[13px] leading-relaxed">{feature.body}</p>
        </article>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    label: 'Fee trading',
    body: 'Sebagian fee tiap order masuk ke alamat treasury.',
  },
  {
    label: 'Tier premium',
    body: 'Langganan tier ikut mengalir ke kas yang sama.',
  },
  {
    label: 'Treasury',
    body: 'Saldo dan akumulasinya dicatat per jam, terbuka untuk dibaca.',
  },
  {
    label: 'Buyback $RCHAN',
    body: 'Eksekusi pembelian dijalankan manual, bukan oleh server.',
  },
];

export function CapitalFlow() {
  return (
    <section className="card p-6 md:p-8" aria-label="Alur modal">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="t-eyebrow mb-2.5">Alur modal</p>
          <h2 className="t-h3">Ke mana fee-nya pergi</h2>
        </div>
        <p className="max-w-[380px] text-[12px] leading-relaxed text-text-3">
          Buyback sengaja tidak diotomatiskan. Server yang bisa memindahkan dana berarti server
          memegang kunci, dan itu bertabrakan dengan prinsip non-custodial.
        </p>
      </div>

      <ol className="grid gap-px overflow-hidden rounded-panel bg-border-soft md:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.label} className="bg-surface p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border font-mono text-[10px] text-text-3">
                {i + 1}
              </span>
              <span className="font-display text-[14px] font-medium">{step.label}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-text-3">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */

type FooterLink = { label: string; href?: string };

/** Halaman fase 2 belum ada rutenya, jadi disebut tanpa tautan — bukan tautan mati. */
const FOOTER_LINKS: Array<{ heading: string; links: FooterLink[] }> = [
  {
    heading: 'Produk',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Robinchan', href: '/robinchan' },
      { label: 'Market', href: '/market' },
    ],
  },
  {
    heading: 'Menyusul',
    links: [{ label: 'Trade' }, { label: 'Heat' }, { label: 'Portfolio' }],
  },
  {
    heading: 'Token',
    links: [
      { label: 'Tier & gating', href: '/robinchan' },
      { label: '$RCHAN di Pons' },
      { label: 'Buyback' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-4 border-t border-border-soft pt-10">
      <div className="grid gap-10 pb-10 md:grid-cols-[1fr_auto] md:gap-16">
        <div className="max-w-[420px]">
          <p className="font-display text-[15px] font-semibold tracking-[0.01em]">Robinchan</p>
          <p className="mt-3 text-[13px] leading-relaxed text-text-3">
            Companion market berkarakter untuk saham tokenized di Robinhood Chain.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {FOOTER_LINKS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="t-eyebrow mb-4">{column.heading}</p>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href ? (
                      <Link
                        href={link.href}
                        className="text-[13px] text-text-2 transition-colors hover:text-text"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-text-3">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-border-soft py-8">
        <p className="max-w-[760px] text-[12px] leading-relaxed text-text-3">
          Bukan nasihat keuangan. Saham tokenized adalah sekuritas dan ketersediaannya berbeda tiap
          yurisdiksi. Fitur trading masih di balik feature flag yang mati secara default sampai
          ketentuan lisensi dan disclosure selesai ditinjau. Data harga dan berita berasal dari
          penyedia pihak ketiga dan bisa terlambat atau tidak lengkap.
        </p>
      </div>
    </footer>
  );
}
