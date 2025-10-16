/**
 * Development configuration for ThirdEye UI
 * Similar to OpenMetadata's webpack.config.dev.js but adapted for Next.js
 */

const path = require('path');

// Development server configuration similar to OpenMetadata
const devServerTarget = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
const openmetadataBaseUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';

const devConfig = {
  // Development proxy configuration
  devServer: {
    // Enable CORS for development
    cors: true,
    
    // Proxy API requests to OpenMetadata backend
    proxy: [
      {
        context: ['/api/', '/api/v1/'],
        target: devServerTarget,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        onProxyReq: function (proxyReq, req, res) {
          // Add custom headers for development
          proxyReq.setHeader('X-Forwarded-Proto', 'http');
          proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
        },
        onProxyRes: function (proxyRes, req, res) {
          // Handle CORS headers from backend
          proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
        }
      }
    ],
    
    // Development server settings
    host: '0.0.0.0',
    port: 3000,
    hot: true,
    compress: true,
    open: true,
    
    // Route all requests to index.html so SPA routing works
    historyApiFallback: {
      disableDotRule: true,
    },
    
    // Development logging
    before: function(app, server) {
      console.log('🗂️  Starting ThirdEye Development Server');
      console.log(`📡 OpenMetadata Backend: ${devServerTarget}`);
      console.log('🔗 Proxy Routes configured:');
      console.log('   /api/v1/* → ' + devServerTarget + 'api/v1/*');
    }
  }
};

// Environment variables for better development experience
const developmentEnv = {
  OPENMETADATA_BASE_URL: openmetadataBaseUrl,
  DEV_SERVER_TARGET: devServerTarget,
  NODE_ENV: 'development',
  NEXT_PUBLIC_OPENMETADATA_BASE_URL: openmetadataBaseUrl
};

module.exports = {
  devConfig,
  developmentEnv
};
