import type { SVGProps } from 'react';

/**
 * Ikon navigasi sengaja polos dan geometris. Satu-satunya pengecualian adalah
 * `PodIcon` untuk `/robinchan` — siluet polong edamame, motif telinga Zundamon
 * (design.md §3: satu sentuhan karakter, bukan tema untuk semua ikon).
 */

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 7.2 9 2.5l6.5 4.7V15a.5.5 0 0 1-.5.5h-4v-5h-4v5H3a.5.5 0 0 1-.5-.5V7.2Z" />
    </svg>
  );
}

/** Polong edamame: tiga biji dalam satu kapsul miring. */
export function PodIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.4 13.6c-1.6-1.6-1.2-4.6 1-6.8s5.2-2.6 6.8-1 1.2 4.6-1 6.8-5.2 2.6-6.8 1Z" />
      <circle cx="6.6" cy="11.4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="9" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function MarketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12.5 6.5 8l3 2.6 5.5-6" />
      <path d="M11.4 4.6H15v3.6" />
      <path d="M2.5 15.5h13" />
    </svg>
  );
}

export function TradeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 6.5h9.5M10 4l2.5 2.5L10 9" />
      <path d="M15 11.5H5.5M8 9l-2.5 2.5L8 14" />
    </svg>
  );
}

export function HeatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 15.5v-4M7.2 15.5V7M10.8 15.5v-6M14.5 15.5V3.5" />
    </svg>
  );
}

export function PortfolioIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2.5" y="5.5" width="13" height="10" rx="1.5" />
      <path d="M6.5 5.5V4a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 11.5 4v1.5" />
      <path d="M2.5 9.5h13" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base({ width: 20, height: 20, viewBox: '0 0 20 20', ...props })}>
      <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base({ width: 20, height: 20, viewBox: '0 0 20 20', ...props })}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base({ width: 16, height: 16, viewBox: '0 0 16 16', ...props })}>
      <path d="M3 8h9.5M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...base({ width: 14, height: 14, viewBox: '0 0 14 14', ...props })}>
      <rect x="2.75" y="6" width="8.5" height="6" rx="1.5" />
      <path d="M4.75 6V4.25a2.25 2.25 0 0 1 4.5 0V6" />
    </svg>
  );
}

export function WaveformIcon(props: IconProps) {
  return (
    <svg {...base({ width: 16, height: 16, viewBox: '0 0 16 16', ...props })}>
      <path d="M2 8v0M4.5 5.5v5M7 3v10M9.5 5.5v5M12 7v2M14 8v0" />
    </svg>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <svg {...base({ width: 14, height: 14, viewBox: '0 0 14 14', ...props })}>
      <path d="M5.5 2.5H2.75v8.75h8.75V8.5" />
      <path d="M8 2.5h3.5V6M11.5 2.5 6.75 7.25" />
    </svg>
  );
}
