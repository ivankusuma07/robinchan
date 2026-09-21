'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { MenuIcon } from '@/components/icons';
import { Pill, PulseDot, cx } from '@/components/ui';
import { NAV_ITEMS } from '@/lib/nav';

import { SidebarContent } from './Sidebar';

/**
 * Shell dipakai ketiga halaman: sidebar 248px, topbar 76px (brief §3).
 * Di bawah 1024px sidebar jadi drawer yang dipicu hamburger di topbar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const current = NAV_ITEMS.find((item) =>
    item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
  );

  return (
    <div className="min-h-screen lg:pl-sidebar">
      {/* Sidebar tetap di desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar border-r border-border-soft bg-surface lg:block">
        <SidebarContent />
      </aside>

      {/* Drawer di bawah 1024px */}
      <div
        className={cx(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        {/* Penangkap klik di luar drawer. Disembunyikan dari AT supaya tidak
            jadi kontrol kedua dengan label yang sama — tutup lewat tombol di
            header drawer atau tombol Escape. */}
        <div
          aria-hidden
          onClick={() => setDrawerOpen(false)}
          className={cx(
            'absolute inset-0 bg-black/70 transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div
          className={cx(
            'absolute inset-y-0 left-0 w-sidebar max-w-[86vw] border-r border-border-soft bg-surface transition-transform duration-[250ms] ease-soft',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <SidebarContent
            onNavigate={() => setDrawerOpen(false)}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      <header className="sticky top-0 z-30 flex h-topbar items-center gap-4 border-b border-border-soft bg-bg/95 px-5 backdrop-blur-sm lg:px-10">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Buka navigasi"
          aria-expanded={drawerOpen}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-text-3 hover:text-text lg:hidden"
        >
          <MenuIcon />
        </button>

        <div className="min-w-0 flex-1">
          <p className="t-eyebrow">Robinhood Chain</p>
          <p className="truncate font-display text-[15px] font-medium">
            {current?.label ?? 'Robinchan'}
          </p>
        </div>

        <Pill tone="accent" className="hidden sm:inline-flex">
          <PulseDot />
          testnet
        </Pill>

        {/* Wallet masuk di M3 — tombolnya sudah ada supaya topbar tidak berubah
            tinggi waktu fiturnya menyala. */}
        <button
          type="button"
          disabled
          title="Connect wallet menyusul di milestone M3"
          className="btn-ghost h-11 px-4 text-sm"
        >
          Connect wallet
        </button>
      </header>

      <main id="konten" className="px-5 pb-24 pt-8 lg:px-10">
        <div className="mx-auto w-full max-w-[1112px]">{children}</div>
      </main>
    </div>
  );
}
