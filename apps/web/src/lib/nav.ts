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
  /** Item tanpa halaman tetap dirender, hanya dinonaktifkan (brief §3). */
  enabled: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    hint: 'Ringkasan',
    icon: HomeIcon,
    enabled: true,
  },
  {
    href: '/robinchan',
    label: 'Robinchan',
    hint: 'Karakter',
    icon: PodIcon,
    enabled: true,
  },
  {
    href: '/market',
    label: 'Market',
    hint: 'Data & berita',
    icon: MarketIcon,
    enabled: true,
  },
  {
    href: '/trade',
    label: 'Trade',
    hint: 'Fase 2',
    icon: TradeIcon,
    enabled: false,
  },
  {
    href: '/heat',
    label: 'Heat',
    hint: 'Fase 2',
    icon: HeatIcon,
    enabled: false,
  },
  {
    href: '/portfolio',
    label: 'Portfolio',
    hint: 'Fase 2',
    icon: PortfolioIcon,
    enabled: false,
  },
];
