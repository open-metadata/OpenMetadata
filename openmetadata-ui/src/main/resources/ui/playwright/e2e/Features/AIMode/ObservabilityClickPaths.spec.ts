/*
 *  Copyright 2025 Collate.
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

import { expect, test } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('AI mode observability click paths', () => {
  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  test.describe('Data-quality dashboard drill-downs', () => {
    test('open-incident chart click routes to the AI incident manager', async ({
      page,
    }) => {
      await page.goto('/observability/data-quality/dashboard', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('ask-sidebar')).toBeVisible();

      const openIncidentCard = page.getByTestId(
        'incident-New-type-area-chart-widget-container'
      );

      await expect(openIncidentCard).toBeVisible();
      await openIncidentCard.getByRole('link').click();

      await expect(page).toHaveURL(/\/observability\/incident-manager/);
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });

  test.describe('Test case detail page', () => {
    let table: TableClass;

    test.beforeAll(async ({ browser }) => {
      const setupPage = await browser.newPage();
      await redirectToHomePage(setupPage);
      const { apiContext, afterAction } = await getApiContext(setupPage);

      table = new TableClass();
      await table.create(apiContext);
      await table.createTestSuiteAndPipelines(apiContext);
      await table.createTestCase(apiContext);

      await afterAction();
      await setupPage.close();
    });

    test.afterAll(async ({ browser }) => {
      const teardownPage = await browser.newPage();
      const { apiContext, afterAction } = await getApiContext(teardownPage);

      await table?.delete(apiContext);

      await afterAction();
      await teardownPage.close();
    });

    test('switching tabs keeps the URL inside AI mode', async ({ page }) => {
      const testCaseFqn = table.testCasesResponseData[0]?.fullyQualifiedName;
      const encodedFqn = encodeURIComponent(testCaseFqn);

      await page.goto(
        `/observability/test-case/${encodedFqn}/test-case-results`,
        { waitUntil: 'domcontentloaded' }
      );
      await waitForAllLoadersToDisappear(page);

      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
      await expect(page).toHaveURL(
        /\/observability\/test-case\/[^/?]+\/test-case-results/
      );

      // Switch to the Incident tab — URL segment is "issues"
      await page.getByTestId('incident').click();
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        /\/observability\/test-case\/[^/?]+\/issues/
      );
      await expect(page.getByTestId('ask-sidebar')).toBeVisible();
    });
  });
});
