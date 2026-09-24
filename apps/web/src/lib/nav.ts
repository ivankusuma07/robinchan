import type { ComponentType, SVGProps } from 'react';

import {
  HeatIcon,
  HomeIcon,
  MarketIcon,
  PodIcon,
  PortfolioIcon,
  TradeIcon,
} from '@/components/icons';

/** Page flags as the client sees them — see `lib/flags.ts` (server-only). */
export type NavFlags = {
  heat: boolean;
  portfolio: boolean;
  trade: boolean;
};

export type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Items without a live page still render, just disabled (brief §3). */
  enabled: boolean;
};

type NavDef = Omit<NavItem, 'enabled'> & {
  /** The page flag that switches this item on; absent = always on. */
  flag?: keyof NavFlags;
};

const NAV_DEFS: NavDef[] = [
  { href: '/', label: 'Home', hint: 'Overview', icon: HomeIcon },
  { href: '/robinchan', label: 'Robinchan', hint: 'Character', icon: PodIcon },
  { href: '/market', label: 'Market', hint: 'Data & news', icon: MarketIcon },
  { href: '/trade', label: 'Trade', hint: 'Order', icon: TradeIcon, flag: 'trade' },
  { href: '/heat', label: 'Heat', hint: 'Ranking', icon: HeatIcon, flag: 'heat' },
  { href: '/portfolio', label: 'Portfolio', hint: 'Holdings', icon: PortfolioIcon, flag: 'portfolio' },
];

/**
 * Sidebar items for a given set of page flags (plan §3): an item whose page
 * is off stays visible but disabled, with its "Soon" badge; switching the
 * flag on turns it into a normal link.
 */
export function navItems(flags: NavFlags): NavItem[] {
  return NAV_DEFS.map(({ flag, ...item }) => ({
    ...item,
    enabled: flag ? flags[flag] : true,
  }));
}
