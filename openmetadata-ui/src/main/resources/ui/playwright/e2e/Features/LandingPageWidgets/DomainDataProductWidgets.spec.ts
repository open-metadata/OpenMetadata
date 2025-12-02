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
import { Page, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
} from '../../../utils/domain';
import { sidebarClick } from '../../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const domain = new Domain();
const dataProduct = new DataProduct([domain]);
const table = new TableClass();
const topic = new TopicClass();

test.describe.serial('Domain and Data Product Asset Counts', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await domain.create(apiContext);
    await dataProduct.create(apiContext);
    await table.create(apiContext);
    await topic.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await table.delete(apiContext);
    await topic.delete(apiContext);
    await dataProduct.delete(apiContext);
    await domain.delete(apiContext);

    await afterAction();
  });

  test('Domain page should show 0 asset count initially', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);

    // Check the assets tab shows 0
    await checkAssetsCount(page, 0);
  });

  test('Data Product page should show 0 asset count initially', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    // Check the assets tab shows 0
    await checkAssetsCount(page, 0);
  });

  test('Domain asset count should update when assets are added', async ({
    page,
  }) => {
    // Navigate to domain page and add assets via UI
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);

    // addAssetsToDomain navigates to assets tab, adds assets, and verifies count
    await addAssetsToDomain(page, domain, [table, topic]);

    // After addAssetsToDomain, count should be 2
    await checkAssetsCount(page, 2);
  });

  test('Data Product asset count should update when assets are added', async ({
    page,
  }) => {
    // Navigate to data product page
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    // Add assets to data product using UI
    // addAssetsToDataProduct clicks assets tab and verifies 0 count first
    await addAssetsToDataProduct(
      page,
      dataProduct.responseData.fullyQualifiedName ?? '',
      [table, topic]
    );

    // checkAssetsCount is called inside addAssetsToDataProduct
  });

  test('Domain asset count should update when assets are removed', async ({
    page,
  }) => {
    // Current state: domain has 2 assets (table, topic)
    // Navigate to domain page
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);

    // Click assets tab and verify count is 2
    await page.getByTestId('assets').click();
    await checkAssetsCount(page, 2);

    // Select topic and remove it
    const topicFqn = topic.entityResponseData.fullyQualifiedName;
    await page
      .locator(`[data-testid="table-data-card_${topicFqn}"] input`)
      .check();

    const removeRes = page.waitForResponse('**/assets/remove');
    await page.getByTestId('delete-all-button').click();
    await removeRes;

    // Check assets count is now 1
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 1);
  });

  test('Data Product asset count should update when assets are removed', async ({
    page,
  }) => {
    // Navigate to data product page
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    // Click assets tab - data product should have some assets from previous test
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');

    // Wait for assets to load
    await page
      .waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 10000,
      })
      .catch(() => {
        /* ignore if loader not found */
      });

    // Keep removing assets until no more are left
    let hasAssets = true;
    while (hasAssets) {
      const checkboxes = page.locator(
        '[data-testid^="table-data-card_"] input[type="checkbox"]'
      );
      const count = await checkboxes.count();

      if (count === 0) {
        hasAssets = false;

        break;
      }

      // Try to use Select All if available, otherwise select individually
      const selectAll = page.getByRole('checkbox', { name: 'Select All' });
      if (await selectAll.isVisible()) {
        await selectAll.check();
      } else {
        // Select all visible assets individually
        for (let i = 0; i < count; i++) {
          await checkboxes.nth(i).check();
        }
      }

      const removeRes = page.waitForResponse('**/assets/remove');
      await page.getByTestId('delete-all-button').click();
      await removeRes;

      // Wait for search to refresh
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
    }

    // Refresh and check the assets tab shows 0
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 0);
  });

  test('Domain should only count data assets, not data products', async ({
    page,
  }) => {
    // The domain has 1 data asset (table) and 1 data product
    // The domain page should only show 1 asset (table only), not counting the data product
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);

    // Domain should show 1 (table only), not counting the data product
    await checkAssetsCount(page, 1);
  });
});

// Separate test suite for sub-domain asset count tests
const parentDomain = new Domain();
let subDomain: SubDomain;
const subDomainTable = new TableClass();
const subDomainDashboard = new DashboardClass();

const navigateToSubDomain = async (page: Page) => {
  await redirectToHomePage(page);
  await sidebarClick(page, SidebarItem.DOMAIN);
  await selectDomain(page, parentDomain.data);
  await page.getByTestId('subdomains').click();
  await page.waitForLoadState('networkidle');
  await page.getByTestId(subDomain.data.name).click();
  await page.waitForLoadState('networkidle');
};

