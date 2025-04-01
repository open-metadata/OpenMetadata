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
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { getFirstRowColumnLink } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();

test.slow(true);

test.describe('Table pagination sorting search scenarios ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.create(apiContext);

    for (let i = 0; i < 17; i++) {
      await table1.createTestCase(apiContext);
    }

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Table pagination with sorting should works', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    const listTestCaseResponse = page.waitForResponse(
      `/api/v1/dataQuality/testCases/search/list?**`
    );

    await page.click('[data-testid="by-test-cases"]');
    await listTestCaseResponse;
    await page.getByText('Name', { exact: true }).click();

    await page.getByTestId('next').click();

    expect(await page.locator('.ant-table-row').count()).toBe(10);
  });

  test('Table search with sorting should works', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="by-test-cases"]');
    await page.getByText('Name', { exact: true }).click();
    await page.getByTestId('searchbar').click();
    await page.getByTestId('searchbar').fill('temp-test-case');

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table filter with sorting should works', async ({ page }) => {
    await sidebarClick(page, SidebarItem.DATA_QUALITY);

    await page.click('[data-testid="by-test-cases"]');
    await page.getByText('Name', { exact: true }).click();

    await page.getByTestId('status-select-filter').locator('div').click();
    await page.getByTitle('Queued').locator('div').click();

    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  });

  test('Table page should show schema tab with count', async ({ page }) => {
    await table1.visitEntityPage(page);

    await expect(page.getByRole('tab', { name: 'Schema' })).toContainText('4');
  });

  test('should persist current page', async ({ page }) => {
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

    const linkInColumn = getFirstRowColumnLink(page);
    await linkInColumn.click();

    await page.waitForURL('**/table/**');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await page.goBack({
      waitUntil: 'networkidle',
    });

    const pageIndicatorAfterBack = await page
      .locator('[data-testid="page-indicator"]')
      .textContent();

    expect(pageIndicatorAfterBack).toBe(initialPageIndicator);
  });

  test('should persist page size', async ({ page }) => {
    page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByTestId('databaseSchema-tables')).toBeVisible();

    await page.getByTestId('page-size-selection-dropdown').click();

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

    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
      '15 / Page'
    );
  });
});
