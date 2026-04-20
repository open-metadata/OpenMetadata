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

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerTarget =
    env.VITE_DEV_SERVER_TARGET ||
    env.DEV_SERVER_TARGET ||
    'http://localhost:8585/';

  // Use empty base so dynamic imports use relative paths
  // The actual BASE_PATH is injected at runtime by the Java backend via ${basePath} replacement
  return {
    base: '',
    plugins: [
      {
        name: 'html-transform',
        transformIndexHtml(html: string) {
          // Don't replace ${basePath} placeholder - it will be replaced at runtime by Java backend
          // Add ${basePath} prefix to asset paths (with or without leading slash)
          return html
            .replaceAll(
              /(<script[^>]*src=["'])(\.\/)?assets\//g,
              '$1${basePath}assets/'
            )
            .replaceAll(
              /(<link[^>]*href=["'])(\.\/)?assets\//g,
              '$1${basePath}assets/'
            )
            .replaceAll(
              /(<img[^>]*src=["'])(\.\/)?assets\//g,
              '$1${basePath}assets/'
            )
            .replaceAll(
              /(<img[^>]*src=["'])(\.\/)?images\//g,
              '$1${basePath}images/'
            );
        },
      },
      tailwindcss(),
      react(),
      svgr(),
      tsconfigPaths(),
      nodePolyfills({
        include: ['process', 'buffer'],
        globals: {
          process: true,
          Buffer: true,
        },
      }),
      mode === 'production' &&
        viteCompression({
          algorithm: 'gzip',
          ext: '.gz',
          threshold: 1024, // Only compress files larger than 1KB
          deleteOriginFile: false, // Keep original files for fallback
          // Skip binary formats that are already compressed — re-compressing
          // them wastes build CPU and saves zero bytes.
          filter: /\.(js|mjs|css|html|svg|json|wasm)(\?.*)?$/i,
        }),
      mode === 'production' &&
        viteCompression({
          algorithm: 'brotliCompress',
          ext: '.br',
          threshold: 1024, // Only compress files larger than 1KB
          deleteOriginFile: false, // Keep original files for fallback
          // Same exclusion list — woff2 is already brotli-compressed internally.
          filter: /\.(js|mjs|css|html|svg|json|wasm)(\?.*)?$/i,
        }),
    ].filter(Boolean),

    resolve: {
      alias: {
        process: 'process/browser',
        Quill: path.resolve(__dirname, 'node_modules/quill'),
        '@': path.resolve(__dirname, 'src'),
        '~antd': path.resolve(__dirname, 'node_modules/antd'),
        antd: path.resolve(__dirname, 'node_modules/antd'),
        '@deuex-solutions/react-tour': path.resolve(
          __dirname,
          'node_modules/@deuex-solutions/react-tour/dist/reacttour.min.js'
        ),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.svg'],
      dedupe: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/system',
        '@emotion/react',
        '@emotion/styled',
        'react-aria',
        'react-aria-components',
        'react-stately',
        '@untitledui/icons',
        '@internationalized/date',
        '@react-aria/utils',
        '@react-stately/utils',
        '@react-types/shared',
        'tailwind-merge',
        'react-hook-form',
      ],
    },

    css: {
      preprocessorMaxWorkers: 1, // Disable parallel Less processing to avoid race conditions in CI
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
          modifyVars: {},
          math: 'always',
          paths: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, 'src'),
            path.resolve(__dirname, 'src/styles'),
          ],
        },
      },
    },

    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api/': {
          target: devServerTarget,
          changeOrigin: true,
          ws: true,
        },
      },
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/dist/**',
          '**/playwright/**',
          // Ignore test-related files so changes to them don't trigger HMR
          '**/*.test.*',
          '**/*.spec.*',
          '**/*.cy.*',
          '**/__tests__/**',
          '**/*.mock.*',
        ],
      },
      fs: {
        strict: false,
      },
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      copyPublicDir: true,
      sourcemap: false,
      minify: mode === 'production' ? 'esbuild' : false,
      cssMinify: 'esbuild',
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo) => {
            const names = assetInfo.names ?? [];
            const fileName = names.length > 0 ? names[0] : '';
            const ext = fileName ? path.extname(fileName).toLowerCase() : '';

            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(ext)) {
              return `images/[name]-[hash][extname]`;
            }

            return `assets/[name]-[hash][extname]`;
          },
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('antd')) {
                return 'vendor-antd';
              }
              if (id.includes('@openmetadata/ui-core-components')) {
                return 'vendor-untitled';
              }
              if (id.includes('@untitledui/icons')) {
                return 'vendor-untitled-icons';
              }
            }
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        'antlr4',
        '@azure/msal-browser',
        '@azure/msal-react',
        'codemirror',
        '@deuex-solutions/react-tour',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },

    cacheDir: 'node_modules/.vite',

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      global: 'globalThis',
    },
  };
});
