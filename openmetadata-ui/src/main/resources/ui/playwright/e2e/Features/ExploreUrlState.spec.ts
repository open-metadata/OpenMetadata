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
import test, { expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  searchAndExpectEntityNotVisible,
  searchAndExpectEntityVisible,
} from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { clickUpdateButtonIfVisible } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const TIER_FIELD = 'tier.tagFQN';
const TIER1_KEY = 'tier.tier1';

const tier1Table = new TableClass();
const tier2Dashboard = new DashboardClass();
const ownerUser = new UserClass();

const classificationTagPatch = (tagFQN: string): Operation => ({
  op: 'add',
  path: '/tags/0',
  value: {
    tagFQN,
    source: 'Classification',
    labelType: 'Manual',
  },
});

const ownerPatch = (): Operation => ({
  op: 'add',
  path: '/owners/0',
  value: {
    id: ownerUser.responseData.id,
    type: 'user',
  },
});

/**
 * Facet options are aggregated once when the dropdown opens, so a freshly
 * indexed fixture can miss the first fetch. Retry by closing and reopening
 * the dropdown (each open re-fetches the facet aggregation).
 */
const ensureFilterOptionVisible = async (
  page: Page,
  label: string,
  optionKey: string,
  searchText?: string
) => {
  const menu = page.getByTestId('drop-down-menu');
  const option = menu.getByTestId(optionKey);

  await expect(async () => {
    const isMenuOpen = await menu.isVisible().catch(() => false);
    if (!isMenuOpen) {
      await page.getByTestId(`search-dropdown-${label}`).click();
      await menu.waitFor({ state: 'visible' });
    }
    if (searchText) {
      await menu.getByTestId('search-input').fill(searchText);
    }
    try {
      await option.waitFor({ state: 'visible', timeout: 5_000 });
    } catch (error) {
      await page.keyboard.press('Escape');
      throw error;
    }
  }).toPass({ timeout: 90_000, intervals: [2_000, 5_000, 10_000] });
};

const selectOptionAndWaitForQuery = async (
  page: Page,
  label: string,
  optionKey: string,
  searchText?: string
) => {
  await ensureFilterOptionVisible(page, label, optionKey, searchText);
  const option = page.getByTestId('drop-down-menu').getByTestId(optionKey);

  const queryRes = page.waitForResponse((response) => {
    let isMatch = false;
    if (response.url().includes('/api/v1/search/query')) {
      const queryFilter =
        new URL(response.url()).searchParams.get('query_filter') ?? '';
      // Match the quoted term value ("table") so short keys can't
      // incidentally hit field names like "table.name" in the filter.
      isMatch = queryFilter.includes(`"${optionKey}"`);
    }

    return isMatch;
  });
  await option.click();
  await clickUpdateButtonIfVisible(page);
  await queryRes;
  await waitForAllLoadersToDisappear(page);
};

const openExplore = async (page: Page) => {
  await redirectToHomePage(page);
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await sidebarClick(page, SidebarItem.EXPLORE);
  await queryRes;
  await waitForAllLoadersToDisappear(page);
};

const treeNode = (page: Page, title: string) =>
  page
    .getByTestId(`explore-tree-title-${title}`)
    .locator('xpath=ancestor::*[contains(@class, "ant-tree-treenode")]');

// A global-search term scopes every facet aggregation, so clear it before any
// post-search facet interaction (the searchAndExpect* helpers leave the box
// filled with the last asserted entity name).
const clearGlobalSearch = async (page: Page) => {
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('searchBox').fill('');
  await page.getByTestId('searchBox').press('Enter');
  await queryRes;
  await waitForAllLoadersToDisappear(page);
};

// Read the ES `query.bool.must[]` the app serialised into the quickFilter URL
// param. Used to compose a deliberately-empty AND combination that the facet
// dropdowns refuse to build (each facet self-scopes to the other filters).
const readQuickFilterMust = (page: Page): unknown[] => {
  const raw = new URL(page.url()).searchParams.get('quickFilter') ?? '{}';
  const parsed = JSON.parse(raw) as { query?: { bool?: { must?: unknown } } };
  const must = parsed.query?.bool?.must;

  return Array.isArray(must) ? must : must ? [must] : [];
};

