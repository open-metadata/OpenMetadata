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
  const isPlaywrightBundle = env.PW_E2E_BUNDLE === 'true';
  const isPlaywrightBuild = env.PW_E2E_BUILD === 'true' || isPlaywrightBundle;

  // Use empty base so dynamic imports use relative paths
  // The actual BASE_PATH is injected at runtime by the Java backend via ${basePath} replacement
  return {
    base: '',
    html: {
      cspNonce: '${cspNonce}', // Placeholder replaced by Java backend at runtime
    },
    plugins: [
      // Rewrites `import { Home02, User01 } from '@untitledui/icons'` (a barrel
      // import that forces Rollup to visit ~1,200 icon files during transform)
      // into per-icon deep imports. sideEffects: false in the package, so this
      // is behaviour-preserving; the icons library ships one .mjs per icon.
      // Measured: ~1,000 fewer transforms → ~35 s off vite build on M-series,
      // more on 2-core Actions runners. Kept minimal on purpose; other barrel
      // packages (@ant-design/icons, lodash, react-aria) did not move the
      // needle in the same experiment because their code paths default-import
      // or transitively re-import the barrel from antd internals.
      {
        name: 'barrel-optimize-untitled-icons',
        enforce: 'pre' as const,
        transform(code: string, id: string) {
          if (!/\.(tsx?|jsx?)$/.test(id.split('?')[0])) return null;
          if (!code.includes('@untitledui/icons')) return null;
          const out = code.replace(
            /import\s*\{([^}]+)\}\s*from\s*['"]@untitledui\/icons['"];?/g,
            (_m, names: string) =>
              names
                .split(',')
                .map((n) => n.trim())
                .filter(Boolean)
                .map((spec) => {
                  const [orig] = spec.split(/\s+as\s+/);
                  return `import { ${spec} } from '@untitledui/icons/${orig.trim()}';`;
                })
                .join('\n')
          );
          return out === code ? null : { code: out, map: null };
        },
      },
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
        !isPlaywrightBundle &&
        viteCompression({
          algorithm: 'brotliCompress',
          ext: '.br',
          // Keep deployed artifacts and the Brotli bundle budget on one compression path.
          threshold: 0,
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
      // Resolve dependencies through their node_modules-relative path rather
      // than following symlinks out of the project root. Two setups need this:
      // (1) `@openmetadata/ui-core-components` is a yarn `link:` — preserving
      // symlinks makes it resolve React (and other peers) from THIS app's
      // node_modules, not a second copy under the linked source; (2) worktree
      // dev setups where `node_modules` itself is symlinked (e.g. Conductor)
      // otherwise serve deps like `react-hook-form` raw via `@fs` outside root,
      // giving them a second React instance → "Invalid hook call" on mount.
      preserveSymlinks: true,
      dedupe: [
        'react',
        'react-dom',
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
        // i18next must share a single instance so initCoreI18n (called from
        // index.tsx on the app's i18next) registers the `core` namespace that
        // useCoreTranslation (in @openmetadata/ui-core-components) can read.
        // Without dedup, the linked package resolves its own node_modules copy.
        'i18next',
        'react-i18next',
      ],
    },

    css: {
      preprocessorMaxWorkers: true,
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
      cssCodeSplit: !isPlaywrightBundle,
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
        onwarn(warning, warn) {
          if (isPlaywrightBundle && warning.code === 'CIRCULAR_CHUNK') {
            throw new Error(warning.message);
          }
          warn(warning);
        },
        output: {
          entryFileNames: isPlaywrightBuild
            ? 'assets/app-entry-[hash].js'
            : 'assets/[name]-[hash].js',
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
            const normalizedId = id.split('?')[0].replaceAll('\\', '/');

            if (isPlaywrightBundle) {
              // Keep every connector schema independently lazy so the minimum
              // chunk-size pass cannot attach shared shell code and preload the
              // full connector catalog during an authenticated app boot.
              if (normalizedId.includes('/src/jsons/connectionSchemas/')) {
                const schemaPath = normalizedId.split(
                  '/src/jsons/connectionSchemas/'
                )[1];

                return `app-e2e-schema-${schemaPath
                  .replace(/\.json$/, '')
                  .replaceAll(/[^a-zA-Z0-9_-]/g, '-')}`;
              }
              if (
                normalizedId.includes('/src/components/MyData/') ||
                normalizedId.includes('/src/pages/MyDataPage/') ||
                normalizedId.includes('/src/components/KnowledgeCenter/') ||
                normalizedId.includes('/src/utils/LandingPageWidget/') ||
                /\/src\/utils\/(?:CustomizeMyDataPage|CustomizableLandingPage|DataAssetService|LandingPageWidgetIconUtils)/.test(
                  normalizedId
                )
              ) {
                return 'app-e2e-runtime';
              }
            }

            if (!normalizedId.includes('/node_modules/')) {
              return;
            }
            if (isPlaywrightBundle) {
              if (
                id.includes('node_modules/elkjs') ||
                id.includes('node_modules/@reactflow') ||
                id.includes('node_modules/reactflow')
              ) {
                return 'vendor-e2e-lineage';
              }
              const packagePath = id.split(/node_modules[\\/]/).pop() ?? id;
              const [scopeOrName, scopedName] = packagePath.split(/[\\/]/);
              const packageName = scopeOrName.startsWith('@')
                ? `${scopeOrName}/${scopedName}`
                : scopeOrName;

              return ['react', 'react-dom', 'scheduler'].includes(packageName)
                ? 'vendor-e2e-framework'
                : 'app-e2e-runtime';
            }
            const packagePath =
              normalizedId.split('/node_modules/').pop() ?? normalizedId;
            const [scopeOrName, scopedName] = packagePath.split('/');
            const packageName = scopeOrName.startsWith('@')
              ? `${scopeOrName}/${scopedName}`
              : scopeOrName;

            if (
              ['react', 'react-dom', 'scheduler'].includes(packageName) ||
              packageName.startsWith('react-router')
            ) {
              return 'vendor-react';
            }

            if (
              packageName.startsWith('@react-aria/') ||
              packageName.startsWith('@react-stately/') ||
              packageName.startsWith('@react-types/') ||
              packageName === 'react-aria' ||
              packageName === 'react-aria-components' ||
              packageName === 'react-stately'
            ) {
              return 'vendor-aria';
            }

            // Antd and the core component library are shared by nearly every
            // route, so stable cache buckets pay off. Route-specific dependencies
            // are left to Rollup so they stay behind their dynamic import.
            if (normalizedId.includes('/node_modules/antd/')) {
              return 'vendor-antd';
            }
            if (
              normalizedId.includes(
                '/node_modules/@openmetadata/ui-core-components/'
              )
            ) {
              return 'vendor-untitled';
            }
            if (normalizedId.includes('/node_modules/@untitledui/icons/')) {
              return 'vendor-untitled-icons';
            }

            return;
          },
          // Production merges application chunks below 50 KiB so route-level
          // boundaries remain useful without turning shared helpers into hundreds
          // of network round trips. The CI-only coarse bundle keeps its separately
          // measured threshold and explicit runtime/schema buckets.
          experimentalMinChunkSize: isPlaywrightBundle ? 32 * 1024 : 50 * 1024,
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
        // Force-prebundle react-hook-form so it shares the single optimized
        // React instance. Through a symlinked node_modules (worktree/linked
        // dev setups) Vite otherwise serves it raw via `@fs`, pulling a second
        // React copy — an "Invalid hook call" (`useRef` of null) in every RHF
        // form. `dedupe` alone does not cover the dev pre-bundle path.
        'react-hook-form',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },

    cacheDir: 'node_modules/.vite',

    define: {
      'import.meta.env.PW_E2E_BUILD': JSON.stringify(isPlaywrightBuild),
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.BRAND_NAME': JSON.stringify(
        env.BRAND_NAME || 'OpenMetadata'
      ),
      global: 'globalThis',
    },
  };
});
