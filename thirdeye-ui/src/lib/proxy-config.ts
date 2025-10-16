/**
 * Proxy configuration for development environment
 * Handles backend API routing similar to OpenMetadata webpack configuration
 */

interface ProxyConfig {
  target: string;
  changeOrigin: boolean;
  secure: boolean;
  logLevel: string;
  pathRewrite?: Record<string, string>;
  onProxyReq?: (proxyReq: any, req: any, res: any) => void;
  onProxyRes?: (proxyRes: any, req: any, res: any) => void;
}

export const getDevServerConfig = (): { proxy: ProxyConfig[] } => {
  // Default backend server - can be overridden by environment variables
  const devServerTarget = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
  const openmetadataBaseUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';

  return {
    proxy: [
      {
        // Proxy all /api/v1/* routes to OpenMetadata backend
        context: ['/api/v1/'],
        target: devServerTarget.replace(/\/$/, ''), // Remove trailing slash
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        pathRewrite: {
          '^/api/v1': '/api/v1', // Keep the path as-is, just change target
        },
        onProxyReq: (proxyReq, req, res) => {
          console.log(`🔄 Proxying ${req.method} ${req.url} → ${devServerTarget}${req.url.replace('/api/v1', '/api/v1')}`);
          
          // Set proper headers for development
          proxyReq.setHeader('X-Forwarded-Proto', 'http');
          proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
          
          // Preserve original origin for debugging
          if (req.headers.origin) {
            proxyReq.setHeader('X-Original-Origin', req.headers.origin);
          }
        },
        onProxyRes: (proxyRes, req, res) => {
          // Add CORS headers from backend
          const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          };

          Object.entries(corsHeaders).forEach(([key, value]) => {
            proxyRes.headers[key] = value;
          });
        }
      },
      {
        // Health check route
        context: ['/health'],
        target: openmetadataBaseUrl,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      }
    ]
  };
};

export const getDevelopmentEnvConfig = () => ({
  OPENMETADATA_BASE_URL: process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585',
  DEV_SERVER_TARGET: process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/',
  NEXT_PUBLIC_OPENMETADATA_BASE_URL: process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585',
});

// Export backend connection utilities
export const getBackendUrl = (path = '') => {
  const baseUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';
  return path.startsWith('http') ? path : `${baseUrl}${path}`;
};

export const isDevelopmentMode = () => {
  return process.env.NODE_ENV === 'development';
};
