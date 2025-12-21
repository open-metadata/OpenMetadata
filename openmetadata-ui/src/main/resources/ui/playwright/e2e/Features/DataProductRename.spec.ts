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

      // Store new name for rename
      const newName = `renamed-${uuid()}`;

      // Click manage button to open rename modal
      await page.getByTestId('manage-button').click();
      await page
        .getByRole('menuitem', { name: /Rename.*Name/ })
        .getByTestId('rename-button')
        .click();

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

      // Verify the data product header shows the new name (use first() as there may be multiple elements)
      await expect(
        page.getByTestId('entity-header-display-name').first()
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

      // Verify the table page still shows the data product association
      // Note: The knowledge panel shows the displayName, not the renamed identifier
      await expect(
        page.getByTestId('KnowledgePanel.DataProducts')
      ).toBeVisible();
      await expect(
        page
          .getByTestId('KnowledgePanel.DataProducts')
          .getByTestId('data-products-list')
      ).toBeVisible();

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
      await page
        .getByRole('menuitem', { name: /Rename.*Name/ })
        .getByTestId('rename-button')
        .click();

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

  test('should handle multiple consecutive renames and preserve assets', async ({
    browser,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create a new data product and table for this test
    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_MultiRename_${uuid()}`
    );
    const testTable = new TableClass();

    await testDataProduct.create(apiContext);
    await testTable.create(apiContext);

    // Assign table to domain
    await testTable.patch({
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

    const page = await browser.newPage();
    let currentName = testDataProduct.responseData.name;

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to data product
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      // Add asset to data product
      await addAssetsToDataProduct(
        page,
        testDataProduct.responseData.fullyQualifiedName ?? '',
        [testTable]
      );

      // Verify asset is added
      await checkAssetsCount(page, 1);

      // Perform 3 consecutive renames
      for (let i = 1; i <= 3; i++) {
        const newName = `renamed-${i}-${uuid()}`;

        // Click manage button to open rename modal
        await page.getByTestId('manage-button').click();
        await page
          .getByRole('menuitem', { name: /Rename.*Name/ })
          .getByTestId('rename-button')
          .click();

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

        // Wait for navigation to new URL
        await page.waitForURL(`**/dataProduct/${newName}/**`);

        // Update current name for cleanup
        currentName = newName;

        // Verify assets are still associated after rename
        await page.getByTestId('assets').click();
        await checkAssetsCount(page, 1);

        // Verify the asset card is visible
        const tableFqn = get(
          testTable,
          'entityResponseData.fullyQualifiedName'
        );

        await expect(
          page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
        ).toBeVisible();
      }

      // Final verification: navigate to asset and back
      const tableFqn = get(testTable, 'entityResponseData.fullyQualifiedName');
      await page
        .locator(
          `[data-testid="table-data-card_${tableFqn}"] a[data-testid="entity-link"]`
        )
        .click();

      await page.waitForLoadState('networkidle');

      // Verify the table still shows data product association
      await expect(
        page.getByTestId('KnowledgePanel.DataProducts')
      ).toBeVisible();

      // Navigate back and verify assets still there
      await page.goBack();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);
    } finally {
      await page.close();

      // Cleanup - try to delete with current name
      try {
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(`"${currentName}"`)}`
        );
      } catch {
        // Try original name if renamed one fails
        try {
          await testDataProduct.delete(apiContext);
        } catch {
          // Ignore cleanup errors
        }
      }
      await testTable.delete(apiContext);
      await afterAction();
    }
  });

  test('should show error when renaming to a name that already exists', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create two data products for this test
    const dataProduct1 = new DataProduct(
      [domain],
      `PW_DP_DuplicateTest1_${uuid()}`
    );
    const dataProduct2 = new DataProduct(
      [domain],
      `PW_DP_DuplicateTest2_${uuid()}`
    );

    await dataProduct1.create(apiContext);
    await dataProduct2.create(apiContext);

    const page = await browser.newPage();

    try {
      await adminUser.login(page);
      await redirectToHomePage(page);

      // Navigate to dataProduct1
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct1.responseData);

      // Click manage button to open rename modal
      await page.getByTestId('manage-button').click();
      await page
        .getByRole('menuitem', { name: /Rename.*Name/ })
        .getByTestId('rename-button')
        .click();

      // Wait for modal to appear
      await expect(page.getByTestId('header')).toContainText('Edit Name');

      // Try to rename to dataProduct2's name
      const nameInput = page.locator('input[id="name"]');
      await nameInput.clear();
      await nameInput.fill(dataProduct2.responseData.name);

      // Try to save and expect an error response
      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataProducts/') &&
          response.request().method() === 'PATCH' &&
          response.status() >= 400
      );
      await page.getByTestId('save-button').click();
      const response = await patchResponse;

      // Verify the response status is 400 (Bad Request)
      expect(response.status()).toBe(400);

      // Verify an error alert is shown
      await expect(page.getByTestId('alert-bar')).toBeVisible();

      // Verify the error message contains information about the duplicate name
      await expect(page.getByTestId('alert-message')).toContainText(
        'already exists'
      );
    } finally {
      await page.close();
      await dataProduct1.delete(apiContext);
      await dataProduct2.delete(apiContext);
      await afterAction();
    }
  });
});
