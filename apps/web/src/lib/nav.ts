import type { ComponentType, SVGProps } from 'react';

import {
  HeatIcon,
  HomeIcon,
  MarketIcon,
  PodIcon,
  PortfolioIcon,
  TradeIcon,
} from '@/components/icons';

export type NavItem = {
  href: string;
  label: string;
  hint: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Items without a page yet still render, just disabled (brief §3). */
  enabled: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    hint: 'Overview',
    icon: HomeIcon,
    enabled: true,
  },
  {
    href: '/robinchan',
    label: 'Robinchan',
    hint: 'Character',
    icon: PodIcon,
    enabled: true,
  },
  {
    href: '/market',
    label: 'Market',
    hint: 'Data & news',
    icon: MarketIcon,
    enabled: true,
  },
  {
    href: '/trade',
    label: 'Trade',
    hint: 'Phase 2',
    icon: TradeIcon,
    enabled: false,
  },
  {
    href: '/heat',
    label: 'Heat',
    hint: 'Phase 2',
    icon: HeatIcon,
    enabled: false,
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    hint: 'Phase 2',
    icon: PortfolioIcon,
    enabled: false,
  },
];
