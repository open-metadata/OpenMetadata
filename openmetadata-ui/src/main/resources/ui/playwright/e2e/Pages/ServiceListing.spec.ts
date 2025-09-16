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
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Service Listing', () => {
  const databaseService1 = new DatabaseServiceClass(undefined, {
    name: `pw-database-service-${uuid()}`,
    serviceType: 'Clickhouse',
    connection: {
      config: {
        type: 'Clickhouse',
        scheme: 'clickhouse+http',
        username: 'username',
        password: 'password',
        hostPort: 'clickhouse:8123',
      },
    },
  });
  const databaseService2 = new DatabaseServiceClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await databaseService1.create(apiContext);
    await databaseService2.create(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.DATABASES);
  });

  test('should render the service listing page', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.getByTestId('filter-icon').click();

    const searchService1Response = page.waitForResponse(
      `/api/v1/search/query?q=**%20AND%20(serviceType:${databaseService1.entity.serviceType})&from=0&size=15&index=database_service_search_index*`
    );
    await page.getByLabel(databaseService1.entity.serviceType).check();
    await searchService1Response;

    await expect(
      page.getByTestId(`service-name-${databaseService1.entity.name}`)
    ).toBeVisible();

    await page.getByTestId('filter-icon').click();

    const searchService2Response = page.waitForResponse(
      // eslint-disable-next-line max-len
      `/api/v1/search/query?q=**%20AND%20(serviceType:${databaseService1.entity.serviceType}%20OR%20serviceType:${databaseService2.entity.serviceType})&from=0&size=15&index=database_service_search_index*`
    );
    await page.getByLabel(databaseService2.entity.serviceType).check();

    await searchService2Response;

    const searchService2Response2 = page.waitForResponse(
      // eslint-disable-next-line max-len
      `/api/v1/search/query?q=**%20AND%20(serviceType:${databaseService1.entity.serviceType}%20OR%20serviceType:${databaseService2.entity.serviceType})&from=0&size=15&index=database_service_search_index*`
    );

    await page.getByTestId('searchbar').fill(databaseService2.entity.name);

    await searchService2Response2;

    await expect(
      page.getByTestId(`service-name-${databaseService2.entity.name}`)
    ).toBeVisible();

    await page.getByTestId('filter-icon').click();
    await page.getByLabel(databaseService1.entity.serviceType).uncheck();

    await expect(
      page.getByRole('cell', { name: databaseService2.entity.name })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: databaseService1.entity.name })
    ).not.toBeVisible();
  });
});
