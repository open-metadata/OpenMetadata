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
import { Locator, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
  withFullVisualTarget,
} from '../../utils/visualRegression';

const scenes = [
  'tools-menu',
  'sort-menu',
  'export-visible',
  'export-all',
  'advanced-initial',
  'advanced-or',
  'advanced-extra-rule',
  'advanced-group-menu',
  'advanced-nested-group',
  'long-results',
  'search-error',
] as const;

// The AI shell and its legacy content share the page test ID.
const exploreContent = (page: Page) =>
  page.getByTestId('page-layout-v1-column').getByTestId('explore-page');

const openTools = async (page: Page) => {
  await exploreContent(page)
    .getByRole('button', { name: /^Tools$/i })
    .click();
};

const openAdvanced = async (page: Page) => {
  await openTools(page);
  await page.getByRole('menuitemradio', { name: /advanced search/i }).click();
  const modal = page.getByTestId('advanced-search-modal');
  await expect(modal).toBeVisible();
  await modal.getByTestId('reset-btn').click();
  await expect(modal.getByTestId('query-builder-group-card')).toHaveCount(1);
  return modal;
};

for (const theme of VISUAL_THEMES) {
  test.describe(`Explore interactions ${theme}`, { tag: '@Platform' }, () => {
    for (const scene of scenes) {
      test(`explore-${scene}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await prepareVisualTheme(page, theme);
        await installVisualData(
          page,
          scene === 'long-results' ? 'long-content' : 'populated'
        );
        if (scene === 'search-error') {
          // A search failure must leave profile and configuration bootstrap healthy.
          await page.route('**/api/v1/search/query?*', async (route) => {
            if (route.request().method() !== 'GET') return route.fallback();
            await route.fulfill({
              status: 503,
              json: {
                message: 'Unable to load the catalog. Please try again.',
              },
            });
          });
        }
        await gotoForScreenshot(page, '/explore', {
          readyTestId: 'app-shell',
        });
        await expect(exploreContent(page)).toBeVisible();
        let target: Locator | undefined;
        let captured = false;

        if (scene.startsWith('advanced-')) {
          const modal = await openAdvanced(page);
          target = modal;
          if (scene === 'advanced-or') {
            const tab = modal.getByTestId('advanced-search-conjunction-or');
            await tab.click();
            await expect(tab).toHaveAttribute('aria-selected', 'true');
          }
          if (scene === 'advanced-extra-rule') {
            await modal.getByTestId('advanced-search-add-rule').click();
            await expect(
              modal.getByTestId('query-builder-rule-1')
            ).toBeVisible();
          }
          if (
            scene === 'advanced-group-menu' ||
            scene === 'advanced-nested-group'
          ) {
            await modal.getByTestId('advanced-search-add-group').click();
            const menu = page.getByRole('menu');
            await expect(menu.getByRole('menuitemradio')).toHaveCount(2);
            if (scene === 'advanced-group-menu') target = menu;
            else {
              await page.getByTestId('advanced-search-add-group-or').click();
              await expect(
                modal.getByTestId('query-builder-group-card')
              ).toHaveCount(2);
            }
          }
          if (scene === 'advanced-nested-group') {
            // The dialog caps its scroll pane. Capture each complete bracket
            // and connector through scrolling instead of accepting clipped rows.
            const builder = modal.getByTestId('query-builder');
            const addGroup = modal.getByTestId('advanced-search-add-group');
            await expect(addGroup).toBeFocused();
            await modal.getByTestId('cancel-btn').focus();
            const cards = await builder
              .getByTestId('query-builder-group-card')
              .all();
            for (const [index, card] of cards.entries()) {
              await card.scrollIntoViewIfNeeded();
              await expect(card).toBeInViewport({ ratio: 1 });
              if (index === 0)
                await expectVisualScreenshot(
                  page,
                  `explore-${scene}-frame`,
                  theme,
                  { maxDiffPixelRatio: 0 }
                );
              await expectVisualScreenshot(
                page,
                `explore-${scene}-group-${index + 1}`,
                theme,
                { target: card, maxDiffPixelRatio: 0 }
              );
            }
            const connector = builder.getByTestId(
              'query-builder-group-connector'
            );
            await connector.scrollIntoViewIfNeeded();
            await expect(connector).toBeInViewport({ ratio: 1 });
            await expectVisualScreenshot(
              page,
              `explore-${scene}-connector`,
              theme,
              { target: connector, maxDiffPixelRatio: 0 }
            );
            await addGroup.scrollIntoViewIfNeeded();
            await expect(addGroup).toBeInViewport({ ratio: 1 });
            await expect(modal.getByTestId('apply-btn')).toBeInViewport({
              ratio: 1,
            });
            await expectVisualScreenshot(
              page,
              `explore-${scene}-footer-frame`,
              theme,
              { maxDiffPixelRatio: 0 }
            );
            captured = true;
          } else if (scene === 'advanced-extra-rule') {
            // A tall builder scrolls inside the dialog. Preserve every group
            // before taking the ordinary viewport frame with its fixed actions.
            const builder = modal.getByTestId('query-builder');
            await withFullVisualTarget(page, builder, async () => {
              for (const card of await builder
                .getByTestId('query-builder-group-card')
                .all())
                await expect(card).toBeInViewport({ ratio: 1 });
              await expectVisualScreenshot(page, `explore-${scene}`, theme, {
                target: builder,
                maxDiffPixelRatio: 0,
              });
            });
            await expect(modal.getByTestId('apply-btn')).toBeInViewport({
              ratio: 1,
            });
            await expectVisualScreenshot(
              page,
              `explore-${scene}-frame`,
              theme,
              { maxDiffPixelRatio: 0 }
            );
            captured = true;
          }
        } else if (scene === 'tools-menu') {
          await openTools(page);
          target = page.getByRole('menu', { name: 'Tools', exact: true });
          await expect(target.getByRole('menuitemradio')).toHaveCount(4);
        } else if (scene === 'sort-menu') {
          await page.getByTestId('sorting-dropdown-label').click();
          target = page.getByRole('menu');
          await expect(target.getByRole('menuitemradio')).not.toHaveCount(0);
        } else if (scene.startsWith('export-')) {
          await openTools(page);
          await page.getByRole('menuitemradio', { name: /^Export$/i }).click();
          target = page.getByTestId('export-scope-modal');
          await target
            .getByTestId(
              scene === 'export-all'
                ? 'export-scope-all-card'
                : 'export-scope-visible-card'
            )
            .click();
          await expect(
            target.getByRole('radio', {
              name:
                scene === 'export-all' ? /^All Assets$/i : /^Visible Results$/i,
            })
          ).toBeChecked();
          await expect(
            target.getByTestId('export-scope-ok-button')
          ).toBeEnabled();
          await expect(
            target.getByTestId('export-scope-ok-button')
          ).toBeInViewport({ ratio: 1 });
        } else if (scene === 'long-results') {
          await expect(
            page.getByText(
              /Finance reporting metadata with a deliberately long title/
            )
          ).not.toHaveCount(0);
          await expect(
            page.getByText(
              /daily revenue calculations, ownership, freshness checks/
            )
          ).not.toHaveCount(0);
        } else if (scene === 'search-error') {
          await expect(
            page.getByText('Unable to load the catalog. Please try again.', {
              exact: true,
            })
          ).not.toHaveCount(0);
        } else {
          throw new Error(`Unhandled Explore scene: ${scene}`);
        }

        if (!captured) {
          if (target) await expect(target).toBeVisible();
          await expectVisualScreenshot(page, `explore-${scene}`, theme, {
            target,
            maxDiffPixelRatio: 0,
            allowErrorFeedback: scene === 'search-error',
          });
        }
        expect(
          errors,
          'Explore states must render without runtime errors'
        ).toEqual([]);
      });
    }
  });
}
