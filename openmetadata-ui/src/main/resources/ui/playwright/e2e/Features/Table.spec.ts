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
import { expect } from '@playwright/test';
import { Table } from '../../../src/generated/entity/data/table';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import {
  assignTagToChildren,
  copyAndGetClipboardText,
  getFirstRowColumnLink,
  removeTagsFromChildren,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

const table1 = new TableClass();

test.describe('Table pagination sorting search scenarios ', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);
    await table1.create(apiContext);

    for (let i = 0; i < 30; i++) {
      await table1.createTestCase(apiContext);
    }

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ dataConsumerPage: page }) => {
    await redirectToHomePage(page);
  });

  test('Table pagination with sorting should works', async ({
    dataConsumerPage: page,
  }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="test-cases"]');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.getByText('Name', { exact: true }).click();

    await page.getByTestId('next').click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    expect(await page.locator('.ant-table-row').count()).toBe(15);
  });

  test('Table search with sorting should work', async ({
    dataConsumerPage: page,
  }) => {
    const listTestCasesResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*'
    );
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="test-cases"]');

    await listTestCasesResponse;
    await page.waitForSelector(
      '[data-testid="test-case-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    await page.getByText('Name', { exact: true }).click();
    await page.getByTestId('searchbar').click();

    const testSearchResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?*q=%2Atemp-test-case%2A*`
    );

    await page.getByTestId('searchbar').fill('temp-test-case');

    await testSearchResponse;
    await page.waitForSelector(
      '[data-testid="test-case-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table filter with sorting should work', async ({
    dataConsumerPage: page,
  }) => {
    const listTestCasesResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*'
    );
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="test-cases"]');

    await listTestCasesResponse;
    await page.waitForSelector(
      '[data-testid="test-case-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    await page.getByText('Name', { exact: true }).click();

    await page.getByTestId('status-select-filter').locator('div').click();

    const filteredResults = page.waitForResponse(
      '/api/v1/dataQuality/testCases/search/list?*testCaseStatus=Queued*'
    );

    await page.getByTitle('Queued').locator('div').click();

    await filteredResults;
    await page.waitForSelector(
      '[data-testid="test-case-container"] [data-testid="loader"]',
      { state: 'detached' }
    );

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table page should show schema tab with count', async ({
    dataConsumerPage: page,
  }) => {
    await table1.visitEntityPage(page);

    const count = table1.entity.columns.length;

    await expect(page.getByRole('tab', { name: 'Columns' })).toContainText(
      `${count}`
    );
  });

  test('should persist current page', async ({ dataConsumerPage: page }) => {
    await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('databaseSchema-tables')).toBeVisible();

    await page.getByTestId('next').click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const initialPageIndicator = await page
      .locator('[data-testid="page-indicator"]')
      .textContent();

    // First navigation - click on first table link
    const firstLinkInColumn = getFirstRowColumnLink(page);
    await firstLinkInColumn.click();

    await page.waitForURL('**/table/**');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.goBack({
      waitUntil: 'networkidle',
    });

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify page indicator is still the same after first navigation
    const pageIndicatorAfterFirstBack = await page
      .locator('[data-testid="page-indicator"]')
      .textContent();

    expect(pageIndicatorAfterFirstBack).toBe(initialPageIndicator);

    // Second navigation - click on second table link
    const secondLinkInColumn = getFirstRowColumnLink(page);
    await secondLinkInColumn.click();

    await page.waitForURL('**/table/**');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.goBack({
      waitUntil: 'networkidle',
    });

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify page indicator is still the same after second navigation
    const pageIndicatorAfterSecondBack = await page
      .locator('[data-testid="page-indicator"]')
      .textContent();

    expect(pageIndicatorAfterSecondBack).toBe(initialPageIndicator);
  });

  test('should persist page size', async ({ dataConsumerPage: page }) => {
    await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('databaseSchema-tables')).toBeVisible();

    await page
      .getByTestId('page-size-selection-dropdown')
      .scrollIntoViewIfNeeded();
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.waitForSelector('.ant-dropdown', { state: 'visible' });

    await expect(
      page.getByRole('menuitem', { name: '15 / Page' })
    ).toBeVisible();

    await page.getByRole('menuitem', { name: '15 / Page' }).click();
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const linkInColumn = getFirstRowColumnLink(page);
    const entityApiResponse = page.waitForResponse(
      '/api/v1/permissions/table/name/*'
    );
    await linkInColumn.click();

    await entityApiResponse;
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    await page
      .getByTestId('page-size-selection-dropdown')
      .scrollIntoViewIfNeeded();

    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
      '15 / Page'
    );
  });
});

test.describe('Table & Data Model columns table pagination', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  test('expand collapse should only visible for nested columns', async ({
    page,
  }) => {
    await page.goto('/table/sample_data.ecommerce_db.shopify.dim_customer');

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Should show expand icon for nested columns
    expect(
      page
        .locator(
          '[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.shipping_address"]'
        )
        .getByTestId('expand-icon')
    ).toBeVisible();

    // Should not show expand icon for non-nested columns
    expect(
      page
        .locator(
          '[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.customer_id"]'
        )
        .getByTestId('expand-icon')
    ).not.toBeVisible();

    // Should not show expand icon for non-nested columns
    expect(
      page
        .locator(
          '[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.shop_id"]'
        )
        .getByTestId('expand-icon')
    ).not.toBeVisible();

    // verify column profile table
    await page.getByRole('tab', { name: 'Data Observability' }).click();
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const colsResponse = page.waitForResponse(
      '/api/v1/tables/name/*/columns?*'
    );
    await page.getByRole('tab', { name: 'Column Profile' }).click();

    await colsResponse;
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Should show expand icon for nested columns
    expect(
      page
        .locator('[data-row-key="shipping_address"]')
        .getByTestId('expand-icon')
    ).toBeVisible();

    // Should not show expand icon for non-nested columns
    expect(
      page.locator('[data-row-key="customer_id"]').getByTestId('expand-icon')
    ).not.toBeVisible();

    // Should not show expand icon for non-nested columns
    expect(
      page.locator('[data-row-key="shop_id"]').getByTestId('expand-icon')
    ).not.toBeVisible();
  });

  test('expand / collapse should not appear after updating nested fields table', async ({
    page,
  }) => {
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await assignTagToChildren({
      page,
      tag: 'PersonalData.Personal',
      rowId:
        'sample_data.ecommerce_db.shopify.performance_test_table.test_col_0044',
      entityEndpoint: 'tables',
    });

    // Should not show expand icon for non-nested columns
    expect(
      page
        .locator(
          '[data-row-key="sample_data.ecommerce_db.shopify.performance_test_table.test_col_0044"]'
        )
        .getByTestId('expand-icon')
    ).not.toBeVisible();

    await removeTagsFromChildren({
      page,
      tags: ['PersonalData.Personal'],
      rowId:
        'sample_data.ecommerce_db.shopify.performance_test_table.test_col_0044',
      entityEndpoint: 'tables',
    });
  });
});

test.describe(
  'Tags and glossary terms should be consistent for search ', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const testClassification = new ClassificationClass();
    const testTag = new TagClass({
      classification: testClassification.data.name,
    });

    test.beforeAll(async ({ browser }) => {
      const { apiContext } = await performAdminLogin(browser);

      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await testClassification.create(apiContext);
      await testTag.create(apiContext);
    });

    test('Glossary term should be consistent for search', async ({
      dataConsumerPage: page,
    }) => {
      const columnsResponse = page.waitForResponse(
        '/api/v1/tables/name/sample_data.ecommerce_db.shopify.dim_customer/columns?*fields=tags*&include=all*'
      );

      // Go to tables page
      await page.goto('/table/sample_data.ecommerce_db.shopify.dim_customer');

      // Wait for page to be fully loaded
      await columnsResponse;
      await waitForAllLoadersToDisappear(page);

      // Check if add button exists and is visible
      const rowSelector =
        '[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.customer_id"] [data-testid*="glossary-tags"]';

      const addButton = await page.$(`${rowSelector} [data-testid="add-tag"]`);
      if (addButton && (await addButton.isVisible())) {
        await addButton.click();
      } else {
        await page
          .locator(`${rowSelector} [data-testid="edit-button"]`)
          .click();
      }

      await page.waitForSelector('.ant-select-dropdown', { state: 'visible' });
      await page.waitForSelector(
        '.ant-select-dropdown [data-testid="loader"]',
        {
          state: 'detached',
        }
      );

      await page
        .locator('[data-testid="tag-selector"] input')
        .fill(glossaryTerm.data.name);

      await page
        .getByTestId(`tag-${glossaryTerm.responseData.fullyQualifiedName}`)
        .click();
      const saveResponse = page.waitForResponse('api/v1/columns/name/*');
      await page.getByTestId('saveAssociatedTag').click();

      await saveResponse;

      await expect(
        page.getByTestId(`tag-${glossaryTerm.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      const searchRequest = page.waitForResponse(
        'api/v1/tables/name/sample_data.ecommerce_db.shopify.dim_customer/columns/*'
      );

      await page
        .getByTestId('search-bar-container')
        .getByTestId('searchbar')
        .fill('customer_id');

      await searchRequest;
      await page.waitForSelector(
        '[data-testid="entity-table"] [data-testid="loader"]',
        {
          state: 'detached',
        }
      );

      await expect(
        page
          .getByTestId('glossary-tags-0')
          .getByTestId(`tag-${glossaryTerm.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await page.click(`${rowSelector} [data-testid="edit-button"]`);

      await page.waitForSelector('.ant-select-dropdown', { state: 'visible' });
      await page.waitForSelector(
        '.ant-select-dropdown [data-testid="loader"]',
        {
          state: 'detached',
        }
      );
      await page
        .locator('[data-testid="tag-selector"] input')
        .fill(glossaryTerm.data.name);

      await page
        .locator('.ant-select-dropdown')
        .getByTestId(`tag-${glossaryTerm.responseData.fullyQualifiedName}`)
        .click();

      await page.getByTestId('saveAssociatedTag').click();

      await page.waitForResponse('api/v1/columns/name/*');

      await expect(
        page.getByTestId(`tag-${glossaryTerm.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();
    });

    test('Tags term should be consistent for search', async ({
      dataConsumerPage: page,
    }) => {
      const columnsResponse = page.waitForResponse(
        '/api/v1/tables/name/sample_data.ecommerce_db.shopify.dim_customer/columns?*fields=tags*&include=all*'
      );

      await page.goto('/table/sample_data.ecommerce_db.shopify.dim_customer');

      // Wait for page to be fully loaded
      await columnsResponse;
      await waitForAllLoadersToDisappear(page);

      // Check if add button exists and is visible
      const rowSelector =
        '[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.shop_id"] [data-testid*="classification-tags"]';

      const addButton = await page.$(`${rowSelector} [data-testid="add-tag"]`);
      if (addButton && (await addButton.isVisible())) {
        await addButton.click();
      } else {
        await page.click(`${rowSelector} [data-testid="edit-button"]`);
      }

      await page.waitForSelector(
        '.ant-select-dropdown:visible [data-testid="loader"]',
        {
          state: 'detached',
        }
      );
      await page
        .locator('[data-testid="tag-selector"] input')
        .fill(testTag.data.name);
      await page
        .locator('.ant-select-dropdown')
        .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
        .click();

      await page.getByTestId('saveAssociatedTag').click();

      await page.waitForResponse('api/v1/columns/name/*');

      await expect(
        page.getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      page.reload();
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      const getRequest = page.waitForResponse(
        'api/v1/tables/name/sample_data.ecommerce_db.shopify.dim_customer/columns/*'
      );
      await page
        .getByTestId('search-bar-container')
        .getByTestId('searchbar')
        .fill('shop_id');

      await getRequest;

      await expect(
        page
          .getByTestId('classification-tags-0')
          .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
      ).toBeVisible();

      await page.click(
        `[data-row-key="sample_data.ecommerce_db.shopify.dim_customer.shop_id"] [data-testid="classification-tags-0"] [data-testid="edit-button"]`
      );

      await page.waitForSelector('.ant-select-dropdown', { state: 'visible' });
      await page.waitForSelector(
        '.ant-select-dropdown [data-testid="loader"]',
        {
          state: 'detached',
        }
      );
      await page
        .locator('[data-testid="tag-selector"] input')
        .fill(testTag.data.name);
      await page
        .locator('.ant-select-dropdown')
        .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
        .click();

      await page.getByTestId('saveAssociatedTag').click();

      await page.waitForResponse('api/v1/columns/name/*');

      await expect(
        page
          .getByTestId('classification-tags-0')
          .getByTestId(`tag-${testTag.responseData.fullyQualifiedName}`)
      ).not.toBeVisible();
    });
  }
);

test.describe('Large Table Column Search & Copy Link', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  test.use({
    contextOptions: {
      permissions: ['clipboard-read', 'clipboard-write'],
    },
  });

  const largeTable = new TableClass();
  const largeTableName = `large_table_${uuid()}`;
  const targetColumnName = 'test_col_071';
  let createdTable: Table;

  test.beforeAll('Setup large table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create base hierarchy (service, db, schema) - assuming create() does this
    await largeTable.create(apiContext);

    // Generate columns
    const columns = [];
    // Create modest number of columns to ensure pagination/search is active
    for (let i = 0; i < 50; i++) {
      columns.push({
        name: `extra_col_${i}`,
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: `Extra column ${i}`,
      });
    }
    // Add the target column
    columns.push({
      name: targetColumnName,
      dataType: 'VARCHAR',
      dataLength: 100,
      dataTypeDisplay: 'varchar',
      description: 'Target column for search test',
    });

    // Create table with these columns using createAdditionalTable
    // Note: TableClass.createAdditionalTable merges provided data with default entity structure
    createdTable = await largeTable.createAdditionalTable(
      {
        name: largeTableName,
        displayName: largeTableName,
        columns: columns,
      },
      apiContext
    );

    await afterAction();
  });

  test('Search for column, copy link, and verify side panel behavior', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    const columnsResponse = page.waitForResponse(
      `/api/v1/tables/name/${createdTable.fullyQualifiedName}/columns?*`
    );
    // 1. Visit the table page directly
    await page.goto(`/table/${createdTable.fullyQualifiedName}`);
    await columnsResponse;
    await waitForAllLoadersToDisappear(page);

    // Ensure entity table is visible
    await expect(page.getByTestId('entity-table')).toBeVisible();

    // 2. Search for the specific column
    const searchBar = page.getByTestId('searchbar');
    await searchBar.waitFor({ state: 'visible' });
    const columnSearchResponse = page.waitForResponse(
      `/api/v1/tables/name/${createdTable.fullyQualifiedName}/columns/search?*${targetColumnName}*`
    );
    await searchBar.fill(targetColumnName);
    await columnSearchResponse;

    // Wait for search results filters the rows
    // We look for the row with our target column key
    const rowSelector = page.locator(
      `[data-row-key="${createdTable.fullyQualifiedName}.${targetColumnName}"]`
    );
    await rowSelector.waitFor({ state: 'visible' });

    // 3. Click "Copy Link" for that column
    const copyButton = rowSelector.getByTestId('copy-column-link-button');

    // 4. Read clipboard
    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    // Verify URL format structure
    expect(clipboardText).toContain(
      `/table/${createdTable.fullyQualifiedName}`
    );
    expect(clipboardText).toContain(targetColumnName);

    // 5. Visit the copied Link
    const visitLinkResponse = page.waitForResponse((response) =>
      response.url().includes(`/table/${createdTable.fullyQualifiedName}`)
    );
    await page.goto(clipboardText);
    await visitLinkResponse;
    await waitForAllLoadersToDisappear(page);

    // 6. Verify Side Panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Verify title in side panel matches column name
    await expect(sidePanel).toContainText(targetColumnName);

    // 7. Verify URL Cleanup on Close
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL reverts to base table URL
    await expect(page).toHaveURL(
      new RegExp(`/table/${createdTable.fullyQualifiedName}$`)
    );
  });
});

