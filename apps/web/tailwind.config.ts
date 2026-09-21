import type { Config } from 'tailwindcss';

/**
 * Tokens pulled from dev brief §3 and design.md §2. Don't change their
 * values without recording the reason in design.md.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        surface: '#111111',
        'surface-2': '#151515',
        border: '#242424',
        'border-soft': '#1C1C1C',
        text: '#FFFFFF',
        'text-2': '#9C9C9C',
        'text-3': '#6E6E6E',
        accent: '#7BE07B',
        'accent-ink': '#06240A',
        up: '#6EE787',
        down: '#FF8080',
        // Character accent, its scope is locked in design.md §2.
        'companion-pink': '#FFB6C1',
        // Warm supporting accent for the marketing layout only, used
        // sparingly for variety without turning companion-pink into a
        // second general-purpose brand color (design.md §10).
        ember: '#F2A65A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
        'glow-accent': '0 0 24px rgba(123, 224, 123, 0.15)',
        'glow-soft': '0 0 18px rgba(123, 224, 123, 0.08)',
        'glow-pink': '0 0 26px rgba(255, 182, 193, 0.12)',
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
