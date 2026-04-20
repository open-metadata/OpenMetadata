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

import { expect, Locator, Page } from '@playwright/test';

export const ADD_TEST_CASE_SELECTION_CARD =
  '[data-testid="test-case-selection-card"]';

export interface AddTestCaseListFilterContext {
  page: Page;
  filtersRoot: Locator;
  waitAfterFilterUpdate: () => Promise<void>;
}

export function waitForAddTestCaseListTableSearchQuery(
  page: Page,
  tableEntityName: string
) {
  return page.waitForResponse((res) => {
    const u = res.url();
    if (res.request().method() !== 'GET') {
      return false;
    }
    if (!u.includes('/api/v1/search/query')) {
      return false;
    }
    if (!/[?&]index=table(?:&|$)/.test(u)) {
      return false;
    }
    if (!tableEntityName) {
      return false;
    }
    return (
      u.includes(encodeURIComponent(tableEntityName)) ||
      u.includes(tableEntityName)
    );
  });
}

export async function addTestCaseListFilterByTestType(
  page: Page,
  label: 'Table' | 'All'
) {
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.getByTestId('search-dropdown-Test Type').click();
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitem', { name: label })
    .click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await listResponse;
}

export async function addTestCaseListFilterByStatus(
  page: Page,
  label: 'Success'
) {
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.getByTestId('search-dropdown-Status').click();
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitem', { name: label })
    .click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await listResponse;
}

export async function addTestCaseListFilterByTable(
  page: Page,
  tableEntityName: string,
  tableFqn: string
) {
  const tableSearchResponse = waitForAddTestCaseListTableSearchQuery(
    page,
    tableEntityName
  );
  await page.getByTestId('search-dropdown-Table').click();
  await page
    .getByTestId('drop-down-menu')
    .getByTestId('search-input')
    .fill(tableEntityName);
  await tableSearchResponse;

  const tableOption = page.getByTestId('drop-down-menu').getByTestId(tableFqn);
  await tableOption.waitFor({ state: 'visible' });
  await tableOption.click();

  const testCaseByTableResponse = page.waitForResponse(
    (url) =>
      url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      url.url().includes('entityLink')
  );
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await testCaseByTableResponse;
}

export async function addTestCaseListFilterByFirstColumn(page: Page) {
  await page.getByTestId('search-dropdown-Column').click();

  const firstColumnOption = page
    .getByTestId('drop-down-menu')
    .getByRole('menuitem')
    .first();
  await firstColumnOption.waitFor({ state: 'visible' });
  await firstColumnOption.click();

  const testCaseByColumnResponse = page.waitForResponse(
    (url) =>
      url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      url.url().includes('columnName')
  );
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await testCaseByColumnResponse;
}

export async function addTestCaseListResetFilters(
  page: Page,
  tableFqn: string
) {
  await addTestCaseListFilterByTestType(page, 'All');

  const clearTableResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.getByTestId('search-dropdown-Table').click();
  await page.getByTestId('drop-down-menu').getByTestId(tableFqn).click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await clearTableResponse;

  const clearColumnResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.getByTestId('search-dropdown-Column').click();
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitem')
    .first()
    .click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await clearColumnResponse;

  const clearStatusResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.getByTestId('search-dropdown-Status').click();
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitem', { name: 'Success' })
    .click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await clearStatusResponse;
}

export async function addTestCaseListToggleSelectAll(page: Page) {
  const selectAllBtn = page.getByTestId('select-all-test-cases');
  await expect(selectAllBtn).toBeVisible();
  await selectAllBtn.click();
  await selectAllBtn.click();
}

export async function addTestCaseListFilterByTestTypeInAddTestCasesDialog(
  page: Page,
  label: 'Table' | 'All'
) {
  return addTestCaseListFilterByTestType(page, label);
}

export async function addTestCaseListFilterByStatusInAddTestCasesDialog(
  page: Page,
  label: 'Success'
) {
  return addTestCaseListFilterByStatus(page, label);
}

export async function addTestCaseListFilterByTableInAddTestCasesDialog(
  page: Page,
  tableEntityName: string,
  tableFqn: string
) {
  return addTestCaseListFilterByTable(page, tableEntityName, tableFqn);
}

export async function addTestCaseListFilterByFirstColumnInAddTestCasesDialog(
  page: Page
) {
  return addTestCaseListFilterByFirstColumn(page);
}

export async function addTestCaseListResetFiltersInAddTestCasesDialog(
  page: Page,
  tableFqn: string
) {
  return addTestCaseListResetFilters(page, tableFqn);
}

export async function addTestCaseListToggleSelectAllInAddTestCasesDialog(
  page: Page
) {
  return addTestCaseListToggleSelectAll(page);
}
