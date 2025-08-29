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

import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

// Helper to check if a path should be served as index.html for SPA routing
const shouldServeSPA = (url: string, accept = ''): boolean => {
  const [pathname] = url.split('?');

  // Skip non-GET or paths that should be handled normally
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/')
  ) {
    return false;
  }

  // List of known static file extensions
  const staticExtensions = [
    '.js',
    '.mjs',
    '.ts',
    '.tsx',
    '.jsx',
    '.css',
    '.less',
    '.scss',
    '.sass',
    '.json',
    '.xml',
    '.yaml',
    '.yml',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.webp',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
    '.mp4',
    '.webm',
    '.mp3',
    '.wav',
    '.pdf',
    '.zip',
    '.tar',
    '.gz',
    '.map',
  ];

  // Check if pathname ends with a known static file extension
  const hasStaticExtension = staticExtensions.some((ext) =>
    pathname.toLowerCase().endsWith(ext)
  );

  if (hasStaticExtension) {
    return false;
  }

  // Must be an HTML request
  return (
    accept.includes('text/html') || accept.includes('application/xhtml+xml')
  );
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devServerTarget =
    env.VITE_DEV_SERVER_TARGET ||
    env.DEV_SERVER_TARGET ||
    'http://localhost:8585/';

  // Dynamically set base path from environment variable or use '/' as default
  const basePath = env.BASE_PATH || '/';

  return {
    base: basePath,
    appType: 'spa', // Explicitly set as SPA
    plugins: [
      {
        name: 'html-transform',
        transformIndexHtml(html: string) {
          // Replace ${basePath} in all places with the actual base path
          let transformed = html.replace(/\$\{basePath\}/g, basePath);

          // In development, ensure base tag uses root path
          if (mode === 'development') {
            transformed = transformed.replace(
              '<base href="/" />',
              '<base href="/" />'
            );
          }

          return transformed;
        },
      },
      {
        name: 'spa-fallback',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (
              req.method === 'GET' &&
              shouldServeSPA(req.url || '', req.headers.accept || '')
            ) {
              try {
                let template = await fs.promises.readFile(
                  path.resolve(__dirname, 'index.html'),
                  'utf-8'
                );
                template = await server.transformIndexHtml(req.url!, template);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html');
                res.end(template);

                return;
              } catch (e) {
                server.ssrFixStacktrace(e as Error);
                next(e);
              }
            }
            next();
          });
        },
        configurePreviewServer(server) {
          return () => {
            server.middlewares.use((req, res, next) => {
              if (
                req.method === 'GET' &&
                shouldServeSPA(req.url || '', req.headers.accept || '')
              ) {
                req.url = '/index.html';
              }
              next();
            });
          };
        },
      },
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
    },

    css: {
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
          rewriteUrls: 'all',
        },
      },
    },

    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: devServerTarget,
          changeOrigin: true,
        },
      },
    },

    preview: {
      port: 3000,
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      copyPublicDir: true,
      sourcemap: false,
      minify: mode === 'production' ? 'terser' : false,
      // Ensure assets use absolute paths
      assetsInlineLimit: 0,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'antd-vendor': ['antd', '@ant-design/icons'],
            'editor-vendor': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-link',
            ],
            'chart-vendor': ['recharts', 'reactflow'],
          },
          assetFileNames: (assetInfo) => {
            const fileName = assetInfo.name || '';
            const info = fileName.split('.');
            const ext = info[info.length - 1];

            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `images/[name]-[hash][extname]`;
            }

            return `assets/[name]-[hash][extname]`;
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
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      global: 'globalThis',
    },
  };
});
