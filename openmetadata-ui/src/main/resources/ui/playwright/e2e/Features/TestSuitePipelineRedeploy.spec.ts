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
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('User with different Roles', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction } = await createNewPage(browser);

    await afterAction();
  });

  test.beforeEach('Visit user list page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Re-deploy all test-suite ingestion pipelines', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.DATA_OBSERVABILITY);

    await expect(
      page.getByText(
        'Re DeployNameTypeScheduleRecent Runsdim_address_TestSuiteTestSuite0 0 * * *--'
      )
    ).toBeVisible();

    await page
      .getByRole('row', { name: 'Name Type filter Schedule' })
      .getByLabel('', { exact: true })
      .check();

    await expect(page.getByRole('button', { name: 'Re Deploy' })).toBeEnabled();

    await page.getByRole('button', { name: 'Re Deploy' }).click();

    await expect(
      page.getByText('Pipelines Re Deploy Successfully')
    ).toBeVisible();
  });
});
