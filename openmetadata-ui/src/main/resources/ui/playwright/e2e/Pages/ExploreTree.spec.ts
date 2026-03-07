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
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  copyAndGetClipboardText,
  testCopyLinkButton,
  updateDisplayNameForEntity,
  validateCopiedLinkFormat,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  expandDatabaseInExploreTree,
  expandServiceInExploreTree,
  getFlatColumnCountOfTable,
  validateBucketsForIndex,
  verifyDatabaseAndSchemaInExploreTree,
} from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.EXPLORE);
});

test.describe('Explore Tree scenarios', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  const table1 = new TableClass();
  const table2 = new TableClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table1.create(apiContext);
    await table2.create(apiContext);

    await afterAction();
  });

  test('Explore Tree', async ({ page }) => {
    await test.step('Check the explore tree', async () => {
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('explore-tree-title-Databases')
      ).toContainText('Databases');
      await expect(
        page.getByTestId('explore-tree-title-Dashboards')
      ).toContainText('Dashboards');
      await expect(
        page.getByTestId('explore-tree-title-Pipelines')
      ).toContainText('Pipelines');
      await expect(page.getByTestId('explore-tree-title-Topics')).toContainText(
        'Topics'
      );
      await expect(
        page.getByTestId('explore-tree-title-ML Models')
      ).toContainText('ML Models');
      await expect(
        page.getByTestId('explore-tree-title-Containers')
      ).toContainText('Containers');
      await expect(
        page.getByTestId('explore-tree-title-Search Indexes')
      ).toContainText('Search Indexes');
      await expect(
        page.getByTestId('explore-tree-title-Governance')
      ).toContainText('Governance');

      await page
        .locator('div')
        .filter({ hasText: /^Governance$/ })
        .locator('svg')
        .first()
        .click();

      await expect(
        page.getByTestId('explore-tree-title-Glossaries')
      ).toContainText('Glossaries');
      await expect(page.getByTestId('explore-tree-title-Tags')).toContainText(
        'Tags'
      );
    });

    await test.step('Check the quick filters', async () => {
      await expect(
        page.getByTestId('search-dropdown-Domains').locator('span')
      ).toContainText('Domains');
      await expect(page.getByTestId('search-dropdown-Owners')).toContainText(
        'Owners'
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
      ).toContainText('Data Assets: glossaryterm');

      await page.getByTestId('explore-tree-title-Tags').click();

      await expect(
        page.getByTestId('search-dropdown-Data Assets')
      ).toContainText('Data Assets: tag');
    });

    await test.step(
      'Click on tree item metrics and check quick filter',
      async () => {
        await page.getByTestId('explore-tree-title-Metrics').click();

        await expect(
          page.getByTestId('search-dropdown-Data Assets')
        ).toContainText('Data Assets: metric');
      }
    );
  });

  test('Verify Tags navigation via Governance tree and breadcrumb renders page correctly', async ({
    page,
  }) => {
    await test.step('Expand Governance node in explore tree', async () => {
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('explore-tree-title-Governance')
      ).toBeVisible();

      await page
        .locator('.ant-tree-treenode', {
          has: page.getByTestId('explore-tree-title-Governance'),
        })
        .locator('.ant-tree-switcher')
        .click();
    });

    await test.step('Click on Tags under Governance', async () => {
      await expect(page.getByTestId('explore-tree-title-Tags')).toBeVisible();

      const tagsSearchRes = page.waitForResponse(
        '/api/v1/search/query?q=&index=dataAsset*'
      );
      await page.getByTestId('explore-tree-title-Tags').click();
      const tagsSearchResponse = await tagsSearchRes;

      expect(tagsSearchResponse.status()).toBe(200);
    });

    await test.step(
      'Click parent classification breadcrumb from a tag result',
      async () => {
        await waitForAllLoadersToDisappear(page);
        const classificationBreadcrumb = page
          .locator('[data-testid="breadcrumb-link"] a[href*="/tags/"]')
          .first();

        await expect(classificationBreadcrumb).toBeVisible();
        await expect(classificationBreadcrumb).toBeEnabled();

        const classificationsRes = page.waitForResponse(
          '/api/v1/classifications*'
        );
        const tagsTableRes = page.waitForResponse('/api/v1/tags*');

        await classificationBreadcrumb.click();

        const classificationResponse = await classificationsRes;
        const tagsTableResponse = await tagsTableRes;

        expect(classificationResponse.status()).toBe(200);
        expect(tagsTableResponse.status()).toBe(200);
      }
    );

    await test.step(
      'Verify full Tags page renders with left panel, table and headers',
      async () => {
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('side-panel-classification')
        ).not.toHaveCount(0);

        await expect(page.getByTestId('tags-container')).toBeVisible();

        await expect(page.getByTestId('table')).toBeVisible();

        // Verify all table column headers are correct
        const headers = await page
          .locator('.ant-table-thead > tr > .ant-table-cell')
          .allTextContents();

        expect(headers).toEqual([
          'Enabled',
          'Tag',
          'Display Name',
          'Description',
          'Actions',
        ]);
      }
    );
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
    await page.waitForLoadState('networkidle');

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
    await test.step(
      'Visit explore page and verify existing values',
      async () => {
        await sidebarClick(page, SidebarItem.EXPLORE);
        await page.waitForLoadState('networkidle');

        // Verify original database and schema names using utility function
        await verifyDatabaseAndSchemaInExploreTree(
          page,
          serviceName,
          dbName,
          schemaName
        );
      }
    );

    // Step 2: Perform rename operations
    await test.step('Rename schema and database', async () => {
      // Navigate back to the table page for renaming
      await table1.visitEntityPage(page);

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
    });

    // Step 3: Verify the changes are reflected in explore page
    await test.step('Verify renamed values in explore page', async () => {
      await sidebarClick(page, SidebarItem.EXPLORE);
      await page.waitForLoadState('networkidle');

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

test.describe('Explore page', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  const table = EntityDataClass.table1;
  const dashboard = EntityDataClass.dashboard1;
  const apiEndpoint = EntityDataClass.apiEndpoint1;
  const searchIndex = EntityDataClass.searchIndex1;

  test('Check the listing of tags', async ({ page }) => {
    await page
      .locator('div')
      .filter({ hasText: /^Governance$/ })
      .locator('svg')
      .first()
      .click();

    await expect(page.getByRole('tree')).toContainText('Glossaries');
    await expect(page.getByRole('tree')).toContainText('Tags');

    const res = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*'
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
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

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
      .locator('.ant-tree-treenode', {
        has: page.getByTestId('explore-tree-title-Dashboards'),
      })
      .locator('.ant-tree-switcher')
      .click();

    const supersetNode = page.getByTestId('explore-tree-title-superset');
    await expect(supersetNode).toBeVisible();

    await page
      .locator('.ant-tree-treenode', {
        has: page.getByTestId('explore-tree-title-superset'),
      })
      .locator('.ant-tree-switcher')
      .click();

    const dashboardServiceNode = page.getByTestId(
      `explore-tree-title-${serviceName}`
    );
    await expect(dashboardServiceNode).toBeVisible();

    await page
      .locator('.ant-tree-treenode', {
        has: page.getByTestId(`explore-tree-title-${serviceName}`),
      })
      .locator('.ant-tree-switcher')
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

  test('Copy field link button should copy the field URL to clipboard for SearchIndex', async ({
    page,
  }) => {
    await searchIndex.visitEntityPage(page);

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-field-link-button',
      containerTestId: 'search-index-fields-table',
      expectedUrlPath: '/searchIndex/',
      entityFqn: searchIndex.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy field link button should copy the field URL to clipboard for APIEndpoint', async ({
    page,
  }) => {
    await apiEndpoint.visitEntityPage(page);

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-field-link-button',
      containerTestId: 'schema-fields-table',
      expectedUrlPath: '/apiEndpoint/',
      entityFqn: apiEndpoint.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy field link should have valid URL format for SearchIndex', async ({
    page,
  }) => {
    await searchIndex.visitEntityPage(page);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(page.getByTestId('search-index-fields-table')).toBeVisible();

    const copyButton = page.getByTestId('copy-field-link-button').first();
    await expect(copyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    const validationResult = validateCopiedLinkFormat({
      clipboardText,
      expectedEntityType: 'searchIndex',
      entityFqn: searchIndex.entityResponseData?.['fullyQualifiedName'] ?? '',
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.protocol).toMatch(/^https?:$/);
    expect(validationResult.pathname).toContain('searchIndex');

    // Visit the copied link to verify it opens the side panel
    await page.goto(clipboardText);

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(
        `/searchIndex/${searchIndex.entityResponseData?.['fullyQualifiedName']}$`
      )
    );
  });

  test('Copy field link should have valid URL format for APIEndpoint', async ({
    page,
  }) => {
    await apiEndpoint.visitEntityPage(page);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(page.getByTestId('schema-fields-table')).toBeVisible();

    const copyButton = page.getByTestId('copy-field-link-button').first();
    await expect(copyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    const validationResult = validateCopiedLinkFormat({
      clipboardText,
      expectedEntityType: 'apiEndpoint',
      entityFqn: apiEndpoint.entityResponseData?.['fullyQualifiedName'] ?? '',
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.protocol).toMatch(/^https?:$/);
    expect(validationResult.pathname).toContain('apiEndpoint');

    // Visit the copied link to verify it opens the side panel
    await page.goto(clipboardText);

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(
        `/apiEndpoint/${apiEndpoint.entityResponseData?.['fullyQualifiedName']}$`
      )
    );
  });

  test('Verify columns are visible in explore tree hierarchy', async ({
    page,
  }) => {
    const serviceName = table.serviceResponseData.name;
    const dbName = table.databaseResponseData.name;
    const schemaName = table.schemaResponseData.name;

    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    await expandServiceInExploreTree(page, serviceName);
    await expandDatabaseInExploreTree(page, dbName);

    const schemaRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*databaseSchema.displayName*'
    );
    await page
      .locator('.ant-tree-treenode')
      .filter({ hasText: schemaName })
      .locator('.ant-tree-switcher svg')
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

  test('Clicking Columns node filters search results to show only columns', async ({
    page,
  }) => {
    const serviceName = table.serviceResponseData.name;
    const dbName = table.databaseResponseData.name;
    const schemaName = table.schemaResponseData.name;

    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    await expandServiceInExploreTree(page, serviceName);
    await expandDatabaseInExploreTree(page, dbName);

    const schemaRes = page.waitForResponse(
      '/api/v1/search/query?q=&index=dataAsset*databaseSchema.displayName*'
    );
    await page
      .locator('.ant-tree-treenode')
      .filter({ hasText: schemaName })
      .locator('.ant-tree-switcher svg')
      .click();
    await schemaRes;

    const filterRes = page.waitForResponse('/api/v1/search/query?*');
    await page.getByTestId('explore-tree-title-tableColumn').click();
    await filterRes;

    const quickFilter = page.getByTestId('search-dropdown-Data Assets');
    await expect(quickFilter).toContainText('tablecolumn');
  });
});
