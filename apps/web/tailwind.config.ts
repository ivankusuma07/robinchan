import type { Config } from 'tailwindcss';

/**
 * Tokens pulled from dev brief §3 and design.md §2. Don't change their
 * values without recording the reason in design.md.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Light theme (design.md §11). Values follow the brand sheet's light
         palette. */
      colors: {
        bg: '#F8FAF6',
        surface: '#FFFFFF',
        'surface-2': '#EDF3EC',
        border: '#E5EDE7',
        'border-soft': '#EDF3EC',
        text: '#1F2937',
        'text-2': '#4B5563',
        // Sheet's "Text Muted" is #9AA3B8, which is ~2.4:1 on the page
        // background — too faint for the 11–12px captions this token
        // carries. Darkened to clear 4.5:1 while staying the same cool grey.
        'text-3': '#6B7280',
        accent: '#D4F450',
        'accent-2': '#A3E635',
        'accent-ink': '#1F2937',
        up: '#22C55E',
        down: '#EF4444',
        // Character accent, its scope is locked in design.md §2.
        'companion-pink': '#F9A8BE',
        // Warm supporting accent for the marketing layout only (design.md
        // §10) — the sheet's "Warning" amber.
        ember: '#F59E0B',
        info: '#3B82F6',
      },
      /* Foreground overrides. The palette's fills are bright by design —
         lime, success green, pink — and read as solid shapes, but as *text*
         on a near-white page they fall to 1.3–2.5:1. Tailwind resolves
         `text-*` from `textColor` first, so these give every `text-accent`,
         `text-up`, etc. a darker shade of the same hue while `bg-*` and
         `border-*` keep the sheet's exact values. */
      textColor: {
        accent: '#4D7C0F',
        up: '#15803D',
        down: '#DC2626',
        'companion-pink': '#DB2777',
        ember: '#B45309',
      },
      fontFamily: {
        display: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '20px',
        panel: '16px',
        tile: '10px',
        row: '8px',
      },
      spacing: {
        sidebar: '248px',
        topbar: '76px',
        hero: '660px',
        panel: '412px',
        stage: '736px',
      },
      boxShadow: {
        // On a light page a glow reads as a smudge; these are soft lifted
        // shadows with a hint of the brand hue instead.
        'glow-accent': '0 6px 20px -6px rgba(163, 230, 53, 0.45)',
        'glow-soft': '0 4px 16px -8px rgba(31, 41, 55, 0.14)',
        'glow-pink': '0 6px 20px -6px rgba(249, 168, 190, 0.5)',
      },
      // Marquee keyframes are deliberately not here: `<Marquee>` sets
      // `animation-name` via inline style since speed is a runtime prop, and
      // Tailwind only emits @keyframes referenced by an `animate-*` utility.
      // They live in globals.css instead so they don't get tree-shaken.
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.82)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.22' },
          '50%': { opacity: '0.55' },
        },
        'pod-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%': { transform: 'translateY(-5px)', opacity: '1' },
        },
        'caret-blink': {
          '0%, 45%': { opacity: '1' },
          '55%, 100%': { opacity: '0.15' },
        },
        // One-shot hero entrance, not a loop — plays once on mount.
        'hero-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        breathe: 'breathe 2.8s ease-in-out infinite',
        'pod-bounce': 'pod-bounce 1.25s ease-in-out infinite',
        'caret-blink': 'caret-blink 1.1s steps(1, end) infinite',
        'hero-in': 'hero-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      transitionTimingFunction: {
        // Sidebar drawer: soft, not a snap (design.md §3).
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
