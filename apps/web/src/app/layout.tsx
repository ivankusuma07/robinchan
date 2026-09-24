import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { Web3Providers } from '@/components/providers/WalletProvider';

import './globals.css';

/* Inter for both headings and body (design.md §11). Loaded once and
   exposed under both variables so the display/body split in the Tailwind
   config — and every `font-display` call site — keeps working. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Robinchan — companion market on Robinhood Chain',
    template: '%s · Robinchan',
  },
  description:
    'Read tokenized stock markets, build orders through conversation, sign them yourself. Non-custodial on Robinhood Chain.',
  openGraph: {
    type: 'website',
    siteName: 'Robinchan',
    title: 'Robinchan — companion market on Robinhood Chain',
    description: 'Read tokenized stock markets, build orders through conversation, sign them yourself.',
  },
};

export const viewport: Viewport = {
  themeColor: '#F8FAF6',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        <Web3Providers>{children}</Web3Providers>
      </body>
    </html>
  );
}
