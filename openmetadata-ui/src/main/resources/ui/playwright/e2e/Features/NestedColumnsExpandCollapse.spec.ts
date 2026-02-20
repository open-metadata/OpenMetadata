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
import { APIRequestContext, test } from '@playwright/test';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  createApiEndpointEntity,
  createContainerEntity,
  createDataModelEntity,
  createFileEntity,
  createSearchIndexEntity,
  createTableEntity,
  createTopicEntity,
  createWorksheetEntity,
  verifyExpandCollapseForSummaryPanel,
  verifyExpandCollapseNoDuplication,
} from '../../utils/nestedColumnUpdatesUtils';

test.use({ storageState: 'playwright/.auth/admin.json' });

type EntityTestData = Awaited<ReturnType<typeof createTopicEntity>>;

const entityCreators: Record<
  string,
  (apiContext: APIRequestContext) => Promise<EntityTestData>
> = {
  Table: createTableEntity,
  Topic: createTopicEntity,
  'API Endpoint': createApiEndpointEntity,
  'Data Model': createDataModelEntity,
  Container: createContainerEntity,
  'Search Index': createSearchIndexEntity,
  Worksheet: createWorksheetEntity,
  File: createFileEntity,
};

for (const [entityType, createEntity] of Object.entries(entityCreators)) {
  test.describe(`${entityType} - Nested columns with duplicate names`, () => {
    let entityData: EntityTestData;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      entityData = await createEntity(apiContext);
      await afterAction();
    });

    test('should not duplicate rows when expanding and collapsing nested columns with same names', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await entityData.visitPage(page);

      await waitForAllLoadersToDisappear(page);
      await verifyExpandCollapseNoDuplication(page, entityData.keys);
    });
  });
}

test.describe(
  'Table Version History - Nested columns with duplicate names',
  () => {
    let entityData: Awaited<ReturnType<typeof createTableEntity>>;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      entityData = await createTableEntity(apiContext);
      await afterAction();
    });

    test('should not duplicate rows when expanding and collapsing nested columns with same names in Version History', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await entityData.visitPage(page);
      await page.getByTestId('version-button').click();
      await waitForAllLoadersToDisappear(page);
      await verifyExpandCollapseNoDuplication(page, entityData.keys);
    });
  }
);

test.describe(
  'Table Profiler Tab - Nested columns with duplicate names',
  () => {
    let entityData: Awaited<ReturnType<typeof createTableEntity>>;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      entityData = await createTableEntity(apiContext);
      await afterAction();
    });

    test('should not duplicate rows when expanding and collapsing nested columns with same names in Profiler Tab', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await entityData.visitPage(page);
      await page.getByTestId('profiler').click();
      await page.getByRole('tab', { name: 'Column Profile' }).click();
      await waitForAllLoadersToDisappear(page);
      await verifyExpandCollapseNoDuplication(page, {
        ...entityData.keys,
        expandLevel0: true,
      });
    });
  }
);

test.describe(
  'API Endpoint Entity Summary Panel - Nested columns with duplicate names',
  () => {
    let apiService: Awaited<ReturnType<typeof createApiEndpointEntity>>;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      apiService = await createApiEndpointEntity(apiContext);
      await afterAction();
    });

    test('should not duplicate rows when expanding and collapsing nested columns with same names in Explore Summary Panel', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const dataAssestResponse = page.waitForResponse(
        'api/v1/search/query?q=*&index=dataAsset*'
      );
      // Go to Explore
      await page.locator('[data-testid="app-bar-item-explore"]').click();
      await dataAssestResponse;
      await waitForAllLoadersToDisappear(page);

      const serviceSearchResponse = page.waitForResponse(
        '**/api/v1/search/aggregate*'
      );
      // Interact with Service dropdown
      await page.getByTestId('search-dropdown-Service').click();
      await page.getByTestId('search-input').fill(apiService.service.name);
      await serviceSearchResponse;
      await page.getByTestId(apiService.service.name).click();
      await page.getByTestId('update-btn').click();

      // Click row (anywhere on the row usually opens summary)
      // We target the specific row by test-id generated from service and table name
      await page
        .getByTestId(`table-data-card_${apiService.entity.fullyQualifiedName}`)
        .click();

      // Click Schema Tab
      await page.getByTestId('schema-tab').click();

      await verifyExpandCollapseForSummaryPanel(page);
    });
  }
);
