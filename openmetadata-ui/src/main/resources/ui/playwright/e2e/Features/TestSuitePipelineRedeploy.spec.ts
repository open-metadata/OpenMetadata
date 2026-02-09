/*
 *  Copyright 2024 Collate.
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
import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();

test.describe('Bulk Re-Deploy pipelines ', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.slow();

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.create(apiContext);
    await table2.create(apiContext);

    await table1.createTestSuiteAndPipelines(apiContext);
    await table2.createTestSuiteAndPipelines(apiContext);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.delete(apiContext);
    await table2.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  /**
   * Re-deploy all TestSuite ingestion pipelines
   * @description Navigates to Data Observability settings, selects multiple pipelines, triggers bulk redeploy,
   * and verifies success confirmation.
   */
  test('Re-deploy all test-suite ingestion pipelines', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.DATA_OBSERVABILITY);

    await expect(
      page.getByRole('button', { name: 'Re Deploy' })
    ).not.toBeEnabled();
    await expect(page.locator('.ant-table-container')).toBeVisible();

    await page.locator(`td [type="checkbox"]`).first().click();
    await page.locator(`td [type="checkbox"]`).nth(1).click();

    await expect(page.getByRole('button', { name: 'Re Deploy' })).toBeEnabled();

    const redeployResponse = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/services/ingestionPipelines/deploy') &&
        request.method() === 'POST'
    );
    await page.getByRole('button', { name: 'Re Deploy' }).click();
    await redeployResponse;

    await expect(
      page.getByText('Pipelines Re Deploy Successfully')
    ).toBeVisible();
  });

  // TODO: Add test to verify the re-deployed pipelines for Database, Dashboard and other entities
});
