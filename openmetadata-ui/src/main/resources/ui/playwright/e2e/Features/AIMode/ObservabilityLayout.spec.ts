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
 * Layout invariants for the AI-mode Observability pages — card heights and
 * overlay stacking. These are the things that look fine in a DOM
 * assertion and wrong on screen, so each `test.describe` states the failure it
 * guards rather than restating its assertions.
 *
 * Behaviour and navigation live in `Observability.spec.ts`;
 * AI-mode routing lives in `AppMode/`.
 */

import { expect, test } from '@playwright/test';
import { BundleTestSuiteClass } from '../../../support/entity/BundleTestSuiteClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('AI mode Observability — layout', () => {
  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  /**
   * The three Data Health cards sit in one grid row but sized themselves to
   * their own content, so Test Case Results — which carries a third legend row
   * — stood taller than its neighbours.
   */
  test.describe('Data Quality — Data Health', () => {
    test('all three cards in the row share one height', async ({ page }) => {
      await page.goto('/observability/data-quality', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      // Wait for the three-legend card specifically: it is the one whose extra
      // row used to make it taller, and while the widgets are still skeletons
      // every card is trivially the same height.
      await expect(page.getByTestId('legend-count-aborted')).toBeVisible();

      const cards = page.locator('.data-quality-dashboard-pie-chart');

      await expect(cards).toHaveCount(3);

      const heights = await cards.evaluateAll((elements) =>
        elements.map((element) =>
          Math.round(element.getBoundingClientRect().height)
        )
      );

      expect(new Set(heights).size).toBe(1);
    });
  });

  /**
   * Opening the rename modal on a bundle-suite page left the page tabs sharp
   * and undimmed on top of the scrim: their `z-10` landed in the root stacking
   * context, where the overlay's backdrop-filter could not capture them.
   */
  test.describe('bundle suite details — rename modal', () => {
    const bundleSuite = new BundleTestSuiteClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await bundleSuite.createBundleTestSuite(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await apiContext.delete(
        `/api/v1/dataQuality/testSuites/${bundleSuite.bundleTestSuiteResponseData['id']}?hardDelete=true&recursive=true`
      );
      await afterAction();
    });

    test('the modal overlay covers the page tabs', async ({ page }) => {
      const suiteFqn = getEncodedFqn(
        bundleSuite.bundleTestSuiteResponseData['fullyQualifiedName'] as string
      );

      await page.goto(`/observability/test-suites/${suiteFqn}`, {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const tabList = page.getByTestId('tabs-root').getByRole('tablist');

      await expect(tabList).toBeVisible();

      // Compare the tab strip's own pixels before and after the scrim goes up.
      // A DOM assertion cannot see this defect: hit-testing already reported
      // the overlay as the topmost element at the tabs' coordinates even while
      // they painted through it, so only the rendered pixels tell the truth.
      const beforeModal = await tabList.screenshot();

      await page.getByTestId('manage-button').click();
      await page.getByRole('menuitem', { name: /Rename/ }).click();

      const dialog = page.getByTestId('entity-name-modal');

      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Edit Display Name')).toBeVisible();

      const afterModal = await tabList.screenshot();

      // Compared as base64 rather than through `Buffer.compare`/`.equals`,
      // whose parameter type does not accept the Buffer flavour Playwright's
      // `screenshot()` returns under this repo's @types/node.
      expect(beforeModal.toString('base64')).not.toBe(
        afterModal.toString('base64')
      );

      // The pixel check only proves a scrim rendered somewhere over the strip
      // — measured against the defect it does not discriminate, because the
      // tab strip's box includes background around the labels that dims either
      // way. What actually stops the tabs painting through is the page shell
      // owning a stacking context, so assert that too; it is the invariant the
      // `z-10` on each tab is scoped by.
      await expect(page.getByTestId('observability-page-shell')).toHaveCSS(
        'isolation',
        'isolate'
      );
    });
  });
});
