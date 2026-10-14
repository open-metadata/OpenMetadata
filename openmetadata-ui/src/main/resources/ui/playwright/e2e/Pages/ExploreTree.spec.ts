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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import {
  updateDisplayNameForEntity,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  expandDatabaseInExploreTree,
  expandServiceInExploreTree,
  getFlatColumnCountOfTable,
  validateBucketsForIndex,
  verifyDatabaseAndSchemaInExploreTree,
} from '../../utils/explore';
import { clickBreadcrumbAncestor } from '../../utils/headerBreadcrumbUtils';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.EXPLORE);
});

test.describe('Explore Tree scenarios', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  let table1: TableClass;
  let table2: TableClass;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Explore tree's service bucket is capped and sorted alphabetically
    // (ElasticSearchAggregationManager orders by _key ASC), so a name starting
    // with a digit guarantees these services land within that bucket
    // regardless of how many other `pw-*` services have accumulated.
    table1 = new TableClass({
      service: new DatabaseServiceClass(`0-pw-database-service-${uuid()}`),
    });
    table2 = new TableClass({
      service: new DatabaseServiceClass(`0-pw-database-service-${uuid()}`),
    });

    await table1.create(apiContext);
    await table2.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table1.delete(apiContext);
    await table2.delete(apiContext);

    await afterAction();
  });

  test('Verify Database and Database Schema available in explore tree', async ({
    page,
  }) => {
    const schemaName1 = get(table1.schemaResponseData, 'name', '');
    const dbName1 = get(table1.databaseResponseData, 'name', '');
    const serviceName1 = get(table1.serviceResponseData, 'name', '');
    const schemaName2 = get(table2.schemaResponseData, 'name', '');
    const dbName2 = get(table2.databaseResponseData, 'name', '');
    const serviceName2 = get(table2.serviceResponseData, 'name', '');

    await sidebarClick(page, SidebarItem.EXPLORE);

    // Verify first table's database and schema
    await test.step('Verify first table database and schema', async () => {
      await verifyDatabaseAndSchemaInExploreTree(
        page,
        serviceName1,
        dbName1,
        schemaName1
      );
    });

    // Verify second table's database and schema
    await test.step('Verify second table database and schema', async () => {
      await verifyDatabaseAndSchemaInExploreTree(
        page,
        serviceName2,
        dbName2,
        schemaName2,
        true
      );
    });
  });

  test('Verify Database and Database schema after rename', async ({ page }) => {
    await table1.visitEntityPage(page);
    const schemaName = get(table1.schemaResponseData, 'name', '');
    const dbName = get(table1.databaseResponseData, 'name', '');
    const serviceName = get(table1.serviceResponseData, 'name', '');
    const updatedSchemaName = `Test ${schemaName} updated`;
    const updatedDbName = `Test ${dbName} updated`;

    // Step 1: Visit explore page and check existing values before rename
    await test.step('Visit explore page and verify existing values', async () => {
      await sidebarClick(page, SidebarItem.EXPLORE);

      // Verify original database and schema names using utility function
      await verifyDatabaseAndSchemaInExploreTree(
        page,
        serviceName,
        dbName,
        schemaName
      );
    });

    // Step 2: Perform rename operations
    await test.step('Rename schema and database', async () => {
      // Navigate back to the table page for renaming
      await table1.visitEntityPage(page);

      const schemaRes = page.waitForResponse('/api/v1/databaseSchemas/name/*');
      // The schema crumb may auto-collapse into the breadcrumb overflow menu on
      // narrow viewports, so navigate through the overflow-aware helper.
      await clickBreadcrumbAncestor(page, schemaName);
      // Rename Schema Page
      await schemaRes;
      await waitForAllLoadersToDisappear(page);
      await updateDisplayNameForEntity(
        page,
        updatedSchemaName,
        EntityTypeEndpoint.DatabaseSchema
      );

      const dbRes = page.waitForResponse('/api/v1/databases/name/*');
      await page.getByRole('link', { name: dbName }).click();
      // Rename Database Page
      await dbRes;
      await waitForAllLoadersToDisappear(page);
      await updateDisplayNameForEntity(
        page,
        updatedDbName,
        EntityTypeEndpoint.Database
      );
    });

    // Step 3: Verify the changes are reflected in explore page
    await test.step('Verify renamed values in explore page', async () => {
      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);

      // Verify updated database and schema names using utility function
      await verifyDatabaseAndSchemaInExploreTree(
        page,
        serviceName,
        updatedDbName,
        updatedSchemaName
      );
    });
  });
});

