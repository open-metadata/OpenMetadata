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
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { updateDisplayNameForEntity } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.EXPLORE);
});

test.describe('Explore Tree scenarios ', () => {
  test('Explore Tree', async ({ page }) => {
    await test.step('Check the explore tree', async () => {
      await expect(page.getByRole('tree')).toContainText('Databases');
      await expect(page.getByRole('tree')).toContainText('Dashboards');
      await expect(page.getByRole('tree')).toContainText('Pipelines');
      await expect(page.getByRole('tree')).toContainText('Topics');
      await expect(page.getByRole('tree')).toContainText('ML Models');
      await expect(page.getByRole('tree')).toContainText('Containers');
      await expect(page.getByRole('tree')).toContainText('Search Indexes');
      await expect(page.getByRole('tree')).toContainText('Governance');
      await expect(page.getByRole('tree')).toContainText('APIs');

      await page
        .locator('div')
        .filter({ hasText: /^Governance$/ })
        .locator('svg')
        .first()
        .click();

      await expect(page.getByRole('tree')).toContainText('Glossaries');
      await expect(page.getByRole('tree')).toContainText('Tags');

      // APIs
      await page
        .locator('div')
        .filter({ hasText: /^APIs$/ })
        .locator('svg')
        .first()
        .click();

      await expect(page.getByRole('tree')).toContainText('rest');
    });

    await test.step('Check the quick filters', async () => {
      await expect(
        page.getByTestId('search-dropdown-Domain').locator('span')
      ).toContainText('Domain');
      await expect(page.getByTestId('search-dropdown-Owner')).toContainText(
        'Owner'
      );
      await expect(
        page.getByTestId('search-dropdown-Tag').locator('span')
      ).toContainText('Tag');

      await page.getByRole('button', { name: 'Tier' }).click();

      await expect(
        page.getByTestId('search-dropdown-Tier').locator('span')
      ).toContainText('Tier');
      await expect(
        page.getByTestId('search-dropdown-Service').locator('span')
      ).toContainText('Service');
      await expect(
        page.getByTestId('search-dropdown-Service Type').locator('span')
      ).toContainText('Service Type');
    });

    await test.step('Click on tree item and check quick filter', async () => {
      await page.getByTestId('explore-tree-title-Glossaries').click();

      await expect(
        page.getByTestId('search-dropdown-Data Assets')
      ).toContainText('Data Assets: glossaryTerm');

      await page.getByTestId('explore-tree-title-Tags').click();

      await expect(
        page.getByTestId('search-dropdown-Data Assets')
      ).toContainText('Data Assets: tag');
    });
  });

  test('Verify Database and Database schema after rename', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);
    await table.visitEntityPage(page);
    const schemaName = get(table.schemaResponseData, 'name', '');
    const dbName = get(table.databaseResponseData, 'name', '');
    const serviceName = get(table.serviceResponseData, 'name', '');
    const updatedSchemaName = `Test ${schemaName} updated`;
    const updatedDbName = `Test ${dbName} updated`;

    const schemaRes = page.waitForResponse('/api/v1/databaseSchemas/name/*');
    await page.getByRole('link', { name: schemaName }).click();
    // Rename Schema Page
    await schemaRes;
    await updateDisplayNameForEntity(
      page,
      updatedSchemaName,
      EntityTypeEndpoint.DatabaseSchema
    );

    const dbRes = page.waitForResponse('/api/v1/databases/name/*');
    await page.getByRole('link', { name: dbName }).click();
    // Rename Database Page
    await dbRes;
    await updateDisplayNameForEntity(
      page,
      updatedDbName,
      EntityTypeEndpoint.Database
    );

    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');
    const serviceNameRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=database_search_index&from=0&size=0*mysql*'
    );
    await page
      .locator('div')
      .filter({ hasText: /^mysql$/ })
      .locator('svg')
      .first()
      .click();
    await serviceNameRes;

    const databaseRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*serviceType*'
    );

    await page
      .locator('.ant-tree-treenode')
      .filter({ hasText: serviceName })
      .locator('.ant-tree-switcher svg')
      .click();
    await databaseRes;

    await expect(
      page.getByTestId(`explore-tree-title-${updatedDbName}`)
    ).toBeVisible();

    const databaseSchemaRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*database.displayName*'
    );

    await page
      .locator('.ant-tree-treenode')
      .filter({ hasText: updatedDbName })
      .locator('.ant-tree-switcher svg')
      .click();
    await databaseSchemaRes;

    await expect(
      page.getByTestId(`explore-tree-title-${updatedSchemaName}`)
    ).toBeVisible();

    await table.delete(apiContext);
    await afterAction();
  });
});
