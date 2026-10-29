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
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
import { buildSync } from 'esbuild';
import { readFileSync } from 'fs';
import path from 'path';
import controlScenarios from '../../fixtures/visual/control-scenarios.json';
import { expect, test as base } from '../../support/fixtures/base';
import {
  FIXED_DATE,
  SCREENSHOT_OPTS,
  VISUAL_THEMES,
} from '../../utils/visualRegression';

const test = base.extend<
  object,
  { controlAssets: { script: string; css: string } }
>({
  controlAssets: [
    async ({ browserName }, use) => {
      expect(
        browserName,
        'Component baselines use the visual project’s Chromium renderer'
      ).toBe('chromium');
      const script = buildSync({
        entryPoints: [path.resolve('playwright/fixtures/visual/controls.tsx')],
        bundle: true,
        write: false,
        format: 'iife',
        preserveSymlinks: true,
        nodePaths: [path.resolve('node_modules')],
        // The linked library has its own development peers. Match Vite's
        // deduplication or its hooks use a different React from createRoot.
        alias: {
          // Test shards restore the application bundle, not the library's dist.
          // Bundle the same checked-in components without requiring a second build.
          '@openmetadata/ui-core-components': path.resolve(
            '../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/index.ts'
          ),
          ...Object.fromEntries(
            [
              'react',
              'react-dom',
              'react-i18next',
              'i18next',
              'react-aria',
              'react-aria-components',
              'react-stately',
              '@react-aria/utils',
              '@react-stately/utils',
              '@react-types/shared',
              '@internationalized/date',
              'tailwind-merge',
            ].map((name) => [name, path.resolve('node_modules', name)])
          ),
        },
        define: { 'process.env.NODE_ENV': '"production"' },
      }).outputFiles[0].text;
      // Compile the application's real token/utility stylesheet and scan the
      // library source too: its classes live outside the application's @source.
      const compiler = await compile(
        readFileSync('src/styles/tailwind.css', 'utf8'),
        {
          base: path.resolve('src/styles'),
          onDependency: () => undefined,
        }
      );
      const scanner = new Scanner({
        sources: [
          ...compiler.sources,
          {
            base: path.resolve(
              '../../../../../openmetadata-ui-core-components/src/main/resources/ui/src'
            ),
            pattern: '**/*.{tsx,ts}',
            negated: false,
          },
          {
            base: path.resolve('playwright/fixtures/visual'),
            pattern: '**/*.{tsx,ts}',
            negated: false,
          },
        ],
      });
      const font = readFileSync(
        require.resolve(
          '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
        )
      ).toString('base64');
      const css = `${compiler.build(scanner.scan())}
      @font-face { font-family: Inter; font-weight: 100 900; src: url(data:font/woff2;base64,${font}) format('woff2'); }
      body { font-family: Inter, sans-serif; }
    `;
      await use({ script, css });
    },
    { scope: 'worker' },
  ],
});

test.use({ storageState: { cookies: [], origins: [] } });

for (const theme of VISUAL_THEMES) {
  test.describe(`Shared controls ${theme}`, { tag: '@Platform' }, () => {
    for (const scenario of controlScenarios) {
      test(scenario, async ({ page, controlAssets }) => {
        await page.clock.setFixedTime(FIXED_DATE);
        await page.setViewportSize({ width: 1000, height: 700 });
        await page.route('**/__visual_controls__', (route) =>
          route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><html class="${
              theme === 'dark' ? 'dark-mode' : ''
            }"><head><title>Metadata controls</title></head><body class="tw:bg-primary"><div id="root" data-scenario="${scenario}"></div></body></html>`,
          })
        );
        await page.goto('/__visual_controls__', {
          waitUntil: 'domcontentloaded',
        });
        await page.addStyleTag({ content: controlAssets.css });
        await page.addScriptTag({ content: controlAssets.script });
        await expect(page.getByTestId('visual-control')).toBeVisible();

        if (['autocomplete-open', 'autocomplete-empty'].includes(scenario)) {
          await page.getByRole('combobox').click();
          await page.getByRole('combobox').press('ArrowDown');
          await expect(page.getByRole('listbox')).toBeVisible();
        }
        if (['tree-open', 'filter-open', 'filter-empty'].includes(scenario)) {
          await page.getByTestId('control-trigger').click();
          if (scenario === 'filter-empty') {
            await expect(
              page.getByText('No data found', { exact: true })
            ).toBeVisible();
          } else {
            await expect(
              page.getByRole(scenario === 'tree-open' ? 'treegrid' : 'menu')
            ).toBeVisible();
          }
        }
        if (['date-open', 'range-open'].includes(scenario)) {
          await page.getByTestId('visual-control').getByRole('button').click();
          await expect(page.getByRole('dialog')).toBeVisible();
        }
        if (scenario === 'breadcrumbs-open') {
          await page
            .getByRole('button', { name: 'Show hidden breadcrumbs' })
            .click();
          await expect(page.getByRole('menu')).toBeVisible();
        }
        if (scenario === 'input-focus') {
          await page.getByRole('textbox', { name: 'Catalog name' }).focus();
          await expect(
            page.getByRole('textbox', { name: 'Catalog name' })
          ).toBeFocused();
        }
        if (
          [
            'select-open',
            'select-empty',
            'dropdown-open',
            'popover-open',
          ].includes(scenario)
        ) {
          await page.getByTestId('control-trigger').click();
          if (scenario.startsWith('select-')) {
            await expect(page.getByRole('listbox')).toBeVisible();
          } else if (scenario === 'dropdown-open') {
            await expect(page.getByRole('menu')).toBeVisible();
          } else {
            await expect(page.getByRole('dialog')).toBeVisible();
          }
        }
        if (scenario === 'tooltip-open') {
          await page.getByTestId('control-trigger').hover();
          await expect(page.getByRole('tooltip')).toBeVisible();
        }
        if (scenario === 'modal-open') {
          await expect(page.getByRole('dialog')).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveClass(/\bdark-mode\b/);
        } else {
          await expect(page.locator('html')).not.toHaveClass(/\bdark-mode\b/);
        }
        // Loading is an intentional subject here, so these isolated control
        // captures do not use the application's no-skeleton readiness guard.
        const target =
          scenario.endsWith('-open') ||
          ['select-empty', 'autocomplete-empty', 'filter-empty'].includes(
            scenario
          )
            ? page
            : page.getByTestId('visual-control');
        await expect(target).toHaveScreenshot(`${scenario}-${theme}.png`, {
          ...SCREENSHOT_OPTS,
          maxDiffPixelRatio: 0,
        });
      });
    }
  });
}
