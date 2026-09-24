'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { CloseIcon, CollapseSidebarIcon, ExpandSidebarIcon } from '@/components/icons';
import { SoonBadge, cx } from '@/components/ui';
import type { NavItem } from '@/lib/nav';

export function SidebarContent({
  items,
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  /** Only set when the sidebar is used as a drawer below 1024px. */
  onClose,
}: {
  items: NavItem[];
  /** Icon-only rail (desktop only) — the mobile drawer never collapses, so it omits this. */
  collapsed?: boolean;
  /** Present only for the desktop `<aside>` instance; its absence is what keeps the toggle out of the mobile drawer. */
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div
        className={cx(
          'flex h-topbar shrink-0 items-center border-b border-border-soft',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-6',
        )}
      >
        <Image
          src="/img/logo.jpg"
          alt=""
          aria-hidden
          width={32}
          height={32}
          priority
          quality={95}
          className="h-8 w-8 shrink-0 rounded-[8px]"
        />
        {!collapsed ? (
          <span className="flex-1 truncate font-display text-[15px] font-semibold tracking-[0.01em]">
            Robinchan
          </span>
        ) : null}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-text-3 transition-colors hover:text-text"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <nav
        className={cx('flex-1 overflow-y-auto py-5', collapsed ? 'px-2' : 'px-4')}
        aria-label="Main navigation"
      >
        {!collapsed ? <p className="t-eyebrow px-2 pb-3">Navigation</p> : null}
        <ul className="space-y-1">
          {items.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : (pathname?.startsWith(item.href) ?? false);
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled="true"
                    title={collapsed ? `${item.label} — not switched on yet` : "This page isn't switched on yet"}
                    className={cx(
                      'flex min-h-[44px] items-center rounded-full text-text-3',
                      collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                    )}
                  >
                    <Icon className="shrink-0 opacity-60" />
                    {!collapsed ? (
                      <>
                        <span className="flex-1 text-sm">{item.label}</span>
                        <SoonBadge />
                      </>
                    ) : null}
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
                  title={collapsed ? item.label : undefined}
                  className={cx(
                    'flex min-h-[44px] items-center rounded-full text-sm transition-colors',
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                    active
                      ? 'border border-accent-2/70 bg-accent/35 text-text shadow-glow-accent'
                      : 'border border-transparent text-text-2 hover:border-border hover:bg-surface hover:text-text',
                  )}
                >
                  <Icon className={cx('shrink-0', active && 'text-accent')} />
                  {!collapsed ? (
                    <>
                      <span className="flex-1">{item.label}</span>
                      <span
                        className={cx(
                          'font-mono text-[10px] uppercase tracking-[0.1em]',
                          active ? 'text-text-2' : 'text-text-3',
                        )}
                      >
                        {item.hint}
                      </span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cx(
            'flex min-h-[44px] shrink-0 items-center border-t border-border-soft text-text-3 transition-colors hover:text-text',
            collapsed ? 'justify-center px-2' : 'gap-2.5 px-6',
          )}
        >
          {collapsed ? <ExpandSidebarIcon /> : <CollapseSidebarIcon />}
          {!collapsed ? <span className="text-[13px]">Collapse</span> : null}
        </button>
      ) : null}

      {!collapsed ? (
        <div className="border-t border-border-soft px-6 py-5">
          <p className="t-eyebrow mb-2">Status</p>
          <p className="text-[13px] leading-relaxed text-text-3">
            Non-custodial. Your keys stay in your own wallet — the server can never sign on your
            behalf.
          </p>
        </div>
      ) : null}
    </div>
  );
}
