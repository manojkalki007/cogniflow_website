import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.cal.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://app.cal.com",
              "font-src 'self' https://fonts.gstatic.com https://app.cal.com",
              "img-src 'self' https://images.unsplash.com https://app.cal.com data:",
              "frame-src https://app.cal.com",
              "media-src 'self' https://stream.mux.com https://*.mux.com https://*.fastly.mux.com blob:",
              "connect-src 'self' https://stream.mux.com https://*.mux.com https://*.fastly.mux.com https://cbpzsvzfoquowbldtsrh.supabase.co https://app.cal.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
