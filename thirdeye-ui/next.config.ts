import type { NextConfig } from "next";

// Get the backend server target for development
const devServerTarget = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
const openmetadataBaseUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: [],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${openmetadataBaseUrl}/api/v1/:path*`,
      },
      {
        source: '/api/v1/health',
        destination: `${openmetadataBaseUrl}/api/v1/health`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/v1/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Requested-With' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Health check redirect to OpenMetadata backend
      {
        source: '/health',
        destination: `${openmetadataBaseUrl}/health`,
        permanent: false,
      },
    ];
  },
  // Experimental features for development
  experimental: {
    // Enable other Next.js experimental features if needed
    // serverActions is enabled by default in Next.js 15
  },
};

export default nextConfig;
