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
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { getFirstRowColumnLink } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const table1 = new TableClass();

test.slow(true);

test.describe('Table pagination sorting search scenarios ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);
    await table1.create(apiContext);

    for (let i = 0; i < 17; i++) {
      await table1.createTestCase(apiContext);
    }

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);
    await table1.delete(apiContext);

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

    expect(await page.locator('.ant-table-row').count()).toBe(15);
  });

  test('Table search with sorting should works', async ({
    dataConsumerPage: page,
  }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="test-cases"]');
    await page.getByText('Name', { exact: true }).click();
    await page.getByTestId('searchbar').click();
    await page.getByTestId('searchbar').fill('temp-test-case');

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table filter with sorting should works', async ({
    dataConsumerPage: page,
  }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.waitForLoadState('networkidle');
    await page.click('[data-testid="test-cases"]');

    const listTestCaseResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?**`
    );

    await page.getByText('Name', { exact: true }).click();

    await listTestCaseResponse;

    await page.getByTestId('status-select-filter').locator('div').click();

    const response = page.waitForResponse(
      '/api/v1/dataQuality/testSuites/dataQualityReport?q=*'
    );

    await page.getByTitle('Queued').locator('div').click();

    await response;
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table page should show schema tab with count', async ({
    dataConsumerPage: page,
  }) => {
    await table1.visitEntityPage(page);

    await expect(page.getByRole('tab', { name: 'Columns' })).toContainText('4');
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

test.describe('Table & Data Model columns table pagination', () => {
  test('pagination for table column should work', async ({
    dataConsumerPage: page,
  }) => {
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Check for column count
    expect(page.getByTestId('schema').getByTestId('filter-count')).toHaveText(
      '2000'
    );

    // 50 Row + 1 Header row
    expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(51);

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 40`);

    await page.getByTestId('next').click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 2 of 40`);

    expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(51);

    await page.getByTestId('previous').click();

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 40`);

    // Change page size to 15
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '15 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // 15 Row + 1 Header row
    expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(16);

    // Change page size to 25
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '25 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // 25 Row + 1 Header row
    expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(26);
  });

  test('pagination for dashboard data model columns should work', async ({
    dataConsumerPage: page,
  }) => {
    await page.goto(
      '/dashboardDataModel/sample_superset.model.big_analytics_data_model_with_nested_columns'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // 50 Row + 1 Header row
    expect(
      page.getByTestId('data-model-column-table').getByRole('row')
    ).toHaveCount(51);

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 36`);

    await page.getByTestId('next').click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 2 of 36`);

    expect(
      page.getByTestId('data-model-column-table').getByRole('row')
    ).toHaveCount(51);

    await page.getByTestId('previous').click();

    expect(page.getByTestId('page-indicator')).toHaveText(`Page 1 of 36`);

    // Change page size to 15
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '15 / Page' }).click();

    // Change page size to 15
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '15 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // 15 Row + 1 Header row
    expect(
      page.getByTestId('data-model-column-table').getByRole('row')
    ).toHaveCount(16);

    // Change page size to 25
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '25 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // 25 Row + 1 Header row
    expect(
      page.getByTestId('data-model-column-table').getByRole('row')
    ).toHaveCount(26);
  });

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
    await page.getByRole('menuitem', { name: 'Column Profile' }).click();

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
});
