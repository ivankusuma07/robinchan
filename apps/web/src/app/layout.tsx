import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700'],
});

const body = Instrument_Sans({
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
  themeColor: '#0A0A0A',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