test.describe('dbt Tab Visibility for Seed Files', () => {
  const tableWithDbtData = new TableClass();

  test.beforeAll('Setup table with dbt dataModel', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a table
    await tableWithDbtData.create(apiContext);

    await afterAction();
  });

  test('should show dbt tab if only path is present', async ({ page }) => {
    await redirectToHomePage(page);

    // Intercept the table API call to add dataModel field to save test time
    // Since dataModel can only be added through ingestion
    await page.route(
      '**/api/v1/tables/name/**?fields=columns*dataModel*',
      async (route) => {
        const response = await route.fetch();
        const json = await response.json();

        // Add the dataModel field to the response
        json.dataModel = {
          modelType: 'DBT',
          resourceType: 'seed',
          path: 'seeds/sample_seed.csv',
        };

        await route.fulfill({
          response,
          json,
        });
      }
    );

    // Visit the table page
    await tableWithDbtData.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    // Verify dbt tab is visible
    const dbtTab = page.getByTestId('dbt');
    await expect(dbtTab).toBeVisible();

    // Click on dbt tab
    await dbtTab.click();
    await waitForAllLoadersToDisappear(page);

    // Verify path is displayed
    await expect(page.getByText('seeds/sample_seed.csv')).toBeVisible();

    // Verify SQL-related elements are NOT visible since this is a seed file (no SQL query)
    await expect(page.getByTestId('query-line')).not.toBeVisible();
    await expect(
      page.getByTestId('query-entity-copy-button')
    ).not.toBeVisible();
  });

  test('should show dbt tab if only source project is present', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    // Intercept the table API call to add dataModel field to save test time
    // Since dataModel can only be added through ingestion
    await page.route(
      '**/api/v1/tables/name/**?fields=columns*dataModel*',
      async (route) => {
        const response = await route.fetch();
        const json = await response.json();

        // Add the dataModel field to the response
        json.dataModel = {
          modelType: 'DBT',
          resourceType: 'seed',
          dbtSourceProject: 'test_dbt_project',
        };

        await route.fulfill({
          response,
          json,
        });
      }
    );

    // Visit the table page
    await tableWithDbtData.visitEntityPage(page);
    await waitForAllLoadersToDisappear(page);

    // Verify dbt tab is visible
    const dbtTab = page.getByTestId('dbt');
    await expect(dbtTab).toBeVisible();

    // Click on dbt tab
    await dbtTab.click();
    await waitForAllLoadersToDisappear(page);

    // Verify dbt Source Project info is displayed
    await expect(page.getByTestId('dbt-source-project-id')).toContainText(
      'test_dbt_project'
    );

    // Verify SQL-related elements are NOT visible since this is a seed file (no SQL query)
    await expect(page.getByTestId('query-line')).not.toBeVisible();
    await expect(
      page.getByTestId('query-entity-copy-button')
    ).not.toBeVisible();
  });
});
