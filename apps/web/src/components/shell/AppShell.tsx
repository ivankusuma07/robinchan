'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { MenuIcon } from '@/components/icons';
import { Pill, PulseDot, cx } from '@/components/ui';
import { navItems, type NavFlags } from '@/lib/nav';

import { SidebarContent } from './Sidebar';
import { WalletButton } from './WalletButton';

/**
 * Shell shared by all three pages: 248px sidebar, 76px topbar (brief §3).
 * Below 1024px the sidebar becomes a drawer triggered by the hamburger in
 * the topbar.
 */
export function AppShell({ children, flags }: { children: ReactNode; flags: NavFlags }) {
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

  /* Routes whose content runs edge to edge instead of in the 1112px column. */
  const fullBleed = pathname?.startsWith('/robinchan') ?? false;

  const items = navItems(flags);
  const current = items.find((item) =>
    item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href),
  );

  return (
    <div className="min-h-screen lg:pl-sidebar">
      {/* Sidebar stays fixed on desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar border-r border-border-soft bg-surface lg:block">
        <SidebarContent items={items} />
      </aside>

      {/* Drawer below 1024px */}
      <div
        className={cx(
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        aria-hidden={!drawerOpen}
      >
        {/* Click-outside catcher for the drawer. Hidden from AT so it doesn't
            become a second control with the same label — close via the
            button in the drawer header or the Escape key instead. */}
        <div
          aria-hidden
          onClick={() => setDrawerOpen(false)}
          className={cx(
            'absolute inset-0 bg-text/40 transition-opacity duration-200',
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
            items={items}
            onNavigate={() => setDrawerOpen(false)}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      <header className="sticky top-0 z-30 flex h-topbar items-center gap-4 border-b border-border-soft bg-bg/95 px-5 backdrop-blur-sm lg:px-10">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
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

        <WalletButton />
      </header>

      {fullBleed ? (
        /* The character page's stage fills the whole content area; the page
           re-centres its own below-the-fold sections. */
        <main id="content" className="px-4 pb-24 pt-4">
          {children}
        </main>
      ) : (
        <main id="content" className="px-5 pb-24 pt-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1112px]">{children}</div>
        </main>
      )}
    </div>
  );
}
