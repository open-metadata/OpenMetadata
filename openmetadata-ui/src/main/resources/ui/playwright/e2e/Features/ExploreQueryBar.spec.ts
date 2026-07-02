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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

let table: TableClass;

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  table = new TableClass();
  await table.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await sidebarClick(page, SidebarItem.EXPLORE);
  await queryRes;
  await waitForAllLoadersToDisappear(page);
});

test('query bar is persistent and shows the browse placeholder when empty', async ({
  page,
}) => {
  await expect(page.getByTestId('explore-query-filter-chips')).toBeVisible();
  await expect(page.getByTestId('query-bar-empty-text')).toBeVisible();
});

test('filter survives a tree click and both stack as removable chips', async ({
  page,
}) => {
  test.slow();

  await test.step('Apply Data Assets → Table filter', async () => {
    await page.getByTestId('search-dropdown-Data Assets').click();
    const applyRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('table-checkbox').check();
    await applyRes;
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();
  });

  await test.step('Click Databases in the tree — Type chip must survive', async () => {
    const browseRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('explore-tree-title-Databases').click();
    await browseRes;
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('browse-chip-entityType')).toBeVisible();
    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();

    await expect(page.getByTestId('clear-filters')).toHaveCount(0);
    expect(page.url()).toContain('browsePath');
    expect(page.url()).toContain('quickFilter');
  });

  await test.step('Removing the browse chip keeps the filter chip', async () => {
    const removeRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('remove-browse-chip-entityType').click();
    await removeRes;

    await expect(page.getByTestId('browse-chip-entityType')).not.toBeVisible();
    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();
  });

  await test.step('Query-panel Clear empties the whole query', async () => {
    await page.getByTestId('clear-all-chips').click();
    await waitForAllLoadersToDisappear(page);

    const url = new URL(page.url());
    expect(url.searchParams.get('browsePath')).toBeNull();
    expect(url.searchParams.get('quickFilter')).toBeNull();

    await expect(page.getByTestId('query-bar-empty-text')).toBeVisible();
    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).not.toBeVisible();
  });
});

test('selecting an asset type grays out incompatible tree categories', async ({
  page,
}) => {
  await page.getByTestId('search-dropdown-Data Assets').click();
  const applyRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('table-checkbox').check();
  await applyRes;
  await page.keyboard.press('Escape');

  const databasesNode = page
    .getByTestId('explore-tree-title-Databases')
    .locator('xpath=ancestor::*[contains(@class, "ant-tree-treenode")]');
  const dashboardsNode = page
    .getByTestId('explore-tree-title-Dashboards')
    .locator('xpath=ancestor::*[contains(@class, "ant-tree-treenode")]');

  await expect(databasesNode).not.toHaveClass(/ant-tree-treenode-disabled/);
  await expect(dashboardsNode).toHaveClass(/ant-tree-treenode-disabled/);
});
