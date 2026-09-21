/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== 'production';

/** Origin API dibaca dari env yang sama dengan yang dipakai klien fetch. */
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
  } catch {
    return 'http://localhost:4000';
  }
})();

const CUBISM_ORIGIN = 'https://cubism.live2d.com';

// CSP ketat; `frame-src` hanya untuk domain embed video yang dipakai (brief §15).
const csp = [
  "default-src 'self'",
  // Next menyisipkan bootstrap inline, dan Cubism Core mengeksekusi WASM.
  // `unsafe-eval` penuh hanya untuk dev server — production cukup WASM.
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
   * `@robinchan/shared` dikonsumsi sebagai sumber TypeScript dan impor
   * internalnya memakai spesifier `.js` — bentuk yang benar untuk paket ESM,
   * dan yang dibutuhkan tsx di sisi API dan worker. Webpack tidak memetakannya
   * ke `.ts` sendiri, jadi alias-nya dipasang di sini.
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
        // Aset model tidak pernah berubah tanpa ganti nama berkas.
        source: '/live2d/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
