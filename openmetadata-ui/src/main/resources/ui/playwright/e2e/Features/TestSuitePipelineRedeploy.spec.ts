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

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();

test.describe('Bulk Re-Deploy pipelines ', () => {
  let pipeline1: any;
  let pipeline2: any;

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.create(apiContext);
    await table2.create(apiContext);

    pipeline1 = await table1.createTestSuiteAndPipelines(apiContext);
    pipeline2 = await table2.createTestSuiteAndPipelines(apiContext);

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

  test('Re-deploy all test-suite ingestion pipelines', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.DATA_OBSERVABILITY);

    await expect(
      page.getByRole('button', { name: 'Re Deploy' })
    ).not.toBeEnabled();
    await expect(page.locator('.ant-table-container')).toBeVisible();

    await page.getByRole('checkbox').first().click();

    await expect(page.getByRole('button', { name: 'Re Deploy' })).toBeEnabled();

    await page.getByRole('button', { name: 'Re Deploy' }).click();
    await page.waitForResponse(
      `api/v1/services/ingestionPipelines/deploy/${pipeline1.pipeline.id}`
    );
    await page.waitForResponse(
      `api/v1/services/ingestionPipelines/deploy/${pipeline2.pipeline.id}`
    );

    await expect(
      page.getByText('Pipelines Re Deploy Successfully')
    ).toBeVisible();
  });

  // TODO: Add test to verify the re-deployed pipelines for Database, Dashboard and other entities
});
