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
import test, { expect } from '@playwright/test';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { generateEntityChildren } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const dashboardEntity = new DashboardServiceClass();

test.slow(true);

test.describe('Dashboards', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const dashboardChildren = generateEntityChildren('dashboard', 25);

    await dashboardEntity.create(apiContext, dashboardChildren);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test(`should change the page size`, async ({ page }) => {
    await dashboardEntity.visitEntityPage(page);

    await page.getByRole('tab', { name: 'Dashboards' }).click();

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2 '
    );

    // Check the page sizing change
    const childrenResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/dashboards') &&
        res.url().includes('limit=25')
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('25 / Page').click();
    await childrenResponse;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 1'
    );
  });
});
