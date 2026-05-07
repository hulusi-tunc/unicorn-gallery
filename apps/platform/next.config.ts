import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // The capture-cli package is in the workspace and ships as ESM.
  // Next compiles it on demand, no extra config needed.
  experimental: {
    // Default is 1mb; capture sessions with 10+ screenshots easily exceed it.
    // Note: this officially only applies to Server Actions, but in Next 15 it
    // also raises the multipart limit on route handlers in dev mode.
    serverActions: { bodySizeLimit: '100mb' },
  },
};

export default config;