test.describe.serial('Sub-Domain Asset Counts', () => {
  test.beforeAll('Setup sub-domain test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await parentDomain.create(apiContext);
    // Create SubDomain after parentDomain is created so it has the correct parent reference
    subDomain = new SubDomain(parentDomain);
    await subDomain.create(apiContext);
    await subDomainTable.create(apiContext);
    await subDomainDashboard.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup sub-domain test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await subDomainTable.delete(apiContext);
    await subDomainDashboard.delete(apiContext);
    await subDomain.delete(apiContext);
    await parentDomain.delete(apiContext);

    await afterAction();
  });

  test('Parent domain and sub-domain should show 0 assets initially', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, parentDomain.data);

    // Parent domain should show 0 assets
    await checkAssetsCount(page, 0);

    // Navigate to sub-domain and verify it also shows 0 assets
    await navigateToSubDomain(page);
    await checkAssetsCount(page, 0);
  });

  test('Adding assets to sub-domain should update both sub-domain and parent domain counts', async ({
    page,
  }) => {
    await navigateToSubDomain(page);

    // Click on Assets tab
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');

    // Add assets via UI - click Add button and select Assets
    await page.getByTestId('domain-details-add-button').click();
    await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();

    // Wait for modal to load
    await page
      .waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 10000,
      })
      .catch(() => {
        /* ignore if loader not found */
      });

    // Search and select the table
    const tableName = subDomainTable.entityResponseData.name;
    const tableFqn = subDomainTable.entityResponseData.fullyQualifiedName;
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(tableName);
    await page.waitForResponse(
      `/api/v1/search/query?q=${tableName}&index=all&from=0&size=25&*`
    );
    await page
      .locator(`[data-testid="table-data-card_${tableFqn}"] input`)
      .check();

    // Save and wait for response
    const assetsAddRes = page.waitForResponse('**/assets/add');
    await page.getByTestId('save-btn').click();
    await assetsAddRes;

    // Reload and check sub-domain count is 1
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 1);

    // Now check parent domain - it should also show 1 (includes sub-domain assets)
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, parentDomain.data);
    await checkAssetsCount(page, 1);
  });

  test('Adding more assets to sub-domain should update parent domain count accordingly', async ({
    page,
  }) => {
    await navigateToSubDomain(page);

    // Click on Assets tab
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');

    // Add dashboard via UI
    await page.getByTestId('domain-details-add-button').click();
    await page.getByRole('menuitem', { name: 'Assets', exact: true }).click();

    await page
      .waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 10000,
      })
      .catch(() => {
        /* ignore if loader not found */
      });

    const dashboardName = subDomainDashboard.entityResponseData.name;
    const dashboardFqn =
      subDomainDashboard.entityResponseData.fullyQualifiedName;
    await page
      .getByTestId('asset-selection-modal')
      .getByTestId('searchbar')
      .fill(dashboardName);
    await page.waitForResponse(
      `/api/v1/search/query?q=${dashboardName}&index=all&from=0&size=25&*`
    );
    await page
      .locator(`[data-testid="table-data-card_${dashboardFqn}"] input`)
      .check();

    const assetsAddRes = page.waitForResponse('**/assets/add');
    await page.getByTestId('save-btn').click();
    await assetsAddRes;

    // Reload and check sub-domain count is 2
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 2);

    // Check parent domain count is also 2
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, parentDomain.data);
    await checkAssetsCount(page, 2);
  });

  test('Removing assets from sub-domain should update both counts', async ({
    page,
  }) => {
    await navigateToSubDomain(page);

    // Click on Assets tab and verify count is 2
    await page.getByTestId('assets').click();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 2);

    // Select dashboard and remove it
    const dashboardFqn =
      subDomainDashboard.entityResponseData.fullyQualifiedName;
    await page
      .locator(`[data-testid="table-data-card_${dashboardFqn}"] input`)
      .check();

    const removeRes = page.waitForResponse('**/assets/remove');
    await page.getByTestId('delete-all-button').click();
    await removeRes;

    // Reload and check sub-domain count is 1
    await page.reload();
    await page.waitForLoadState('networkidle');
    await checkAssetsCount(page, 1);

    // Check parent domain count is also 1
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, parentDomain.data);
    await checkAssetsCount(page, 1);
  });
});
