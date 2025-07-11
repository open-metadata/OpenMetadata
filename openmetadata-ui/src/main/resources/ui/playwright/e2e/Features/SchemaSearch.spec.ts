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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const table = new TableClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Schema search', { tag: '@ingestion' }, () => {
  test.beforeAll('Prerequisite', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.create(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Search schema in database page', async ({ page }) => {
    const servicesResponse = page.waitForResponse(
      '/api/v1/services/databaseServices?**'
    );
    await settingClick(page, GlobalSettingOptions.DATABASES);

    await servicesResponse;

    const serviceName = table.serviceResponseData?.name ?? '';
    const schemaName = table.schemaResponseData?.name;

    const searchServiceResponse = page.waitForResponse(
      '/api/v1/search/query?q=*'
    );

    await page.getByPlaceholder('Search Services').fill(serviceName);
    await searchServiceResponse;
    await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

    await page.click(`[data-testid="service-name-${serviceName}"]`);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

    const headerText = await page.textContent(
      `[data-testid="entity-header-name"]`
    );

    expect(headerText).toBe(serviceName);

    const schemaResponse = page.waitForResponse('/api/v1/databaseSchemas?**');
    await page.click('[data-testid="databases"]');
    await page.click(
      `[data-testid="table-container"] >> text=${table.database.name}`
    );

    await schemaResponse;

    const searchResponse = page.waitForResponse(
      '/api/v1/search/query?q=**&index=database_schema_search_index**'
    );

    await page.fill('[data-testid="searchbar"]', schemaName);
    await searchResponse;

    await expect(page.getByTestId('database-databaseSchemas')).toBeVisible();
  });
});
