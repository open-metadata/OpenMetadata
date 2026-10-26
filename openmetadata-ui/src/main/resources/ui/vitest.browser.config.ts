/*
 *  Copyright 2026 Collate.
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

/**
 * POC: UI integration tests (Vitest Browser Mode + MSW).
 *
 * - Runs `*.browser.test.tsx` files in a real Chromium via Playwright.
 * - Reuses the app's own Vite config (aliases, svgr, tailwind, react-swc) so
 *   components render exactly as they do in the product.
 * - No backend: the network is mocked with MSW (see src/test/browser/msw.ts).
 *
 *   yarn test:ui            # headless run
 *   yarn test:ui --ui       # Vitest UI: watch tests + see the rendered page live
 *   yarn test:ui:coverage   # istanbul coverage, merged with Jest's in CI
 */
import { readFileSync } from 'fs';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig, type Plugin } from 'vitest/config';
import appViteConfig from './vite.config';

/** Serve MSW's service worker at the site root without adding it to `public/`. */
const mswServiceWorker = (): Plugin => {
  const workerPath = require.resolve('msw/mockServiceWorker.js', {
    paths: [__dirname],
  });

  return {
    name: 'om-msw-service-worker',
    configureServer(server) {
      server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.end(readFileSync(workerPath));
      });
    },
  };
};

const headless = process.env.HEADED !== 'true';

export default defineConfig(async (env) => {
  const base =
    typeof appViteConfig === 'function'
      ? await appViteConfig({ ...env, mode: 'test' })
      : appViteConfig;

  return mergeConfig(
    {
      ...base,
      // The app server's proxy/HTML transforms are irrelevant under test.
      server: { fs: { strict: false } },
      build: undefined,
    },
    {
      plugins: [mswServiceWorker()],
      optimizeDeps: {
        include: [
          'msw/browser',
          'vite-plugin-node-polyfills/shims/process',
          'vite-plugin-node-polyfills/shims/buffer',
          'vitest-browser-react',
          'react',
          'react-dom',
          'react-dom/client',
          'antd',
          'lodash-es',
        ],
      },
      test: {
        name: 'ui-integration',
        include: ['src/**/*.browser.test.{ts,tsx}'],
        setupFiles: ['src/test/browser/setup.ts'],
        // test:ui:coverage raises this to 30 s: istanbul instrumentation slows
        // every test, and the strict limit belongs to the uninstrumented runs.
        testTimeout: 15_000,
        // Reuse each worker's page across files: the app's module graph loads
        // once per worker instead of once per file (~10 s each). Tests stay
        // independent through setup.ts (unmount, handler reset, URL and
        // localStorage reset); CI's shuffled stability runs guard against
        // order-dependent leaks.
        isolate: false,
        browser: {
          enabled: true,
          headless,
          provider: playwright({
            launchOptions: process.env.PW_CHROMIUM_PATH
              ? { executablePath: process.env.PW_CHROMIUM_PATH }
              : {},
          }),
          instances: [{ browser: 'chromium' }],
          viewport: { width: 1440, height: 900 },
          screenshotFailures: true,
          // Visual regression: baselines live next to the test file.
          expect: {
            toMatchScreenshot: {
              comparatorName: 'pixelmatch',
              comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
            },
          },
        },
        coverage: {
          provider: 'istanbul',
          // One flaky test must not drop the whole lcov from Sonar.
          reportOnFailure: true,
          // Report only files the browser actually loaded. Sonar unions this
          // lcov with Jest's line by line (sonar-project.properties), so the
          // gate sees Jest + UI-integration coverage together.
          exclude: [
            'src/**/*.test.*',
            'src/test/**',
            'src/**/*.mock.*',
            'src/**/mocks/**',
            'src/generated/**',
            'src/@types/**',
            'src/interface/**',
            'src/enums/**',
          ],
          reporter: ['text-summary', 'json', 'json-summary', 'lcov'],
          reportsDirectory: 'src/test/browser/coverage',
        },
      },
    }
  );
});
