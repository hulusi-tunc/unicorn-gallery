import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The capture-cli package is in the workspace and ships as ESM.
  // Next compiles it on demand, no extra config needed.
  experimental: {
    serverActions: { bodySizeLimit: '100mb' },
    // Cache dynamic pages in the client router for 30s so arrow-navigating
    // back to a previously viewed frame is instant (no server round-trip).
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'pub-c3fbfb7655eb4a7589d726cc0dfae691.r2.dev' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};

export default config;
