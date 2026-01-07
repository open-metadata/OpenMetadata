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

import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  checkAssetsCount,
  goToAssetsTab,
  selectDataProduct,
  verifyAssetsInDomain,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Data Product Domain Migration', () => {
  let shortId: string;
  let sourceDomain: Domain;
  let targetDomain: Domain;
  let dataProduct: DataProduct;
  let table1: TableClass;
  let table2: TableClass;

  test.beforeAll('Setup entities', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
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
    const { apiContext, afterAction } = await createNewPage(browser);
    await dataProduct.delete(apiContext);
    await table1.delete(apiContext);
    await table2.delete(apiContext);
    await sourceDomain.delete(apiContext);
    await targetDomain.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Changing data product domain via API migrates assets to new domain', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);
    try {
      await redirectToHomePage(page);

      // STEP 1: Verify initial state - assets should be under source domain
      await verifyAssetsInDomain(
        page,
        sourceDomain.data,
        [table1, table2],
        true
      );
      await checkAssetsCount(page, 2);

      // Verify target domain has no assets initially
      await goToAssetsTab(page, targetDomain.data);
      await checkAssetsCount(page, 0);

      // STEP 2: Navigate to data product and verify it's in source domain
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

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
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      await expect(page.getByTestId('domain-link').first()).toContainText(
        targetDomain.data.displayName
      );

      // Verify assets are still in the data product
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 2);

      // STEP 5: THE KEY VERIFICATION - assets should now appear under TARGET domain
      // This is the actual bug we're testing - assets must be migrated to the new domain
      await verifyAssetsInDomain(
        page,
        targetDomain.data,
        [table1, table2],
        true
      );
      await checkAssetsCount(page, 2);

      // STEP 6: Verify assets are no longer under source domain
      await goToAssetsTab(page, sourceDomain.data);
      await checkAssetsCount(page, 0);
    } finally {
      await afterAction();
    }
  });

  test('Data product with no assets can change domain without confirmation', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

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

    try {
      await redirectToHomePage(page);

      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, noAssetsDataProduct.data);

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
    }

    const { apiContext: cleanupContext, afterAction: cleanupAfter } =
      await getApiContext(page);
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
