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
import { GlobalSettingOptions } from '../../constant/settings';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Service Listing', () => {
  const databaseService = new DatabaseServiceClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await databaseService.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await databaseService.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.DATABASES);
  });

  test('should render the service listing page', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.getByTestId('filter-icon').click();

    const searchBigQueryResponse = page.waitForResponse(
      `/api/v1/search/query?q=**%20AND%20(serviceType:BigQuery)&from=0&size=15&index=database_service_search_index*`
    );
    await page.getByLabel('Big Query').check();
    await searchBigQueryResponse;

    await expect(page.getByTestId('service-name-sample_data')).toBeVisible();

    await page.getByTestId('filter-icon').click();

    const searchResponse = page.waitForResponse(
      `/api/v1/search/query?q=**%20AND%20(serviceType:BigQuery%20OR%20serviceType:Mysql)&from=0&size=15&index=database_service_search_index*`
    );
    await page.getByLabel('Mysql').check();

    await searchResponse;

    await page.getByTestId('searchbar').fill(databaseService.entity.name);

    await searchResponse;

    await expect(
      page.getByTestId(`service-name-${databaseService.entity.name}`)
    ).toBeVisible();

    await page.getByTestId('filter-icon').click();
    await page.getByLabel('Big Query').uncheck();

    await expect(
      page.getByRole('cell', { name: databaseService.entity.name })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'sample_data' })
    ).not.toBeVisible();
  });
});
