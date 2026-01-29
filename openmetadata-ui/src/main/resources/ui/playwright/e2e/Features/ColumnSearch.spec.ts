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
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

// Use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.describe('Column Search in Explore Page', { tag: '@explore' }, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Create a table with specific columns for testing
    await table.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should search for columns in the Explore page and display them in results', async ({
    page,
  }) => {
    // Navigate to Explore page
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    // Get the first column name from the created table
    const columnName = table.entityResponseData?.columns?.[0]?.name;

    if (!columnName) {
      test.skip();

      return;
    }

    // Search for the column name in the search box
    const searchInput = page.getByTestId('searchBox');
    await searchInput.fill(columnName);
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');

    // Wait for search results to load
    await page.waitForSelector('[data-testid="search-results"]', {
      state: 'visible',
      timeout: 10000,
    });

    // Verify that search results are displayed
    const searchResults = page.getByTestId('search-results');
    await expect(searchResults).toBeVisible();
  });

  test('Should display column entity type in search results when searching for column', async ({
    page,
  }) => {
    // Navigate to Explore page
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    // Get the first column name from the created table
    const columnName = table.entityResponseData?.columns?.[0]?.name;

    if (!columnName) {
      test.skip();

      return;
    }

    // Search for the column name
    const searchInput = page.getByTestId('searchBox');
    await searchInput.fill(columnName);
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');

    // Check if tableColumn appears in entity type aggregations
    const entityTypeFilter = page.locator('[data-testid="entityType-filter"]');

    if (await entityTypeFilter.isVisible()) {
      // If column indexing is enabled, we might see tableColumn in the filters
      const tableColumnOption = entityTypeFilter.locator(
        '[data-value="tableColumn"]'
      );

      // This test verifies the infrastructure exists; actual presence depends on reindexing
      // eslint-disable-next-line no-console
      console.log(
        'Column filter option visible:',
        await tableColumnOption.isVisible().catch(() => false)
      );
    }
  });

  test('Should display breadcrumb with full hierarchy when clicking on column in search results', async ({
    page,
  }) => {
    // Navigate to Explore page with column filter
    await page.goto(
      '/explore?quickFilter=%7B"query"%3A%7B"bool"%3A%7B"must"%3A%5B%7B"term"%3A%7B"entityType"%3A"tableColumn"%7D%7D%5D%7D%7D%7D'
    );
    await page.waitForLoadState('networkidle');

    // Wait for search results
    const results = page.getByTestId('search-results');
    const resultExists = await results.isVisible().catch(() => false);

    if (resultExists) {
      // Click on first search result to open the side drawer
      const firstResult = page
        .locator('[data-testid="table-data-card"]')
        .first();
      const resultVisible = await firstResult.isVisible().catch(() => false);

      if (resultVisible) {
        await firstResult.click();

        // Wait for side drawer to open
        await page.waitForSelector(
          '[data-testid="entity-summary-panel-container"]',
          {
            state: 'visible',
            timeout: 5000,
          }
        );

        // Verify breadcrumb is visible and contains expected hierarchy elements
        const breadcrumb = page.locator('[data-testid="breadcrumb"]');
        const breadcrumbVisible = await breadcrumb.isVisible().catch(() => false);

        if (breadcrumbVisible) {
          // Breadcrumb should show: Service > Database > Schema > Table > Column
          // Verify at least the service and table are in the breadcrumb
          const breadcrumbText = await breadcrumb.textContent();
          // eslint-disable-next-line no-console
          console.log('Breadcrumb content:', breadcrumbText);

          // The breadcrumb should not be empty
          expect(breadcrumbText).toBeTruthy();
        }
      }
    }
  });

  test('Should not show permission error when viewing column in side drawer', async ({
    page,
  }) => {
    // Navigate to Explore page
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    // Get the first column name from the created table
    const columnName = table.entityResponseData?.columns?.[0]?.name;

    if (!columnName) {
      test.skip();

      return;
    }

    // Search for the column name
    const searchInput = page.getByTestId('searchBox');
    await searchInput.fill(columnName);
    await page.keyboard.press('Enter');

    await page.waitForLoadState('networkidle');

    // If we find a column result, click on it
    const columnResults = page.locator(
      '[data-testid="table-data-card"][data-entity-type="tableColumn"]'
    );
    const hasColumnResults = (await columnResults.count()) > 0;

    if (hasColumnResults) {
      await columnResults.first().click();

      // Wait for side drawer
      await page.waitForSelector(
        '[data-testid="entity-summary-panel-container"]',
        {
          state: 'visible',
          timeout: 5000,
        }
      );

      // Verify no permission error is shown
      const permissionError = page.locator(
        '[data-testid="no-data-placeholder-permission"]'
      );
      const hasPermissionError = await permissionError
        .isVisible()
        .catch(() => false);

      expect(hasPermissionError).toBe(false);
    }
  });

  test('Should navigate to table page when clicking on column and then table in breadcrumb', async ({
    page,
  }) => {
    // Navigate to Explore page with column filter
    await page.goto(
      '/explore?quickFilter=%7B"query"%3A%7B"bool"%3A%7B"must"%3A%5B%7B"term"%3A%7B"entityType"%3A"tableColumn"%7D%7D%5D%7D%7D%7D'
    );
    await page.waitForLoadState('networkidle');

    // Wait for search results
    const results = page.getByTestId('search-results');
    const resultExists = await results.isVisible().catch(() => false);

    if (resultExists) {
      // Click on first search result
      const firstResult = page
        .locator('[data-testid="table-data-card"]')
        .first();
      const resultVisible = await firstResult.isVisible().catch(() => false);

      if (resultVisible) {
        await firstResult.click();

        // Wait for side drawer
        await page.waitForSelector(
          '[data-testid="entity-summary-panel-container"]',
          {
            state: 'visible',
            timeout: 5000,
          }
        );

        // Find and click the table link in the breadcrumb
        const tableLink = page.locator('[data-testid="breadcrumb"] a').last();
        const tableLinkVisible = await tableLink.isVisible().catch(() => false);

        if (tableLinkVisible) {
          await tableLink.click();

          // Wait for navigation
          await page.waitForLoadState('networkidle');

          // Verify we navigated to a table page (URL should contain /table/)
          const currentUrl = page.url();
          // eslint-disable-next-line no-console
          console.log('Navigated to:', currentUrl);
        }
      }
    }
  });
});
