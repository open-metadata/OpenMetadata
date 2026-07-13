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
import type { PreRenderedAsset } from 'rollup';
import { defineConfig, loadEnv, type Plugin, type PluginOption } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Vite plugin: capture hashed asset filenames at bundle time and inject
 * <link rel="preload"> tags into index.html so the browser discovers the
 * Inter variable font and the landing-page hero SVG before the JS bundle
 * executes.  `transformIndexHtml: { order: 'post' }` ensures this hook runs
 * after the existing `html-transform` plugin (which adds `${basePath}`
 * prefixes), so we write `${basePath}` directly into the href and let the
 * Java backend replace it at runtime — exactly the same mechanism used for
 * script/link/image tags elsewhere.
 */
const injectCriticalPreloads = (): Plugin => {
  let fontPath = '';
  let heroPath = '';

  return {
    name: 'inject-critical-preloads',
    generateBundle(_opts, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset') {
          continue;
        }
        if (
          file.fileName?.includes('inter-latin-wght-normal') &&
          file.fileName.endsWith('.woff2')
        ) {
          fontPath = file.fileName;
        }
        if (
          file.fileName?.includes('landing-page-header-bg') &&
          file.fileName.endsWith('.svg')
        ) {
          heroPath = file.fileName;
        }
      }
    },
    transformIndexHtml: {
      order: 'post' as const,
      handler(html: string) {
        const tags: string[] = [];
        if (fontPath) {
          tags.push(
            `<link rel="preload" as="font" type="font/woff2" crossorigin href="\${basePath}${fontPath}">`
          );
        }
        if (heroPath) {
          tags.push(
            `<link rel="preload" as="image" fetchpriority="high" href="\${basePath}${heroPath}">`
          );
        }

        return tags.length
          ? html.replace('</head>', `  ${tags.join('\n    ')}\n  </head>`)
          : html;
      },
    },
  };
};

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // rollup-plugin-visualizer is ESM-only; CJS-import would crash Vite's config
  // loader. Dynamic-import only when we actually want it (analyze mode), so the
  // production / dev paths don't pay any cost.
  const visualizerPlugin =
    mode === 'analyze'
      ? [
          (await import('rollup-plugin-visualizer')).visualizer({
            filename: 'dist/bundle-stats.html',
            template: 'treemap',
            gzipSize: true,
            brotliSize: true,
            sourcemap: false,
          }),
          (await import('rollup-plugin-visualizer')).visualizer({
            filename: 'dist/bundle-stats.json',
            template: 'raw-data',
            gzipSize: true,
            brotliSize: true,
            sourcemap: false,
          }),
        ]
      : false;
  const devServerTarget =
    env.VITE_DEV_SERVER_TARGET ||
    env.DEV_SERVER_TARGET ||
    'http://localhost:8585/';

  // Use empty base so dynamic imports use relative paths
  // The actual BASE_PATH is injected at runtime by the Java backend via ${basePath} replacement
  return {
    base: '',
    html: {
      cspNonce: '${cspNonce}', // Placeholder replaced by Java backend at runtime
    },
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
      mode === 'production' && injectCriticalPreloads(),
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
      // Bundle treemap. Active only when invoked as `vite build --mode analyze`
      // (we never want the rollup `gzipSize`/`brotliSize` costs on every production
      // build — they double build time). Writes `dist/bundle-stats.html` plus a JSON
      // sidecar so CI can grep regressions against a baseline.
      visualizerPlugin,
    ].filter(Boolean) as PluginOption[],

    resolve: {
      alias: {
        lodash: 'lodash-es',
        process: 'process/browser',
        Quill: path.resolve(__dirname, 'node_modules/quill'),
        '@': path.resolve(__dirname, 'src'),
        '~antd': path.resolve(__dirname, 'node_modules/antd'),
        antd: path.resolve(__dirname, 'node_modules/antd'),
        '@deuex-solutions/react-tour': path.resolve(
          __dirname,
          'node_modules/@deuex-solutions/react-tour/dist/reacttour.min.js'
        ),
        // Luxon ships both an ESM (build/es6/luxon.mjs) and a CJS (build/node/luxon.js)
        // entry. Without this alias, transitive deps that `require('luxon')` (via the
        // CJS path) and our own ESM `import { DateTime } from 'luxon'` end up pulling
        // in BOTH builds — visualizer shows 466 KB of luxon in the bundle. Forcing
        // every resolution through the ESM entry deduplicates.
        luxon: path.resolve(
          __dirname,
          'node_modules/luxon/build/es6/luxon.mjs'
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

    preview: {
      port: 3000,
      proxy: {
        '/api/': {
          target: devServerTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      copyPublicDir: true,
      sourcemap: false,
      // Modern browsers only. Antd 5 / React 18 / Vite 7 already need at least
      // these versions; declaring the target lets esbuild emit native async/await,
      // optional chaining, nullish coalescing, and top-level await — no
      // polyfills, no transpilation overhead. Matches Linear's "no ES5" decision
      // (see Linear's bundler-arc blog post). Bundle is typically 5-10% smaller
      // and the same browsers we already require keep working.
      target: ['chrome93', 'edge93', 'firefox91', 'safari16'],
      minify: mode === 'production' ? 'esbuild' : false,
      cssMinify: 'esbuild',
      cssCodeSplit: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      // Vite auto-emits <link rel="modulepreload"> for the entry chunk's
      // sync-imported sibling chunks. Keep that behaviour, but drop the polyfill
      // — OpenMetadata's React 18 / Antd 5 / Vite 7 toolchain already targets
      // modern browsers that support modulepreload natively (Chrome 66+, Edge
      // 79+, Safari 17+, Firefox 115+). The polyfill is a small JS shim plus
      // one extra script request; on a fast first-paint path even small wins
      // count, and we're not the right project to be carrying it.
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          assetFileNames: (assetInfo: PreRenderedAsset) => {
            const names = assetInfo.names ?? [];
            const fileName = names.length > 0 ? names[0] : '';
            const ext = fileName ? path.extname(fileName).toLowerCase() : '';

            if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(ext)) {
              return `images/[name]-[hash][extname]`;
            }

            return `assets/[name]-[hash][extname]`;
          },
          manualChunks: (id: string) => {
            if (!id.includes('node_modules')) {
              return;
            }
            // Antd remains its own vendor chunk — almost every route touches some
            // part of it, so the cache-sharing argument holds. Tree-shaking inside
            // a single chunk keeps the unused subtrees out anyway.
            if (id.includes('antd')) {
              return 'vendor-antd';
            }
            if (id.includes('@openmetadata/ui-core-components')) {
              return 'vendor-untitled';
            }
            if (id.includes('@untitledui/icons')) {
              return 'vendor-untitled-icons';
            }
            // Heavy specialists — each used by a small number of routes. Naming
            // them explicitly stops Rollup from co-locating them in a giant shared
            // chunk (the prior bundle showed an 8.7 MB chunk containing all of
            // these mixed together). Each becomes its own ~100-300 KB chunk that
            // routes lazy-load via React.lazy boundaries.
            if (id.includes('node_modules/elkjs')) {
              return 'vendor-elkjs'; // graph layout, used only by lineage views
            }
            if (id.includes('node_modules/@reactflow')) {
              return 'vendor-reactflow'; // lineage canvas
            }
            if (
              id.includes('node_modules/prosemirror') ||
              id.includes('node_modules/@tiptap')
            ) {
              return 'vendor-prosemirror'; // rich text editor (description editing)
            }
            if (
              id.includes('node_modules/codemirror') ||
              id.includes('node_modules/@codemirror')
            ) {
              return 'vendor-codemirror'; // SQL / query editor
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts'; // data insights charts
            }
            if (id.includes('node_modules/react-latex-next')) {
              return 'vendor-latex'; // LaTeX rendering in markdown
            }
            if (id.includes('node_modules/@melloware/react-logviewer')) {
              return 'vendor-logviewer'; // ingestion log viewer
            }
            if (id.includes('node_modules/showdown')) {
              return 'vendor-showdown'; // markdown -> HTML in legacy paths
            }
            if (
              id.includes('node_modules/quill') ||
              id.includes('node_modules/@windmillcode/quill-emoji')
            ) {
              return 'vendor-quill'; // (alternative editor surface)
            }
            if (id.includes('node_modules/dompurify')) {
              return 'vendor-dompurify'; // HTML sanitizer
            }
            if (id.includes('node_modules/react-data-grid')) {
              return 'vendor-datagrid'; // wide-table view
            }
            if (id.includes('node_modules/luxon')) {
              return 'vendor-luxon'; // date library
            }
            if (id.includes('node_modules/js-yaml')) {
              return 'vendor-yaml';
            }
            // Linear-style per-package chunking, but with a twist: scoped packages
            // get grouped by SCOPE (e.g. every @analytics/foo lands in
            // vendor-analytics, every @react-aria/foo lands in vendor-react-aria).
            // That's a coarser split than strict per-package but still wins on the
            // cache invalidation story — bumping ONE @analytics package invalidates
            // ONE chunk, not the whole vendor graph. The reason for grouping by
            // scope: many scopes ship dozens of micro-packages (@analytics has 8+,
            // @react-aria has 30+), and giving each a 2-3 KB chunk means a
            // long tail of HTTP requests that hurts more than the granular cache
            // wins. Unscoped packages still get their own chunk.
            //
            // For specialist scopes that are already explicitly named above
            // (@reactflow, @tiptap, @codemirror, @melloware), the explicit rule
            // wins and this generic regex never reaches them.
            const scopedMatch = id.match(/node_modules[\\/](@[^\\/]+)[\\/]/);
            if (scopedMatch) {
              const scope = scopedMatch[1].replace('@', '');
              return `vendor-${scope}`;
            }
            const unscopedMatch = id.match(/node_modules[\\/]([^\\/]+)/);
            if (unscopedMatch) {
              return `vendor-${unscopedMatch[1]}`;
            }
          },
          // Merge any chunk smaller than this back into its primary importer. Keeps
          // the per-package split sane for big packages while preventing the long
          // tail of ~1 KB utility packages from each becoming their own HTTP
          // request. 10 KB is a balance — small enough that lodash / dayjs /
          // classnames stay separable, large enough that 200 tiny packages don't
          // each get a network roundtrip.
          experimentalMinChunkSize: 10 * 1024,
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
      'process.env.BRAND_NAME': JSON.stringify(
        env.BRAND_NAME || 'OpenMetadata'
      ),
      global: 'globalThis',
    },
  };
});
