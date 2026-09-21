'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CloseIcon, PodIcon } from '@/components/icons';
import { SoonBadge, cx } from '@/components/ui';
import { NAV_ITEMS } from '@/lib/nav';

export function SidebarContent({
  onNavigate,
  /** Hanya diisi saat sidebar dipakai sebagai drawer di bawah 1024px. */
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-border-soft px-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink">
          <PodIcon width={16} height={16} />
        </span>
        <span className="flex-1 font-display text-[15px] font-semibold tracking-[0.01em]">
          Robinchan
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup navigasi"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-text-3 transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5" aria-label="Navigasi utama">
        <p className="t-eyebrow px-2 pb-3">Navigasi</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : (pathname?.startsWith(item.href) ?? false);
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    className="flex min-h-[44px] items-center gap-3 rounded-full px-3 text-text-3"
                    title="Halaman ini belum ada — menyusul di fase 2"
                  >
                    <Icon className="shrink-0 opacity-60" />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <SoonBadge />
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex min-h-[44px] items-center gap-3 rounded-full px-3 text-sm transition-colors',
                    active
                      ? 'border border-accent/45 bg-accent/[0.07] text-text shadow-glow-accent'
                      : 'border border-transparent text-text-2 hover:border-border hover:bg-surface hover:text-text',
                  )}
                >
                  <Icon className={cx('shrink-0', active && 'text-accent')} />
                  <span className="flex-1">{item.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-3">
                    {item.hint}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border-soft px-6 py-5">
        <p className="t-eyebrow mb-2">Status</p>
        <p className="text-[13px] leading-relaxed text-text-3">
          Non-custodial. Kunci tetap di wallet kamu — server tidak pernah bisa menandatangani.
        </p>
      </div>
    </div>
  );
}