test.beforeAll('Setup url-state fixtures', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await ownerUser.create(apiContext);
  await tier1Table.create(apiContext);
  await tier2Dashboard.create(apiContext);

  await tier1Table.patch({
    apiContext,
    patchData: [classificationTagPatch('Tier.Tier1'), ownerPatch()],
  });
  await tier2Dashboard.patch({
    apiContext,
    patchData: [classificationTagPatch('Tier.Tier2')],
  });

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await tier1Table.delete(apiContext);
  await tier2Dashboard.delete(apiContext);
  await ownerUser.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await openExplore(page);
});

test('a deep-linked filter URL restores chips and filtered results', async ({
  page,
}) => {
  test.slow();

  let capturedUrl = '';

  await test.step('Apply a Tier1 filter and capture the URL', async () => {
    await selectOptionAndWaitForQuery(page, 'Tier', TIER1_KEY);
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
    ).toBeVisible();

    capturedUrl = page.url();
    expect(capturedUrl).toContain('quickFilter');
  });

  await test.step('Open the URL in a fresh navigation — state is restored', async () => {
    await redirectToHomePage(page);
    await page.goto(capturedUrl);
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
    ).toBeVisible();

    await searchAndExpectEntityVisible(page, tier1Table);
    await searchAndExpectEntityNotVisible(page, tier2Dashboard);
  });
});

test('reloading the page preserves composed filters', async ({ page }) => {
  test.slow();

  await selectOptionAndWaitForQuery(page, 'Tier', TIER1_KEY);
  await page.keyboard.press('Escape');
  await selectOptionAndWaitForQuery(page, 'Data Assets', 'table');
  await page.keyboard.press('Escape');

  await expect(
    page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
  ).toBeVisible();
  await expect(
    page.getByTestId('query-chip-entityType.keyword-table')
  ).toBeVisible();

  await page.reload();
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(`query-chip-${TIER_FIELD}-${TIER1_KEY}`)
  ).toBeVisible();
  await expect(
    page.getByTestId('query-chip-entityType.keyword-table')
  ).toBeVisible();
});

test('a browse-location deep link highlights the tree and clears on chip removal', async ({
  page,
}) => {
  test.slow();

  let browseUrl = '';

  await test.step('Click a tree category — browsePath lands in the URL and highlights the node', async () => {
    const browseRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('explore-tree-title-Databases').click();
    await browseRes;
    await waitForAllLoadersToDisappear(page);

    expect(page.url()).toContain('browsePath');
    await expect(page.getByTestId('browse-chip-entityType')).toBeVisible();
    await expect(page.locator('.ant-tree-node-selected')).toBeVisible();

    browseUrl = page.url();
  });

  await test.step('Reopening the browse URL re-highlights the node', async () => {
    await redirectToHomePage(page);
    await page.goto(browseUrl);
    await waitForAllLoadersToDisappear(page);

    await expect(page.locator('.ant-tree-node-selected')).toBeVisible();
    await expect(page.getByTestId('browse-chip-entityType')).toBeVisible();
  });

  await test.step('Removing the browse chip clears the tree highlight', async () => {
    const removeRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('remove-browse-chip-entityType').click();
    await removeRes;
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('browse-chip-entityType')).not.toBeVisible();
    await expect(page.locator('.ant-tree-node-selected')).toHaveCount(0);
  });
});

test('selecting an asset type grays out and collapses incompatible categories', async ({
  page,
}) => {
  test.slow();

  // Databases is the most reliably-populated category in sample data, so use
  // it as the node that must expand-then-collapse when a non-database type is
  // chosen (Dashboard belongs to the Dashboards category, so it disables
  // Databases).
  await test.step('Databases category is expanded', async () => {
    // Databases auto-expands on load, so wait for that rather than clicking its
    // switcher: clicking would toggle the already-open node closed, and the
    // loading-state spinner (class ant-tree-switcher-loading-icon, a substring
    // match for "ant-tree-switcher") makes a switcher click ambiguous.
    await expect(treeNode(page, 'Databases')).toHaveClass(
      /ant-tree-treenode-switcher-open/
    );
  });

  await test.step('Selecting Dashboard grays out and collapses Databases', async () => {
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'dashboard');
    await page.keyboard.press('Escape');

    await expect(treeNode(page, 'Dashboards')).not.toHaveClass(
      /ant-tree-treenode-disabled/
    );
    await expect(treeNode(page, 'Databases')).toHaveClass(
      /ant-tree-treenode-disabled/
    );
    await expect(treeNode(page, 'Databases')).not.toHaveClass(
      /ant-tree-treenode-switcher-open/
    );
  });
});

