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

// The filters sit below the fold of the modal's scroll area. Playwright's
// own scroll-before-click dispatches its scroll event after the popover has
// opened, and react-aria closes a popover on any ancestor scroll. Scrolling
// first lets that event flush before the click.
async function openAddTestCaseListFilter(page: Page, searchKey: string) {
  const trigger = page.getByTestId(`search-dropdown-${searchKey}`);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
}

// The filter dropdown is a popover rendered outside the Add Test Cases modal
// and can close again right after it opens (timing-dependent). Reopen and
// retype until the searched option is shown instead of racing that close.
async function searchAddTestCaseListFilterOption(
  page: Page,
  searchKey: string,
  searchText: string,
  optionTestId: string
) {
  const menu = page.getByTestId('drop-down-menu');
  const option = menu.getByTestId(optionTestId);

  await expect(async () => {
    if (!(await menu.isVisible())) {
      await openAddTestCaseListFilter(page, searchKey);
    }
    await menu.getByTestId('search-input').fill(searchText, { timeout: 5_000 });
    await expect(option).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 60_000 });

  return option;
}

export async function addTestCaseListFilterByTestType(
  page: Page,
  label: 'Table' | 'All'
) {
  const listResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await openAddTestCaseListFilter(page, 'Test Type');
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitemradio', { name: label })
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
  await openAddTestCaseListFilter(page, 'Status');
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitemradio', { name: label })
    .click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await listResponse;
}

export async function addTestCaseListFilterByTable(
  page: Page,
  tableEntityName: string,
  tableFqn: string
) {
  const tableOption = await searchAddTestCaseListFilterOption(
    page,
    'Table',
    tableEntityName,
    tableFqn
  );
  await tableOption.click();

  // Table filter must pair entityLink with includeAllTests=true so column
  // tests under the picked table are not dropped server-side.
  const testCaseByTableResponse = page.waitForResponse(
    (url) =>
      url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      url.url().includes('entityLink') &&
      url.url().includes('includeAllTests=true')
  );
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await testCaseByTableResponse;
}

// The Column options aggregate `columns.name.keyword` over every data asset,
// not the table picked in the Table filter, so their order depends on what
// else the shard has ingested. Search for a known column instead of taking
// whichever lands first: TableClass suffixes each column with a uuid, so the
// search yields exactly one option.
export async function addTestCaseListFilterByColumn(
  page: Page,
  columnName: string
) {
  const columnOption = await searchAddTestCaseListFilterOption(
    page,
    'Column',
    columnName,
    columnName
  );
  await columnOption.click();

  const testCaseByColumnResponse = page.waitForResponse(
    (url) =>
      url.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      url.url().includes(`columnName=${encodeURIComponent(columnName)}`)
  );
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await testCaseByColumnResponse;
}

export async function addTestCaseListResetFilters(
  page: Page,
  tableFqn: string,
  columnName: string
) {
  await addTestCaseListFilterByTestType(page, 'All');

  const clearTableResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await openAddTestCaseListFilter(page, 'Table');
  await page.getByTestId('drop-down-menu').getByTestId(tableFqn).click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await clearTableResponse;

  const clearColumnResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await openAddTestCaseListFilter(page, 'Column');
  await page.getByTestId('drop-down-menu').getByTestId(columnName).click();
  await page.getByTestId('drop-down-menu').getByTestId('update-btn').click();
  await clearColumnResponse;

  const clearStatusResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await openAddTestCaseListFilter(page, 'Status');
  await page
    .getByTestId('drop-down-menu')
    .getByRole('menuitemradio', { name: 'Success' })
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

export async function addTestCaseListFilterByColumnInAddTestCasesDialog(
  page: Page,
  columnName: string
) {
  return addTestCaseListFilterByColumn(page, columnName);
}

export async function addTestCaseListResetFiltersInAddTestCasesDialog(
  page: Page,
  tableFqn: string,
  columnName: string
) {
  return addTestCaseListResetFilters(page, tableFqn, columnName);
}

export async function addTestCaseListToggleSelectAllInAddTestCasesDialog(
  page: Page
) {
  return addTestCaseListToggleSelectAll(page);
}
