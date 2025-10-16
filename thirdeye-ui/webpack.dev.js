/*
 * ThirdEye UI Development Configuration
 * Similar to OpenMetadata webpack configuration but for Next.js
 */

const path = require('path');

// Development server configuration
const outputPath = path.join(__dirname, '.next');
const devServerTarget = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
const openmetadataBaseUrl = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';

module.exports = {
  mode: 'development',
  
  // Development proxy configuration (similar to OpenMetadata webpack setup)
  devServer: {
    port: 3000,
    open: true,
    hot: true,
    compress: true,
    
    // Route all requests to the development server history API
    historyApiFallback: {
      disableDotRule: true,
    },
    
    static: {
      directory: outputPath,
    },
    
    // Proxy configuration - mirrors OpenMetadata webpack proxy setup
    proxy: [
      {
        context: ['/api/', '/api/v1/'],
        target: devServerTarget,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
        onProxyReq: function (proxyReq, req, res) {
          console.log(`🔄 Proxying ${req.method} ${req.url} → ${devServerTarget}`);
          
          // Set proper headers for development
          proxyReq.setHeader('X-Forwarded-Proto', 'http');
          proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
          proxyReq.setHeader('X-Original-Origin', req.headers.origin || req.headers.host);
        },
        onProxyRes: function (proxyRes, req, res) {
          // Add CORS headers for frontend development
          proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
          proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        }
      },
      {
        context: ['/health'],
        target: openmetadataBaseUrl,
        changeOrigin: true,
        secure: false,
        logLevel: 'debug',
      }
    ],
    
    // Development server startup logging
    setupMiddlewares: (middlewares, devServer) => {
      console.log('🚀 ThirdEye Development Server Starting...');
      console.log(`📡 OpenMetadata Backend: ${devServerTarget}`);
      console.log(`🔗 Proxy configured for /api/v1/*`);
      console.log('🎯 Available Routes:');
      console.log('   localhost:3000/api/v1/* → ' + devServerTarget + 'api/v1/*');
      console.log('   localhost:3000/health   → ' + openmetadataBaseUrl + '/health');
      console.log('');
      console.log('💡 Ensure OpenMetadata backend is running on', devServerTarget);
      
      return middlewares;
    }
  },

  // Resolve configuration for development
  resolve: {
    fallback: {
      https: false,
      http: false,
      zlib: false,
      path: false,
      fs: false,
    },
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@/*': path.resolve(__dirname, 'src'),
    }
  },

  // Development optimizations
  optimization: {
    splitChunks: false, // Disable for development
    minimize: false,
  },

  output: {
    path: outputPath,
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
    clean: true,
    publicPath: '/',
  },

  // Development source maps
  devtool: 'eval-cheap-module-source-map',

  // Performance optimization
  performance: {
    hints: false,
  }
};
