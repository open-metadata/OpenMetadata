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
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import type { PreRenderedAsset } from 'rollup';
import { defineConfig, loadEnv, type PluginOption } from 'vite';
import viteCompression from 'vite-plugin-compression';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';
import tsconfigPaths from 'vite-tsconfig-paths';
import { createChunkClassifier } from './vite/chunks';
import {
  barrelOptimizeUntitledIcons,
  htmlBasePathTransform,
  injectCriticalPreloads,
  noEnumOnlyChunks,
} from './vite/plugins';

export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // `analyze` must emit the same bundle as `production` (minified, React prod
  // build), otherwise the treemap reports sizes nobody ships.
  const isProductionBundle = mode === 'production' || mode === 'analyze';

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
  const classifyChunk = createChunkClassifier({ isPlaywrightBundle });

  // Use empty base so dynamic imports use relative paths
  // The actual BASE_PATH is injected at runtime by the Java backend via ${basePath} replacement
  return {
    base: '',
    html: {
      cspNonce: '${cspNonce}', // Placeholder replaced by Java backend at runtime
    },
    plugins: [
      barrelOptimizeUntitledIcons(),
      isProductionBundle && !isPlaywrightBundle && noEnumOnlyChunks(),
      htmlBasePathTransform(),
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
      isProductionBundle && injectCriticalPreloads(),
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
      // Brotli generation moved out of the Vite pipeline. Running gzip + brotli
      // back-to-back in Rollup's writeBundle serialized 1-3 minutes of CPU on
      // every production build (700+ chunks, brotli quality-11 by default). The
      // deployed server/CDN handles brotli content-encoding on the fly; if a
      // pre-compressed .br artifact is ever required, generate it in a parallel
      // post-step (worker pool over zlib.brotliCompressSync) rather than inside
      // Rollup.
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
      // Less intermittently crashes on shared imports in Vite's worker pool.
      // Compile in-process so that valid stylesheets build deterministically.
      preprocessorMaxWorkers: 0,
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
      minify: isProductionBundle ? 'esbuild' : false,
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
        // `/silent-callback` renders a dedicated HTML entry so its
        // dependency graph is exactly `oidc-client` + the tiny
        // `silentCallbackEntry.ts` — no React, no antd, none of the
        // shared app-utils that Rollup's `experimentalMinChunkSize`
        // merger was folding into the small SPA entry (which pulled
        // `vendor-antd` in as a `<link rel=modulepreload>` sibling and
        // broke scenario 7 of SsoScenarios.spec). Playwright's coarse
        // E2E build keeps a single entry — the merged
        // `app-e2e-runtime`/`vendor-e2e-framework` layout depends on it
        // (a second entry produces `Circular chunk: vendor-e2e-framework
        // -> app-e2e-runtime -> vendor-e2e-framework`). We spread the
        // multi-input record in only when the coarse-bundle mode is off;
        // even an explicit `input: undefined` triggers Vite's default
        // multi-page discovery of every root `.html`, which reintroduces
        // the second entry we mean to avoid.
        ...(isPlaywrightBundle
          ? {}
          : {
              input: {
                main: path.resolve(__dirname, 'index.html'),
                silentCallback: path.resolve(__dirname, 'silent-callback.html'),
              },
            }),
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
          // Same classifier used by both Rollup (`manualChunks`) and Rolldown
          // (`advancedChunks.groups[].name`) so the two bundlers land on the
          // same vendor buckets. Rolldown ignores `manualChunks` when
          // `advancedChunks` is present, and Rollup ignores `advancedChunks`,
          // so this is a symmetric fallback — swapping bundler is one line
          // in package.json.
          manualChunks: classifyChunk,
          // Production merges application chunks below 50 KiB so route-level
          // boundaries remain useful without turning shared helpers into hundreds
          // of network round trips. Do NOT raise this without measuring — the
          // Rollup merger cost is roughly quadratic in the candidate count, and
          // a 120 KiB threshold left ~1770 chunks needing merge (multi-minute
          // hang between transform and emit). The vendor-* buckets above
          // already do the heavy consolidation.
          experimentalMinChunkSize: isPlaywrightBundle ? 32 * 1024 : 50 * 1024,
          // Rolldown-native equivalent. Rollup ignores this option. Reuses the
          // same classifier so vendor buckets are consistent across bundlers.
          // `minSize` is Rolldown's replacement for `experimentalMinChunkSize`
          // (only applies to captured groups; auto-split chunks are unaffected).
          advancedChunks: {
            minSize: isPlaywrightBundle ? 32 * 1024 : 50 * 1024,
            groups: [
              // Vendor buckets via the shared classifier. Attempts to add
              // further `app-shared` groups (`minShareCount:2` or `:3` with
              // various `maxModuleSize` guards) consistently pushed the entry
              // bootstrap over the 970 KiB brotli budget — Rolldown's
              // `minShareCount` counts shell references too, so any group
              // that captures a shell-imported module gets promoted onto the
              // entry graph even if 90 % of its captured modules are
              // lazy-only. Rolldown has no equivalent of Rollup's
              // `experimentalMinChunkSize` merger for auto-split chunks; the
              // right next step is app-level (fewer `React.lazy` boundaries
              // around tiny modules, move shell-imported icons into a lazy
              // group). We stay with just the vendor classifier and accept
              // ~1200 route-lazy chunks (mostly 1-20 KiB, HTTP/2-friendly).
              { name: classifyChunk },
            ],
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        'antlr4',
        '@azure/msal-browser',
        '@azure/msal-react',
        '@deuex-solutions/react-tour',
        // Force-prebundle react-hook-form so it shares the single optimized
        // React instance. Through a symlinked node_modules (worktree/linked
        // dev setups) Vite otherwise serves it raw via `@fs`, pulling a second
        // React copy — an "Invalid hook call" (`useRef` of null) in every RHF
        // form. `dedupe` alone does not cover the dev pre-bundle path.
        'react-hook-form',
        // Same reason as the `dedupe` entries: the dev pre-bundle path must
        // not hand the linked library a second i18next.
        'i18next',
        'react-i18next',
      ],
      esbuildOptions: {
        target: 'esnext',
      },
    },

    cacheDir: 'node_modules/.vite',

    define: {
      'import.meta.env.PW_E2E_BUILD': JSON.stringify(isPlaywrightBuild),
      'process.env.NODE_ENV': JSON.stringify(
        isProductionBundle ? 'production' : mode
      ),
      'process.env.BRAND_NAME': JSON.stringify(
        env.BRAND_NAME || 'OpenMetadata'
      ),
      global: 'globalThis',
    },
  };
});
