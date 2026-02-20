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
import { DATA_ASSETS } from '../../constant/explore';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TagClass } from '../../support/tag/TagClass';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  copyAndGetClipboardText,
  testCopyLinkButton,
  updateDisplayNameForEntity,
  validateCopiedLinkFormat,
} from '../../utils/entity';
import {
  Bucket,
  validateBucketsForIndex,
  validateBucketsForIndexAndSort,
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

  test('Verify Database and Database Schema available in explore tree', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const table1 = new TableClass();
    const table2 = new TableClass();

    try {
      await table1.create(apiContext);
      await table2.create(apiContext);

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
    } finally {
      await table1.delete(apiContext);
      await table2.delete(apiContext);
      await afterAction();
    }
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
      await table.visitEntityPage(page);

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

    await table.delete(apiContext);
    await afterAction();
  });
});

test.describe('Explore page', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  const table = new TableClass();
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const dashboard = new DashboardClass();
  const chart = new ChartClass();
  const storedProcedure = new StoredProcedureClass();
  const pipeline = new PipelineClass();
  const container = new ContainerClass();
  const apiEndpoint = new ApiEndpointClass();
  const topic = new TopicClass();
  const searchIndex = new SearchIndexClass();
  const dashboardDataModel = new DashboardDataModelClass();
  const mlModel = new MlModelClass();
  const database = new DatabaseClass();
  const databaseSchema = new DatabaseSchemaClass();
  const directory = new DirectoryClass();
  const file = new FileClass();
  const spreadsheet = new SpreadsheetClass();
  const worksheet = new WorksheetClass();
  const metric = new MetricClass();
  const domain = new Domain();
  const dataProduct = new DataProduct([domain]);
  const tag = new TagClass({
    classification: 'Certification',
  });

  test.beforeEach('Setup pre-requisits', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    await table.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await dashboard.create(apiContext);
    await chart.create(apiContext);
    await storedProcedure.create(apiContext);
    await pipeline.create(apiContext);
    await container.create(apiContext);
    await apiEndpoint.create(apiContext);
    await topic.create(apiContext);
    await searchIndex.create(apiContext);
    await dashboardDataModel.create(apiContext);
    await mlModel.create(apiContext);
    await database.create(apiContext);
    await databaseSchema.create(apiContext);
    await domain.create(apiContext);
    await metric.create(apiContext);
    await dataProduct.create(apiContext);
    await tag.create(apiContext);
    await directory.create(apiContext);
    await file.create(apiContext);
    await spreadsheet.create(apiContext);
    await worksheet.create(apiContext);
    await afterAction();
  });

  test.afterEach('Cleanup', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    await table.delete(apiContext);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await dashboard.delete(apiContext);
    await chart.delete(apiContext);
    await storedProcedure.delete(apiContext);
    await pipeline.delete(apiContext);
    await container.delete(apiContext);
    await apiEndpoint.delete(apiContext);
    await topic.delete(apiContext);
    await searchIndex.delete(apiContext);
    await dashboardDataModel.delete(apiContext);
    await mlModel.delete(apiContext);
    await database.delete(apiContext);
    await databaseSchema.delete(apiContext);
    await metric.delete(apiContext);
    await domain.delete(apiContext);
    await dataProduct.delete(apiContext);
    await tag.delete(apiContext);
    await directory.delete(apiContext);
    await file.delete(apiContext);
    await spreadsheet.delete(apiContext);
    await worksheet.delete(apiContext);
    await afterAction();
  });

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

  DATA_ASSETS.forEach((asset) => {
    test.fixme(
      `Check listing of ${asset.key} when sort is descending`,
      async ({ page }) => {
        const { apiContext } = await getApiContext(page);

        const searchBox = page.getByTestId('searchBox');
        await searchBox.fill('pw');
        await searchBox.press('Enter');

        const response = await apiContext
          .get(
            `/api/v1/search/query?q=pw&index=dataAsset&from=0&size=0&deleted=false&track_total_hits=true&fetch_source=false`
          )
          .then((res) => res.json());

        const buckets =
          response.aggregations?.['sterms#entityType']?.buckets ?? [];

        const assetDocCount = buckets.find(
          (b: Bucket) => b.key === asset.key
        )?.doc_count;

        if (assetDocCount > 0) {
          const tab = page.getByTestId(`${asset.label}-tab`);
          await tab.click();
          await validateBucketsForIndexAndSort(page, asset, assetDocCount);
        } else {
          await expect(
            page.getByTestId(`${asset.label}-tab`)
          ).not.toBeVisible();
        }
      }
    );
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
});
