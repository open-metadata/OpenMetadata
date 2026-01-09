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
import { expect } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

// Use existing sample_data table for testing
const SAMPLE_TABLE_FQN = 'sample_data.ecommerce_db.shopify.fact_sale';

test.describe('Table Column Sorting', { tag: '@ingestion' }, () => {
  test.beforeEach('Navigate to home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Sort dropdown should be visible on table schema tab', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const sortDropdown = page.getByTestId('sort-dropdown');

    await expect(sortDropdown).toBeVisible();
  });

  test('Sort dropdown should show Alphabetical and Original Order options', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const sortDropdown = page.getByTestId('sort-dropdown');
    await sortDropdown.click();

    const alphabeticalOption = page.getByTestId('sort-alphabetical');
    const originalOrderOption = page.getByTestId('sort-original-order');

    await expect(alphabeticalOption).toBeVisible();
    await expect(originalOrderOption).toBeVisible();
  });

  test('Clicking Alphabetical option should sort columns by name', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // First switch to Original Order
    const sortDropdown = page.getByTestId('sort-dropdown');
    await sortDropdown.click();
    await page.getByTestId('sort-original-order').click();
    await waitForAllLoadersToDisappear(page);

    // Now switch back to Alphabetical to verify the API call
    await sortDropdown.click();

    const columnsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/columns') &&
        response.url().includes('sortBy=name') &&
        response.status() === 200
    );

    await page.getByTestId('sort-alphabetical').click();
    await columnsResponse;
    await waitForAllLoadersToDisappear(page);

    const nameHeader = page.getByTestId('name-column-header');

    await expect(nameHeader).toBeVisible();
  });

  test('Clicking Original Order option should sort columns by ordinal position', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const sortDropdown = page.getByTestId('sort-dropdown');
    await sortDropdown.click();

    const columnsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/columns') &&
        response.url().includes('sortBy=ordinalPosition') &&
        response.status() === 200
    );

    await page.getByTestId('sort-original-order').click();
    await columnsResponse;
    await waitForAllLoadersToDisappear(page);

    const nameHeader = page.getByTestId('name-column-header');

    await expect(nameHeader).toBeVisible();
  });

  test('Clicking Name column header should toggle sort order', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    const nameHeader = page.getByTestId('name-column-header');
    const sortIndicator = page.getByTestId('sort-indicator');

    await expect(nameHeader).toBeVisible();
    await expect(sortIndicator).toBeVisible();

    const columnsResponseDesc = page.waitForResponse(
      (response) =>
        response.url().includes('/columns') &&
        response.url().includes('sortOrder=desc') &&
        response.status() === 200
    );

    await nameHeader.click();
    await columnsResponseDesc;
    await waitForAllLoadersToDisappear(page);

    const columnsResponseAsc = page.waitForResponse(
      (response) =>
        response.url().includes('/columns') &&
        response.url().includes('sortOrder=asc') &&
        response.status() === 200
    );

    await nameHeader.click();
    await columnsResponseAsc;
    await waitForAllLoadersToDisappear(page);
  });

  test('Switching sort field should reset sort order to ascending', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // First click to change to desc
    const nameHeader = page.getByTestId('name-column-header');
    await nameHeader.click();
    await waitForAllLoadersToDisappear(page);

    // Now switch to Original Order - should reset to asc
    const sortDropdown = page.getByTestId('sort-dropdown');
    await sortDropdown.click();

    const columnsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/columns') &&
        response.url().includes('sortBy=ordinalPosition') &&
        response.url().includes('sortOrder=asc') &&
        response.status() === 200
    );

    await page.getByTestId('sort-original-order').click();
    await columnsResponse;
    await waitForAllLoadersToDisappear(page);
  });

  test('Sort state should be preserved when searching columns', async ({
    page,
  }) => {
    await page.goto(`/table/${SAMPLE_TABLE_FQN}`);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Switch to Original Order
    const sortDropdown = page.getByTestId('sort-dropdown');
    await sortDropdown.click();
    await page.getByTestId('sort-original-order').click();
    await waitForAllLoadersToDisappear(page);

    // Search for columns - sort state should be preserved
    const searchInput = page.getByTestId('searchbar');

    if (await searchInput.isVisible()) {
      const searchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/columns/search') &&
          response.url().includes('sortBy=ordinalPosition') &&
          response.status() === 200
      );

      await searchInput.fill('api');
      await searchResponse;
      await waitForAllLoadersToDisappear(page);
    }
  });
});
