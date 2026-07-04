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
import { expect, Page, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  expandDatabaseInExploreTree,
  expandSchemaInExploreTree,
  expandServiceInExploreTree,
} from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();
const dashboard = new DashboardClass();

// Expand any tree node by its title testid (works for categories, service
// types, services and entity-type leaves) and wait for the count query.
const expandTreeNode = async (page: Page, titleTestId: string) => {
  await page
    .locator('.ant-tree-treenode')
    .filter({ has: page.getByTestId(`explore-tree-title-${titleTestId}`) })
    .locator('.ant-tree-switcher svg')
    .first()
    .click();

  await waitForAllLoadersToDisappear(page);
};

const rootTreeNode = (page: Page, titleTestId: string) =>
  page
    .getByTestId(`explore-tree-title-${titleTestId}`)
    .locator('xpath=ancestor::*[contains(@class, "ant-tree-treenode")]');

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
  await page.getByTestId(`${optionKey}-checkbox`).check();
  await applyRes;
  await page.keyboard.press('Escape');
  await waitForAllLoadersToDisappear(page);
};

const removeQueryChip = async (page: Page, chipKey: string) => {
  const clearRes = page.waitForResponse(
    '/api/v1/search/query?*index=dataAsset*'
  );
  await page.getByTestId(`remove-chip-${chipKey}`).click();
  await clearRes;
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

    test('the entity-type leaf respects the Data Assets filter (Table hides Columns)', async ({
      page,
    }) => {
      test.slow();

      await test.step('Selecting Table hides the Columns leaf', async () => {
        await selectDataAssetType(page, 'table');
        await drillToSchema(page);

        await expect(
          page.getByTestId('explore-tree-title-table')
        ).toBeVisible();
        await expect(
          page.getByTestId('explore-tree-title-tableColumn')
        ).toHaveCount(0);
      });

      await test.step('Clearing the Table filter brings the Columns leaf back', async () => {
        await removeQueryChip(page, 'entityType.keyword-table');
        await drillToSchema(page);

        await expect(
          page.getByTestId('explore-tree-title-table')
        ).toBeVisible();
        await expect(
          page.getByTestId('explore-tree-title-tableColumn')
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

    test('result-card breadcrumb collapses a deep path and expands on click', async ({
      page,
    }) => {
      test.slow();

      // Search the fixture table so its service / database / schema breadcrumb
      // (a deep path) renders on the result card.
      const searchRes = page.waitForResponse('/api/v1/search/query?*');
      await page.getByTestId('searchBox').fill(table.entityResponseData.name);
      await page.getByTestId('searchBox').press('Enter');
      await searchRes;
      await waitForAllLoadersToDisappear(page);

      // The middle crumbs are collapsed into a clickable "…" menu — the trail
      // stays compact (first / … / last) instead of spanning the whole card.
      const collapseButton = page
        .getByRole('button', { name: 'Show hidden breadcrumbs' })
        .first();
      await expect(collapseButton).toBeVisible();

      // Clicking the "…" reveals the hidden middle crumbs.
      await collapseButton.click();
      await expect(
        page.getByRole('menu', { name: 'Hidden breadcrumbs' })
      ).toBeVisible();
    });

    test('browsing the tree stacks removable QUERY chips and filters results', async ({
      page,
    }) => {
      test.slow();

      await expandServiceInExploreTree(page, table.serviceResponseData.name);

      await test.step('Selecting a service in the tree adds browse chips', async () => {
        await page
          .getByTestId(`explore-tree-title-${table.serviceResponseData.name}`)
          .click();
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('browse-chip-serviceType')).toBeVisible();
        expect(page.url()).toContain('browsePath');
      });

      await test.step('Removing the service-type chip clears the browse', async () => {
        await page.getByTestId('remove-browse-chip-serviceType').click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('browse-chip-serviceType')
        ).not.toBeVisible();
      });
    });

    test('service type drill-down disables unrelated roots and query-panel Clear resets it', async ({
      page,
    }) => {
      test.slow();

      await test.step('Selecting a database service type narrows the browse tree directionally', async () => {
        const serviceTitle = page.getByTestId(
          `explore-tree-title-${table.service.serviceType.toLowerCase()}`
        );

        // The browse rebuild collapses the tree and can detach the row
        // mid-click; retry expand → click until the chip confirms the select.
        await expect(async () => {
          if (!(await serviceTitle.isVisible())) {
            await expandTreeNode(page, 'Databases');
          }
          await serviceTitle.click();
          await expect(page.getByTestId('browse-chip-serviceType')).toBeVisible(
            {
              timeout: 5000,
            }
          );
        }).toPass({ timeout: 60000 });

        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('browse-chip-serviceType')).toBeVisible();
        await expect(page.getByTestId('clear-all-chips')).toBeVisible();
        await expect(page.getByTestId('clear-filters')).toHaveCount(0);

        await expect(rootTreeNode(page, 'Databases')).not.toHaveClass(
          /ant-tree-treenode-disabled/
        );
        await expect(rootTreeNode(page, 'Dashboards')).toHaveClass(
          /ant-tree-treenode-disabled/
        );
        expect(page.url()).toContain('browsePath');
      });

      await test.step('Query-panel Clear restores the full browse estate', async () => {
        await page.getByTestId('clear-all-chips').click();
        await waitForAllLoadersToDisappear(page);

        const url = new URL(page.url());
        expect(url.searchParams.get('browsePath')).toBeNull();
        expect(url.searchParams.get('quickFilter')).toBeNull();

        await expect(
          page.getByTestId('browse-chip-serviceType')
        ).not.toBeVisible();
        await expect(rootTreeNode(page, 'Dashboards')).not.toHaveClass(
          /ant-tree-treenode-disabled/
        );
      });
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
        .locator('.ant-tree-treenode', {
          has: page.getByTestId('explore-tree-title-Governance'),
        })
        .locator('.ant-tree-switcher')
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
