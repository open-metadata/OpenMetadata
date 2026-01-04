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
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { checkAssetsCount } from '../../utils/domain';

// Helper to navigate directly to data product page via URL
const navigateToDataProductPage = async (
  page: Page,
  dataProduct: DataProduct
) => {
  const fqn = dataProduct.responseData.fullyQualifiedName;
  await page.goto(`/dataProduct/${encodeURIComponent(fqn!)}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

// Helper to navigate to a domain's assets tab and verify asset count
const navigateToDomainAssetsTab = async (
  page: Page,
  domain: Domain,
  expectedAssetCount: number
) => {
  const fqn = domain.responseData.fullyQualifiedName;
  await page.goto(`/domain/${encodeURIComponent(fqn!)}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Click on Assets tab
  await page.getByTestId('assets').click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Verify asset count
  await checkAssetsCount(page, expectedAssetCount);
};

// Helper to verify specific assets are visible in the domain's assets tab
const verifyAssetsInDomain = async (
  page: Page,
  domain: Domain,
  tables: TableClass[],
  expectedVisible: boolean
) => {
  const fqn = domain.responseData.fullyQualifiedName;
  await page.goto(`/domain/${encodeURIComponent(fqn!)}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Click on Assets tab
  await page.getByTestId('assets').click();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  for (const table of tables) {
    const tableFqn = table.entityResponseData.fullyQualifiedName;
    const tableCard = page.locator(`[data-testid="table-data-card_${tableFqn}"]`);
    if (expectedVisible) {
      await expect(tableCard).toBeVisible({ timeout: 10000 });
    } else {
      await expect(tableCard).not.toBeVisible({ timeout: 5000 });
    }
  }
};

test.describe('Data Product Domain Migration', () => {
  const adminUser = new UserClass();
  let shortId: string;
  let sourceDomain: Domain;
  let targetDomain: Domain;
  let dataProduct: DataProduct;
  let table1: TableClass;
  let table2: TableClass;

  test.beforeAll('Setup entities', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await EntityDataClass.preRequisitesForTests(apiContext);

    shortId = uuid();
    sourceDomain = new Domain({
      name: `source_domain_${shortId}`,
      displayName: `Source Domain ${shortId}`,
      description: 'Source domain for migration test',
      domainType: 'Aggregate',
      fullyQualifiedName: `source_domain_${shortId}`,
    });
    targetDomain = new Domain({
      name: `target_domain_${shortId}`,
      displayName: `Target Domain ${shortId}`,
      description: 'Target domain for migration test',
      domainType: 'Aggregate',
      fullyQualifiedName: `target_domain_${shortId}`,
    });
    dataProduct = new DataProduct([sourceDomain], `dp_migrate_${shortId}`);
    table1 = new TableClass();
    table2 = new TableClass();

    await sourceDomain.create(apiContext);
    await targetDomain.create(apiContext);
    await dataProduct.create(apiContext);
    await table1.create(apiContext);
    await table2.create(apiContext);

    // Assign tables to source domain
    await table1.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: sourceDomain.responseData.id, type: 'domain' },
        },
      ],
    });
    await table2.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: sourceDomain.responseData.id, type: 'domain' },
        },
      ],
    });

    // Add tables to data product
    await apiContext.put(
      `/api/v1/dataProducts/${encodeURIComponent(
        dataProduct.responseData.fullyQualifiedName!
      )}/assets/add`,
      {
        data: {
          assets: [
            { id: table1.entityResponseData.id, type: 'table' },
            { id: table2.entityResponseData.id, type: 'table' },
          ],
        },
      }
    );

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      await dataProduct.delete(apiContext);
    } catch {
      // Ignore error
    }
    try {
      await table1.delete(apiContext);
    } catch {
      // Ignore error
    }
    try {
      await table2.delete(apiContext);
    } catch {
      // Ignore error
    }
    try {
      await sourceDomain.delete(apiContext);
    } catch {
      // Ignore error
    }
    try {
      await targetDomain.delete(apiContext);
    } catch {
      // Ignore error
    }

    await EntityDataClass.postRequisitesForTests(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('Changing data product domain via API migrates assets to new domain', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // STEP 1: Verify initial state - assets should be under source domain
      await navigateToDomainAssetsTab(page, sourceDomain, 2);

      // Verify the specific tables are visible under source domain
      await verifyAssetsInDomain(page, sourceDomain, [table1, table2], true);

      // Verify target domain has no assets initially
      await navigateToDomainAssetsTab(page, targetDomain, 0);

      // STEP 2: Navigate to data product and verify it's in source domain
      await navigateToDataProductPage(page, dataProduct);

      await expect(
        page.locator('[data-testid="entity-header-name"]')
      ).toContainText(dataProduct.responseData.name);

      await expect(page.getByTestId('domain-link').first()).toContainText(
        sourceDomain.data.displayName
      );

      // Verify assets are in the data product
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 2);

      // STEP 3: Change domain via API (bypassing complex UI multi-select tree)
      const patchResponse = await apiContext.patch(
        `/api/v1/dataProducts/${dataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/domains',
              value: [
                {
                  id: targetDomain.responseData.id,
                  type: 'domain',
                },
              ],
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      expect(patchResponse.ok()).toBeTruthy();

      // STEP 4: Verify data product now shows target domain
      await navigateToDataProductPage(page, dataProduct);

      await expect(page.getByTestId('domain-link').first()).toContainText(
        targetDomain.data.displayName
      );

      // Verify assets are still in the data product
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 2);

      // STEP 5: THE KEY VERIFICATION - assets should now appear under TARGET domain
      // This is the actual bug we're testing - assets must be migrated to the new domain
      await navigateToDomainAssetsTab(page, targetDomain, 2);

      // Verify the specific tables are now visible under target domain
      await verifyAssetsInDomain(page, targetDomain, [table1, table2], true);

      // STEP 6: Verify assets are no longer under source domain
      await navigateToDomainAssetsTab(page, sourceDomain, 0);
    } finally {
      await afterAction();
      await page.close();
    }
  });

  test('Data product with no assets can change domain without confirmation', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a data product with no assets for this test
    const noAssetsDomain = new Domain({
      name: `no_assets_domain_${shortId}`,
      displayName: `No Assets Domain ${shortId}`,
      description: 'Domain for no assets test',
      domainType: 'Aggregate',
      fullyQualifiedName: `no_assets_domain_${shortId}`,
    });
    const noAssetsDomain2 = new Domain({
      name: `no_assets_domain2_${shortId}`,
      displayName: `No Assets Domain 2 ${shortId}`,
      description: 'Domain for no assets test',
      domainType: 'Aggregate',
      fullyQualifiedName: `no_assets_domain2_${shortId}`,
    });
    const noAssetsDataProduct = new DataProduct(
      [noAssetsDomain],
      `no_assets_dp_${shortId}`
    );

    await noAssetsDomain.create(apiContext);
    await noAssetsDomain2.create(apiContext);
    await noAssetsDataProduct.create(apiContext);

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate directly to data product page via URL
      await navigateToDataProductPage(page, noAssetsDataProduct);

      // Verify we're on the data product page
      await expect(
        page.locator('[data-testid="entity-header-name"]')
      ).toContainText(noAssetsDataProduct.responseData.name);

      // Verify data product is in original domain
      await expect(page.getByTestId('domain-link').first()).toContainText(
        noAssetsDomain.data.displayName
      );

      // Change domain via API
      const patchResponse = await apiContext.patch(
        `/api/v1/dataProducts/${noAssetsDataProduct.responseData.id}`,
        {
          data: [
            {
              op: 'replace',
              path: '/domains',
              value: [
                {
                  id: noAssetsDomain2.responseData.id,
                  type: 'domain',
                },
              ],
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      // Verify patch succeeded
      expect(patchResponse.ok()).toBeTruthy();

      // Refresh page to see updated domain
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify domain changed
      await expect(page.getByTestId('domain-link').first()).toContainText(
        noAssetsDomain2.data.displayName
      );

      // Verify no assets
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 0);
    } finally {
      await afterAction();
      await page.close();
    }

    // Cleanup
    const { apiContext: cleanupContext, afterAction: cleanupAfter } =
      await performAdminLogin(browser);
    try {
      await noAssetsDataProduct.delete(cleanupContext);
    } catch {
      // Ignore
    }
    try {
      await noAssetsDomain.delete(cleanupContext);
    } catch {
      // Ignore
    }
    try {
      await noAssetsDomain2.delete(cleanupContext);
    } catch {
      // Ignore
    }
    await cleanupAfter();
  });
});