test('an impossible filter combination shows the no-results placeholder and recovers on clear', async ({
  page,
}) => {
  test.slow();

  await test.step('Deep-link owner + an asset type the owner has none of', async () => {
    // ownerUser owns only tier1Table (a table), so owner + Topic is
    // deterministically empty. The facet dropdowns self-scope (the Data Assets
    // facet ANDs the active owner filter), so they never offer "topic" once the
    // owner is selected — capture each filter's quickFilter independently and
    // deep-link the AND combination. (Owners aggregates on `ownerDisplayName`,
    // whose ES terms are lower-cased, so its option testid is the lower-cased
    // display name.)
    const ownerName = ownerUser.getUserDisplayName().toLowerCase();
    await selectOptionAndWaitForQuery(page, 'Owners', ownerName, ownerName);
    await page.keyboard.press('Escape');
    const impossibleUrl = new URL(page.url());
    const ownerMust = readQuickFilterMust(page);

    await openExplore(page);
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'topic');
    await page.keyboard.press('Escape');
    const topicMust = readQuickFilterMust(page);

    impossibleUrl.searchParams.set(
      'quickFilter',
      JSON.stringify({
        query: { bool: { must: [...ownerMust, ...topicMust] } },
      })
    );
    await page.goto(impossibleUrl.pathname + impossibleUrl.search);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('no-search-results')).toBeVisible();
  });

  await test.step('Clear All recovers the full estate', async () => {
    await page.getByTestId('clear-all-chips').click();
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('no-search-results')).not.toBeVisible();
    await expect(page.getByTestId('explore-query-filter-chips')).toHaveCount(0);
    await expect(page.getByTestId('query-bar-empty-text')).toHaveCount(0);
  });
});

test('applying a filter from a deep page resets pagination to page 1', async ({
  page,
}) => {
  test.slow();

  await test.step('Navigate to an explore page beyond the first', async () => {
    await page.goto('/explore/tables?page=2');
    await waitForAllLoadersToDisappear(page);
    expect(page.url()).toContain('page=2');
  });

  await test.step('Selecting a tree category resets to page 1', async () => {
    const browseRes = page.waitForResponse(
      '/api/v1/search/query?*index=dataAsset*'
    );
    await page.getByTestId('explore-tree-title-Databases').click();
    await browseRes;
    await waitForAllLoadersToDisappear(page);

    expect(page.url()).toContain('page=1');
    expect(page.url()).not.toContain('page=2');
  });
});

test('owner filter spans asset types and ANDs with an asset-type filter', async ({
  page,
}) => {
  test.slow();

  // The Owners facet aggregates on `ownerDisplayName`, whose terms ES
  // lower-cases, so the dropdown option testid is the lower-cased display name.
  const ownerName = ownerUser.getUserDisplayName().toLowerCase();

  await test.step('Filter by owner', async () => {
    await selectOptionAndWaitForQuery(page, 'Owners', ownerName, ownerName);
    await page.keyboard.press('Escape');

    await searchAndExpectEntityVisible(page, tier1Table);
    await searchAndExpectEntityNotVisible(page, tier2Dashboard);
  });

  await test.step('Add a Table type filter — owned table stays visible', async () => {
    // The previous step left the owned table's name in the search box, which
    // scopes the Data Assets facet to nothing — clear it before opening it.
    await clearGlobalSearch(page);
    await selectOptionAndWaitForQuery(page, 'Data Assets', 'table');
    await page.keyboard.press('Escape');

    await expect(
      page.getByTestId('query-chip-entityType.keyword-table')
    ).toBeVisible();
    await searchAndExpectEntityVisible(page, tier1Table);
  });
});
