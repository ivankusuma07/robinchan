import type { Config } from 'tailwindcss';

/**
 * Token diambil dari dev brief §3 dan design.md §2. Jangan ubah nilainya tanpa
 * mencatat alasannya di design.md.
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
        // Aksen karakter, cakupannya dikunci di design.md §2.
        'companion-pink': '#FFB6C1',
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
      // Keyframes marquee sengaja tidak di sini: `<Marquee>` memasang
      // `animation-name` lewat style inline karena kecepatannya prop runtime,
      // dan Tailwind hanya menerbitkan @keyframes yang dipakai utilitas
      // `animate-*`. Ditaruh di globals.css supaya tidak ikut tree-shake.
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
      },
      animation: {
        'pulse-dot': 'pulse-dot 2s ease-in-out infinite',
        breathe: 'breathe 2.8s ease-in-out infinite',
        'pod-bounce': 'pod-bounce 1.25s ease-in-out infinite',
        'caret-blink': 'caret-blink 1.1s steps(1, end) infinite',
      },
      transitionTimingFunction: {
        // Drawer sidebar: lembut, bukan snap (design.md §3).
        soft: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
