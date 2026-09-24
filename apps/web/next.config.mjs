/** @type {import('next').NextConfig} */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Page flags (FEATURE_HEAT_PAGE, FEATURE_PORTFOLIO_PAGE, FEATURE_TRADING)
 * and chain/public config (NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_RPC_URL, etc.)
 * live in the repo-root `.env` that the API and worker also read, so one
 * value stays in sync everywhere instead of needing to be copied into
 * `apps/web/.env.local` separately. Next only reads `.env` files from
 * `apps/web`, so the root file is read here — **`FEATURE_*` and
 * `NEXT_PUBLIC_*` keys only**: `NEXT_PUBLIC_*` is Next's own convention for
 * "safe to inline into the browser bundle", and nothing outside those two
 * prefixes is forwarded, so provider keys and DB credentials in the same
 * file never reach the web process. A value already in the environment
 * (e.g. set by the host) wins over the file.
 */
(function loadRootConfig() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let text = '';
  try {
    text = readFileSync(join(root, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*((?:FEATURE|NEXT_PUBLIC)_[A-Z0-9_]+)\s*=\s*([^#\s]*)/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
})();

const isDev = process.env.NODE_ENV !== 'production';

/** API origin read from the same env var the fetch client uses. */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
  } catch {
    return 'http://localhost:4000';
  }
})();

const CUBISM_ORIGIN = 'https://cubism.live2d.com';

/** Robinhood Chain RPC origin — wagmi's public client calls this directly from the browser. */
const rpcOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_RPC_URL ?? 'https://rpc.testnet.chain.robinhood.com')
      .origin;
  } catch {
    return 'https://rpc.testnet.chain.robinhood.com';
  }
})();

// Strict CSP; `frame-src` limited to the video embed domains actually used (brief §15).
const csp = [
  "default-src 'self'",
  // Next injects an inline bootstrap script, and Cubism Core executes WASM
  // (needs `wasm-unsafe-eval`, not full `unsafe-eval`). Full `unsafe-eval`
  // is only for the dev server's own tooling — PixiJS's renderer also wants
  // `new Function(...)` for its uniform-sync codegen, but that's handled
  // without weakening CSP via `@pixi/unsafe-eval` in Live2DCanvas.tsx,
  // which patches PixiJS to skip that codegen instead.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : "'wasm-unsafe-eval'"} ${CUBISM_ORIGIN}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com",
  "font-src 'self' data:",
  // NOTE: once NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set, WalletConnect's
  // relay and Reown's API need adding here too (their exact current hosts,
  // checked at that time) — not added now since no connector uses them yet.
  `connect-src 'self' ${apiOrigin} ${CUBISM_ORIGIN} ${rpcOrigin}`,
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  transpilePackages: ['@robinchan/shared'],
  /**
   * `@robinchan/shared` is consumed as TypeScript source, and its internal
   * imports use `.js` specifiers — the correct form for an ESM package, and
   * what tsx requires on the API and worker side. Webpack doesn't map that
   * to `.ts` on its own, so the alias is set up here.
   */
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    /**
     * wagmi's `baseAccount` connector (pulled in transitively by
     * `@rainbow-me/rainbowkit`, even though only `injectedWallet` is
     * actually used — see wagmiConfig.ts) drags in `@coinbase/cdp-sdk`,
     * whose x402-payment code path does `import("@x402/evm/upto/client")`
     * etc. `@x402/*` are the CDP SDK's own *optional* peer dependencies —
     * its source comment says so directly, and each import is already
     * wrapped in a try/catch that raises a clear "install the peer dep"
     * error at runtime if it's missing. Webpack's static analysis doesn't
     * know that and hard-fails the build instead. Robinchan never calls
     * any Coinbase Smart Wallet / x402 payment code, so this path is dead
     * either way — aliasing the whole scope to `false` (webpack's "stub
     * this out" alias) leaves it unresolved rather than trying to bundle
     * packages nothing installs.
     */
    config.resolve.alias = { ...config.resolve.alias, '@x402': false };
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        // Only the large binary assets are genuinely immutable. The moc3
        // rig and its texture atlas never change without a filename bump.
        source: '/live2d/:path*.(moc3|png)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The JSON config files (model3.json, expressions, motions) get
        // edited in place — e.g. adding a new expression — so they must
        // revalidate instead of being cached for a year. A stale cached
        // model3.json missing a newly-added expression name makes
        // pixi-live2d-display's `model.expression(name)` silently no-op,
        // which looks exactly like "the expression is stuck".
        source: '/live2d/:path*.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
