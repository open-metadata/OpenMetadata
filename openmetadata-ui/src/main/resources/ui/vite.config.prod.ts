/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import svgr from '@svgr/rollup';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { createHtmlPlugin } from 'vite-plugin-html';

// Production-specific Vite configuration
export default defineConfig({
  // Define entry point (optional, but good for clarity)
  root: '.',

  plugins: [
    react(),

    // Handle SVG as React components
    svgr({
      exportType: 'default',
      ref: true,
      svgo: false,
      titleProp: true,
      include: '**/*.svg',
    }),

    // HTML processing with basePath template variable
    createHtmlPlugin({
      inject: {
        data: {
          basePath: '${basePath}',
        },
      },
      template: 'public/index.html',
    }),

    // Note: Vite automatically serves files from public/ directory
    // No need for explicit copying - files in public/ are served at root
  ],

  // Build configuration for production
  build: {
    outDir: 'dist/assets',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: [
            'react',
            'react-dom',
            'react-router-dom',
            'lodash',
            'antd',
            'axios',
          ],
          // Split large libraries into separate chunks
          ui: ['@ant-design/icons', 'classnames'],
          utils: ['fast-json-patch', 'luxon', 'qs'],
        },
        // Use content hashing for cache busting
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash].[ext]',
      },
    },
    // Performance optimizations
    target: 'es2015',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    // Terser options for better minification
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },

  // Module resolution
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.svg'],
    alias: {
      // Node.js polyfills
      https: 'https-browserify',
      process: 'process/browser',
      // Custom aliases
      Quill: resolve(__dirname, 'node_modules/quill'),
      // Src alias for cleaner imports
      '@': resolve(__dirname, 'src'),
    },
  },

  // CSS configuration
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },

  // Define global constants
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': '"production"',
  },

  // Optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lodash',
      'antd',
      'axios',
      'https-browserify',
      'process/browser',
    ],
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
  },

  // Environment variables
  envPrefix: ['VITE_', 'NODE_ENV'],
});
