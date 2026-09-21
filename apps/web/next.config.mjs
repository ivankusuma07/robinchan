/** @type {import('next').NextConfig} */

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
  `connect-src 'self' ${apiOrigin} ${CUBISM_ORIGIN}`,
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
