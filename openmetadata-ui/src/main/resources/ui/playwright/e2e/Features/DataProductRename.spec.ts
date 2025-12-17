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
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import {
  addAssetsToDataProduct,
  checkAssetsCount,
  selectDataProduct,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

const adminUser = new UserClass();
const domain = new Domain();
const dataProduct = new DataProduct([domain]);
const table = new TableClass();

test.describe('Data Product Rename', () => {
  test.beforeAll(
    'Setup domain, data product and table',
    async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await EntityDataClass.preRequisitesForTests(apiContext);
      await domain.create(apiContext);
      await dataProduct.create(apiContext);
      await table.create(apiContext);

      // Assign table to domain so it can be added to data product
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/domains/0',
            value: {
              id: domain.responseData.id,
              type: 'domain',
            },
          },
        ],
      });

      await afterAction();
    }
  );

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Try to delete renamed data product first, then fall back to original
    try {
      await apiContext.delete(
        `/api/v1/dataProducts/name/${encodeURIComponent(
          dataProduct.responseData?.fullyQualifiedName ?? dataProduct.data.name
        )}`
      );
    } catch {
      // Data product may have been renamed, ignore error
    }

    await table.delete(apiContext);
    await domain.delete(apiContext);
    await EntityDataClass.postRequisitesForTests(apiContext);
    await adminUser.delete(apiContext);
    await afterAction();
  });

  test('should rename data product and verify assets are still associated', async ({
    browser,
  }) => {
    test.slow();

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to data product
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.responseData);

      // Add asset to data product
      await addAssetsToDataProduct(
        page,
        dataProduct.responseData.fullyQualifiedName ?? '',
        [table]
      );

      // Verify asset is added
      await checkAssetsCount(page, 1);

      // Store original name and FQN
      const originalName = dataProduct.responseData.name;
      const newName = `renamed-${uuid()}`;

      // Click manage button to open rename modal
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').click();

      // Wait for modal to appear
      await expect(page.getByTestId('header')).toContainText('Edit Name');

      // Clear and enter new name
      const nameInput = page.locator('input[id="name"]');
      await nameInput.clear();
      await nameInput.fill(newName);

      // Save the rename
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataProducts/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      await patchResponse;

      // Wait for navigation to new URL (URL should change to new name)
      await page.waitForURL(`**/dataProduct/${newName}/**`);

      // Verify the data product header shows the new name
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toBeVisible();

      // Update the data product response data for cleanup
      dataProduct.responseData.name = newName;
      dataProduct.responseData.fullyQualifiedName = `"${newName}"`;

      // Verify assets are still associated with the renamed data product
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);

      const tableFqn = get(table, 'entityResponseData.fullyQualifiedName');

      // Click on the asset to navigate to the table page
      await page
        .locator(
          `[data-testid="table-data-card_${tableFqn}"] a[data-testid="entity-link"]`
        )
        .click();

      await page.waitForLoadState('networkidle');

      // Verify the table page shows the UPDATED data product name
      await expect(
        page
          .getByTestId('KnowledgePanel.DataProducts')
          .getByTestId('data-products-list')
      ).toContainText(newName);

      // Navigate back to data product and verify assets tab still shows the asset
      await page.goBack();
      await page.waitForLoadState('networkidle');

      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);

      // Verify the asset card is still visible
      await expect(
        page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });

  test('should update only display name without changing the actual name', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a new data product for this test
    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_DisplayNameTest_${uuid()}`
    );
    await testDataProduct.create(apiContext);

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to data product
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      const originalName = testDataProduct.responseData.name;
      const newDisplayName = `Updated Display Name ${uuid()}`;

      // Click manage button to open rename modal
      await page.getByTestId('manage-button').click();
      await page.getByTestId('rename-button').click();

      // Wait for modal to appear
      await expect(page.getByTestId('header')).toContainText('Edit Name');

      // Only update display name, keep the actual name
      const displayNameInput = page.locator('input[id="displayName"]');
      await displayNameInput.clear();
      await displayNameInput.fill(newDisplayName);

      // Save the changes
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataProducts/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('save-button').click();
      await patchResponse;

      // Verify the URL still uses the original name (not changed)
      await expect(page).toHaveURL(new RegExp(`dataProduct/${originalName}`));

      // Verify the display name is updated in the header
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newDisplayName);
    } finally {
      await page.close();
      await testDataProduct.delete(apiContext);
      await afterAction();
    }
  });
});