test.describe('Explore page', () => {
  let table: TableClass;
  let dashboard: DashboardClass;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Explore tree's service bucket is capped and sorted alphabetically
    // (ElasticSearchAggregationManager orders by _key ASC), so a name starting
    // with a digit guarantees these services land within that bucket
    // regardless of how many other `pw-*` services have accumulated.
    table = new TableClass({
      service: new DatabaseServiceClass(`0-pw-database-service-${uuid()}`),
    });
    dashboard = new DashboardClass({
      service: new DashboardServiceClass(`0-pw-dashboard-service-${uuid()}`),
    });

    await table.create(apiContext);
    await dashboard.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await dashboard.delete(apiContext);

    await afterAction();
  });

  test('Check the listing of tags', async ({ page }) => {
    await page
      .getByTestId('explore-tree')
      .getByRole('row')
      .filter({ has: page.getByTestId('explore-tree-title-Governance') })
      .getByTestId('tree-expand-btn')
      .click();

    await expect(page.getByRole('treegrid')).toContainText('Glossaries');
    await expect(page.getByRole('treegrid')).toContainText('Tags');

    // The tree fires size=0 count queries on the dataAsset index alongside the
    // main results query; match the results query (non-zero size) so the hits
    // assertion sees the actual documents, not an aggregation-only response.
    const res = page.waitForResponse(
      (response) =>
        response.url().includes('index=dataAsset') &&
        !response.url().includes('size=0')
    );
    // click on tags
    await page.getByTestId('explore-tree-title-Tags').click();

    const response = await res;
    const jsonResponse = await response.json();

    expect(jsonResponse.hits.hits.length).toBeGreaterThan(0);
  });

  test('Check listing of entities when index is dataAsset', async ({
    page,
  }) => {
    await validateBucketsForIndex(page, 'dataAsset');
  });

  test('Check listing of entities when index is all', async ({ page }) => {
    await validateBucketsForIndex(page, 'all');
  });

  test('Verify charts are visible in explore tree', async ({ page }) => {
    await waitForAllLoadersToDisappear(page);

    const serviceName = dashboard.serviceResponseData.name;

    const dashboardNode = page.getByTestId('explore-tree-title-Dashboards');
    await expect(dashboardNode).toBeVisible();

    const dashboardNodeClickResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/search/query') &&
        resp.url().includes('index=dataAsset') &&
        resp.url().includes('query_filter')
    );

    await page.getByTestId('explore-tree-title-Dashboards').click();

    await dashboardNodeClickResponse;

    await page
      .getByTestId('explore-tree')
      .getByRole('row')
      .filter({
        has: page.getByTestId('explore-tree-title-Dashboards'),
      })
      .getByTestId('tree-expand-btn')
      .click();

    const supersetNode = page.getByTestId('explore-tree-title-superset');
    await expect(supersetNode).toBeVisible();

    await page
      .getByTestId('explore-tree')
      .getByRole('row')
      .filter({
        has: page.getByTestId('explore-tree-title-superset'),
      })
      .getByTestId('tree-expand-btn')
      .click();

    const dashboardServiceNode = page.getByTestId(
      `explore-tree-title-${serviceName}`
    );
    await expect(dashboardServiceNode).toBeVisible();

    await page
      .getByTestId('explore-tree')
      .getByRole('row')
      .filter({
        has: page.getByTestId(`explore-tree-title-${serviceName}`),
      })
      .getByTestId('tree-expand-btn')
      .click();

    const chartsNode = page.getByTestId('explore-tree-title-chart');
    await expect(chartsNode).toBeVisible();
    await expect(chartsNode).toContainText('Charts');

    const searchInput = page.getByTestId('searchBox');
    await searchInput.click();
    await searchInput.clear();
    await searchInput.fill(dashboard.chartsResponseData.name);
    await searchInput.press('Enter');

    const searchResults = page.getByTestId('search-results');
    const chartCard = searchResults.getByTestId(
      `table-data-card_${dashboard.chartsResponseData.fullyQualifiedName}`
    );

    await expect(chartCard).toBeVisible();

    const exploreLeftPanel = page.getByTestId('explore-left-panel');
    await expect(exploreLeftPanel).toBeVisible();

    const chartsTab = page.getByTestId('charts-tab');
    await expect(chartsTab).toBeVisible();
    await expect(chartsTab).toContainText('Charts');
  });

  test('Verify columns are visible in explore tree hierarchy', async ({
    page,
  }) => {
    const serviceName = table.serviceResponseData.name;
    const dbName = table.databaseResponseData.name;
    const schemaName = table.schemaResponseData.name;

    await sidebarClick(page, SidebarItem.EXPLORE);

    await expandServiceInExploreTree(page, serviceName);
    await expandDatabaseInExploreTree(page, dbName);

    const schemaRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*databaseSchema.displayName*'
    );
    await page
      .getByTestId('explore-tree')
      .getByRole('row')
      .filter({ hasText: schemaName })
      .getByTestId('tree-expand-btn')
      .click();
    await schemaRes;

    const columnsNode = page.getByTestId('explore-tree-title-tableColumn');
    await expect(columnsNode).toBeVisible();

    const columnCount = getFlatColumnCountOfTable(
      table.entityResponseData.columns ?? []
    );

    const countBadge = columnsNode.locator('..').locator('.explore-node-count');
    await expect(countBadge).toContainText(String(columnCount));
  });
});
