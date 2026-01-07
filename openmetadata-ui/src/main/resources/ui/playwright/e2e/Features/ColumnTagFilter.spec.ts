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
import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

const table = new TableClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test.describe('Column Tag Filter', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  });

  test('Should filter columns by tag across all pages', async ({ page }) => {
    // Add PII.Sensitive tag to first column on page 1
    const firstColumnName = table.columnsName[0];
    const firstColumnSelector = `[data-row-key$="${firstColumnName}"]`;

    await page.click(
      `${firstColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
    );

    let tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?*index=tag_search_index*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
    await tagSearchResponse;

    await page.click('[data-testid="tag-PII.Sensitive"]');
    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).not.toBeVisible();

    // Wait for tag to be added
    await expect(
      page.locator(
        `${firstColumnSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"]`
      )
    ).toContainText('PII.Sensitive');

    // Navigate to page 2 (if table has enough columns)
    const paginationNext = page.locator('[data-testid="pagination"] .ant-pagination-next');
    const isPaginationVisible = await paginationNext.isVisible();

    if (isPaginationVisible && !(await paginationNext.isDisabled())) {
      await paginationNext.click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

      // Add PII.Sensitive tag to a column on page 2
      const secondPageColumn = table.columnsName[table.columnsName.length - 1];
      const secondColumnSelector = `[data-row-key$="${secondPageColumn}"]`;

      await page.click(
        `${secondColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
      );

      tagSearchResponse = page.waitForResponse(
        '/api/v1/search/query?*index=tag_search_index*'
      );
      await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
      await tagSearchResponse;

      await page.click('[data-testid="tag-PII.Sensitive"]');
      await expect(
        page.locator('[data-testid="tag-selector"] > .ant-select-selector')
      ).not.toBeVisible();

      // Wait for tag to be added
      await expect(
        page.locator(
          `${secondColumnSelector} [data-testid="classification-tags-0"] [data-testid="tags-container"]`
        )
      ).toContainText('PII.Sensitive');
    }

    // Now test the filter - navigate back to page 1
    const paginationPrev = page.locator('[data-testid="pagination"] .ant-pagination-prev');
    if (await paginationPrev.isVisible() && !(await paginationPrev.isDisabled())) {
      await paginationPrev.click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    }

    // Open the tag filter
    await page.click('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger');
    
    // Wait for filter dropdown to be visible
    await page.waitForSelector('.ant-dropdown:visible');

    // Select PII.Sensitive in the filter
    const filterResponse = page.waitForResponse(
      (response) => 
        response.url().includes('/columns/search') && 
        response.url().includes('tags=PII.Sensitive')
    );
    
    await page.click('text=Pii Sensitive');
    await filterResponse;

    // Wait for filtered results to load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify that only columns with PII.Sensitive tag are shown
    const visibleRows = await page.locator('[data-testid="entity-table"] tbody tr').count();
    
    // All visible rows should have the PII.Sensitive tag
    for (let i = 0; i < visibleRows; i++) {
      const row = page.locator('[data-testid="entity-table"] tbody tr').nth(i);
      await expect(row.locator('[data-testid="classification-tags-0"]')).toContainText('PII.Sensitive');
    }

    // Verify the filter is active (filter icon should be highlighted)
    await expect(
      page.locator('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger-container-open')
    ).toBeVisible();
  });

  test('Should filter columns by multiple tags with OR logic', async ({ page }) => {
    // Add PII.Sensitive tag to first column
    const firstColumnName = table.columnsName[0];
    const firstColumnSelector = `[data-row-key$="${firstColumnName}"]`;

    await page.click(
      `${firstColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
    );

    let tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?*index=tag_search_index*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
    await tagSearchResponse;

    await page.click('[data-testid="tag-PII.Sensitive"]');
    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).not.toBeVisible();

    // Add PII.None tag to second column
    if (table.columnsName.length > 1) {
      const secondColumnName = table.columnsName[1];
      const secondColumnSelector = `[data-row-key$="${secondColumnName}"]`;

      await page.click(
        `${secondColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
      );

      tagSearchResponse = page.waitForResponse(
        '/api/v1/search/query?*index=tag_search_index*'
      );
      await page.fill('[data-testid="tag-selector"] input', 'None');
      await tagSearchResponse;

      await page.click('[data-testid="tag-PII.None"]');
      await expect(
        page.locator('[data-testid="tag-selector"] > .ant-select-selector')
      ).not.toBeVisible();
    }

    // Open the tag filter
    await page.click('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger');
    
    // Wait for filter dropdown
    await page.waitForSelector('.ant-dropdown:visible');

    // Select both PII.Sensitive and PII.None
    const filterResponse = page.waitForResponse(
      (response) => 
        response.url().includes('/columns/search') && 
        response.url().includes('tags=')
    );
    
    await page.click('text=Pii Sensitive');
    await page.click('text=Pii None');
    await filterResponse;

    // Wait for filtered results
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify that columns with either PII.Sensitive or PII.None are shown
    const visibleRows = await page.locator('[data-testid="entity-table"] tbody tr').count();
    expect(visibleRows).toBeGreaterThanOrEqual(2); // At least the two columns we tagged

    // Each visible row should have either PII.Sensitive or PII.None
    for (let i = 0; i < visibleRows; i++) {
      const row = page.locator('[data-testid="entity-table"] tbody tr').nth(i);
      const tagsText = await row.locator('[data-testid="classification-tags-0"]').textContent();
      expect(tagsText).toMatch(/PII\.Sensitive|PII\.None/);
    }
  });

  test('Should clear tag filter and show all columns', async ({ page }) => {
    // Add a tag first
    const firstColumnName = table.columnsName[0];
    const firstColumnSelector = `[data-row-key$="${firstColumnName}"]`;

    await page.click(
      `${firstColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
    );

    const tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?*index=tag_search_index*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
    await tagSearchResponse;

    await page.click('[data-testid="tag-PII.Sensitive"]');
    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).not.toBeVisible();

    // Apply filter
    await page.click('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger');
    await page.waitForSelector('.ant-dropdown:visible');

    let filterResponse = page.waitForResponse(
      (response) => 
        response.url().includes('/columns/search') && 
        response.url().includes('tags=PII.Sensitive')
    );
    
    await page.click('text=Pii Sensitive');
    await filterResponse;
    await page.waitForLoadState('networkidle');

    // Get count of filtered rows
    const filteredRowCount = await page.locator('[data-testid="entity-table"] tbody tr').count();

    // Clear the filter
    await page.click('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger');
    await page.waitForSelector('.ant-dropdown:visible');

    filterResponse = page.waitForResponse(
      (response) => 
        response.url().includes('/columns') && 
        !response.url().includes('tags=')
    );
    
    // Uncheck the filter
    await page.click('text=Pii Sensitive');
    await filterResponse;
    await page.waitForLoadState('networkidle');

    // Verify all columns are shown again
    const allRowCount = await page.locator('[data-testid="entity-table"] tbody tr').count();
    expect(allRowCount).toBeGreaterThan(filteredRowCount);
  });

  test('Should combine tag filter with search', async ({ page }) => {
    // Add a tag to a column
    const firstColumnName = table.columnsName[0];
    const firstColumnSelector = `[data-row-key$="${firstColumnName}"]`;

    await page.click(
      `${firstColumnSelector} [data-testid="classification-tags-0"] [data-testid="add-tag"]`
    );

    const tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?*index=tag_search_index*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
    await tagSearchResponse;

    await page.click('[data-testid="tag-PII.Sensitive"]');
    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).not.toBeVisible();

    // Apply tag filter
    await page.click('[data-testid="entity-table"] thead th:has-text("Tags") .ant-table-filter-trigger');
    await page.waitForSelector('.ant-dropdown:visible');

    let filterResponse = page.waitForResponse(
      (response) => 
        response.url().includes('/columns/search') && 
        response.url().includes('tags=PII.Sensitive')
    );
    
    await page.click('text=Pii Sensitive');
    await filterResponse;
    await page.waitForLoadState('networkidle');

    // Now apply search filter
    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/columns/search') &&
        response.url().includes(`q=${firstColumnName}`) &&
        response.url().includes('tags=PII.Sensitive')
    );
    
    await page.getByTestId('searchbar').fill(firstColumnName);
    await searchResponse;
    await page.waitForLoadState('networkidle');

    // Verify only the specific column is shown
    const visibleRows = await page.locator('[data-testid="entity-table"] tbody tr').count();
    expect(visibleRows).toBe(1);

    // Verify it's the correct column
    await expect(
      page.locator(`[data-row-key$="${firstColumnName}"]`)
    ).toBeVisible();
  });
});
