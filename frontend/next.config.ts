import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../'),
  async rewrites() {
    if (process.env.NODE_ENV === 'production') return [];

    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.LOCAL_API_URL || 'http://127.0.0.1:3001'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
