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
import { Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  expandDatabaseInExploreTree,
  expandSchemaInExploreTree,
  expandServiceInExploreTree,
} from '../../utils/explore';
import { isAggregationResponse } from '../../utils/searchAggregation';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Explore tree's service bucket is capped at 166 and sorted alphabetically
// (ElasticSearchAggregationManager orders by _key ASC), so a name starting with
// a digit guarantees these services land within that bucket regardless of how
// many other `pw-*` services have accumulated.
const table = new TableClass({
  service: new DatabaseServiceClass(`0-pw-database-service-${uuid()}`),
});
const dashboard = new DashboardClass({
  service: new DashboardServiceClass(`0-pw-dashboard-service-${uuid()}`),
});

// Expand any tree node by its title testid (works for categories, service
// types, services and entity-type leaves) and wait for the count query.
const expandTreeNode = async (page: Page, titleTestId: string) => {
  const row = page
    .getByTestId('explore-tree')
    .getByRole('row')
    .filter({ has: page.getByTestId(`explore-tree-title-${titleTestId}`) });

  const isExpanded = async () =>
    (await row.getAttribute('aria-expanded')) === 'true';

  if (await isExpanded()) {
    return;
  }

  // Set up response listener BEFORE clicking. After #29642, ExploreTree skips
  // setIsLoading on browse selections, so loader-based waiting is unreliable.
  // Response-based waiting (the same pattern used in expandServiceInExploreTree
  // etc.) anchors on the actual data fetch so children are fully rendered before
  // we interact with them.
  // ServiceType nodes drill down through POST /search/aggregate (service.style
  // top hits for custom icons); every other level still uses GET /search/query.
  // A node only fetches its children the first time it opens though, so a caller
  // re-expanding a node the tree already holds gets no request at all — hence the
  // bound and the tolerance for it never arriving. Left unbounded this waits the
  // full 30s default, which is enough to exhaust a caller's whole retry budget.
  const res = page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query?') ||
        isAggregationResponse(response, {
          field: 'service.displayName.keyword',
          value: null,
        }),
      { timeout: 15_000 }
    )
    .catch(() => undefined);

  await row.getByTestId('tree-expand-btn').click({ timeout: 10_000 });
  await res;
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await waitForAllLoadersToDisappear(page);
};

const goToExplore = async (page: Page) => {
  await redirectToHomePage(page);
  const queryRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await sidebarClick(page, SidebarItem.EXPLORE);
  await queryRes;
  await waitForAllLoadersToDisappear(page);
};

const drillToSchema = async (page: Page) => {
  await expandServiceInExploreTree(page, table.serviceResponseData.name);
  await expandDatabaseInExploreTree(page, table.databaseResponseData.name);
  await expandSchemaInExploreTree(page, table.schemaResponseData.name);
};

const selectDataAssetType = async (page: Page, optionKey: string) => {
  await page.getByTestId('search-dropdown-Data Assets').click();
  await page.getByTestId('drop-down-menu').waitFor({ state: 'visible' });
  const applyRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId('drop-down-menu').getByTestId(optionKey).click();
  await applyRes;
  await page.keyboard.press('Escape');
  await waitForAllLoadersToDisappear(page);
};

test.beforeAll('Setup data-asset fixtures', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await dashboard.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await dashboard.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await goToExplore(page);
});

test.describe(
  'Explore - data asset browsing',
  { tag: ['@Pages', '@Discovery'] },
  () => {
    test('drills the database hierarchy down to the Tables and Columns leaves with counts', async ({
      page,
    }) => {
      test.slow();

      await drillToSchema(page);

      await test.step('Both entity-type leaves render with count badges', async () => {
        const tablesLeaf = page.getByTestId('explore-tree-title-table');
        const columnsLeaf = page.getByTestId('explore-tree-title-tableColumn');

        await expect(tablesLeaf).toBeVisible();
        await expect(columnsLeaf).toBeVisible();
        await expect(
          tablesLeaf.locator('..').locator('.explore-node-count')
        ).toBeVisible();
        await expect(
          columnsLeaf.locator('..').locator('.explore-node-count')
        ).toBeVisible();
      });
    });

    test('a non-leaf node count reflects the active Data Assets filter', async ({
      page,
    }) => {
      test.slow();

      const schemaCount = async () => {
        const badge = page
          .getByTestId(`explore-tree-title-${table.schemaResponseData.name}`)
          .locator('..')
          .locator('.explore-node-count');
        await expect(badge).toBeVisible();
        const text = await badge.innerText();

        return Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
      };

      // Unfiltered, the schema subtree counts every object under it — the table
      // and its columns.
      await expandServiceInExploreTree(page, table.serviceResponseData.name);
      await expandDatabaseInExploreTree(page, table.databaseResponseData.name);
      const unfilteredCount = await schemaCount();

      // Filtering to Table re-counts the same node over tables only, so the
      // column documents drop out and the badge shrinks.
      await selectDataAssetType(page, 'table');
      await expandServiceInExploreTree(page, table.serviceResponseData.name);
      await expandDatabaseInExploreTree(page, table.databaseResponseData.name);
      const filteredCount = await schemaCount();

      expect(filteredCount).toBeGreaterThan(0);
      expect(filteredCount).toBeLessThan(unfilteredCount);
    });

    test('drills a non-database hierarchy (Dashboards) down to the entity-type leaf', async ({
      page,
    }) => {
      test.slow();

      // Dashboards collapse straight to an entity-type leaf under their service
      // (no database/schema levels), so this exercises a different tree shape
      // than the table hierarchy.
      await expandTreeNode(page, 'Dashboards');
      await expandTreeNode(page, 'superset');
      await expandTreeNode(page, dashboard.serviceResponseData.name);

      const dashboardLeaf = page.getByTestId('explore-tree-title-dashboard');
      await expect(dashboardLeaf).toBeVisible();
      await expect(
        dashboardLeaf.locator('..').locator('.explore-node-count')
      ).toBeVisible();
    });
  }
);

test.describe(
  'Explore - governance browsing',
  { tag: ['@Pages', '@Governance'] },
  () => {
    const expandGovernance = async (page: Page) => {
      await expect(
        page.getByTestId('explore-tree-title-Governance')
      ).toBeVisible();
      await page
        .getByTestId('explore-tree')
        .getByRole('row')
        .filter({
          has: page.getByTestId('explore-tree-title-Governance'),
        })
        .getByTestId('tree-expand-btn')
        .click();
    };

    test('Tags leaf under Governance filters the results', async ({ page }) => {
      test.slow();

      await expandGovernance(page);

      const tagsRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('explore-tree-title-Tags').click();
      const tagsResponse = await tagsRes;
      await waitForAllLoadersToDisappear(page);

      expect(tagsResponse.status()).toBe(200);
      await expect(page.getByTestId('explore-tree-title-Tags')).toBeVisible();
    });

    test('Glossary leaf under Governance filters the results', async ({
      page,
    }) => {
      test.slow();

      await expandGovernance(page);

      const glossaryRes = page.waitForResponse(
        '/api/v1/search/query?*index=dataAsset*'
      );
      await page.getByTestId('explore-tree-title-Glossaries').click();
      const glossaryResponse = await glossaryRes;
      await waitForAllLoadersToDisappear(page);

      expect(glossaryResponse.status()).toBe(200);
      await expect(
        page.getByTestId('explore-tree-title-Glossaries')
      ).toBeVisible();
    });
  }
);
