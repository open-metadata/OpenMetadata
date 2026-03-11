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
import { getServiceSearchIndexMappings } from '../../constant/service';
import { GlobalSettingOptions } from '../../constant/settings';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MetadataServiceClass } from '../../support/entity/service/MetadataServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
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
  const messagingService = new MessagingServiceClass();
  const dashboardService = new DashboardServiceClass();
  const pipelineService = new PipelineServiceClass();
  const mlmodelService = new MlmodelServiceClass();
  const storageService = new StorageServiceClass();
  const searchService = new SearchIndexServiceClass();
  const apiService = new ApiServiceClass();
  const driveService = new DriveServiceClass();
  const metadataService = new MetadataServiceClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await databaseService1.create(apiContext);
    await databaseService2.create(apiContext);
    await messagingService.create(apiContext);
    await dashboardService.create(apiContext);
    await pipelineService.create(apiContext);
    await mlmodelService.create(apiContext);
    await storageService.create(apiContext);
    await searchService.create(apiContext);
    await apiService.create(apiContext);
    await driveService.create(apiContext);
    await metadataService.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction } = await createNewPage(browser);
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
      '/api/v1/search/query?q=*&index=database_service_search_index&*'
    );
    await page.getByLabel(databaseService1.entity.serviceType).check();
    await searchService1Response;

    await page.getByTestId('filter-icon').click();

    await page.getByLabel(databaseService2.entity.serviceType).check();
    const searchService2Response = page.waitForResponse(
      '/api/v1/search/query?q=*&index=database_service_search_index&*'
    );

    await page.getByTestId('searchbar').fill(databaseService2.entity.name);
    await searchService2Response;

    await page.getByTestId('filter-icon').click();
    const searchService2Response2 = page.waitForResponse(
      '/api/v1/search/query?q=*&index=database_service_search_index&*'
    );
    await page.getByLabel(databaseService1.entity.serviceType).uncheck();
    await searchService2Response2;

    await expect(
      page.getByRole('cell', { name: databaseService2.entity.name })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: databaseService1.entity.name })
    ).not.toBeVisible();
  });

  test('service listing pages should use the correct search index for search', async ({
    page,
  }) => {
    const searchIndexMappings = getServiceSearchIndexMappings({
      [GlobalSettingOptions.DATABASES]: databaseService2.entity.name,
      [GlobalSettingOptions.MESSAGING]: messagingService.entity.name,
      [GlobalSettingOptions.DASHBOARDS]: dashboardService.entity.name,
      [GlobalSettingOptions.PIPELINES]: pipelineService.entity.name,
      [GlobalSettingOptions.MLMODELS]: mlmodelService.entity.name,
      [GlobalSettingOptions.STORAGES]: storageService.entity.name,
      [GlobalSettingOptions.SEARCH]: searchService.entity.name,
      [GlobalSettingOptions.APIS]: apiService.entity.name,
      [GlobalSettingOptions.DRIVES]: driveService.entity.name,
      [GlobalSettingOptions.METADATA]: metadataService.entity.name,
    });

    for (const {
      settingOption,
      expectedIndex,
      entityName,
    } of searchIndexMappings) {
      await test.step(`${settingOption} uses ${expectedIndex}`, async () => {
        await settingClick(page, settingOption);
        await page.waitForLoadState('networkidle');

        const searchResponse = page.waitForResponse(
          `/api/v1/search/query?q=*index=${expectedIndex}*`
        );
        await page.getByTestId('searchbar').fill(entityName);
        await searchResponse;

        await expect(
          page.getByRole('cell', { name: entityName })
        ).toBeVisible();
      });
    }
  });
});
