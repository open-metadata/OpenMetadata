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
import { get } from 'lodash';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  addAssetsToDataProduct,
  checkAssetsCount,
  selectDataProduct,
} from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });
const domain = new Domain();
const classification = new ClassificationClass();
const tag = new TagClass({ classification: classification.data.name });

/**
 * These tests verify that assets are preserved when a DataProduct is renamed
 * and then other fields (description, tags, owner) are updated within the same session.
 *
 * Background: The system consolidates changes made by the same user within a session timeout.
 * When a rename occurs, consolidation could revert to the previous version which has the old FQN,
 * potentially breaking asset relationships. The fix skips consolidation when the name has changed.
 */
test.describe('Data Product Rename + Field Update Consolidation', () => {
  test.beforeAll('Setup domain and admin user', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await EntityDataClass.preRequisitesForTests(apiContext);
    await domain.create(apiContext);
    await classification.create(apiContext);
    await tag.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await tag.delete(apiContext);
    await classification.delete(apiContext);
    await domain.delete(apiContext);
    await EntityDataClass.postRequisitesForTests(apiContext);
    await afterAction();
  });

  test.beforeEach('Navigate to home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  /**
   * Helper to perform rename via UI
   */
  async function performRename(page: Page, newName: string): Promise<void> {
    await page.getByTestId('manage-button').click();
    await page
      .getByRole('menuitem', { name: /Rename.*Name/ })
      .getByTestId('rename-button')
      .click();

    await expect(page.getByTestId('header')).toContainText('Edit Name');

    const nameInput = page.locator('input[id="name"]');
    await nameInput.clear();
    await nameInput.fill(newName);

    const patchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataProducts/') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save-button').click();
    await patchResponse;

    await page.waitForURL(`**/dataProduct/${newName}/**`);
    // Wait for the page to fully load after rename navigation
    await page.waitForLoadState('networkidle');
    // Ensure the data product header is visible with the new name
    await expect(page.getByTestId('entity-header-name')).toBeVisible();
  }

  /**
   * Helper to update description via UI
   */
  async function updateDescription(
    page: Page,
    description: string
  ): Promise<void> {
    await page.getByTestId('edit-description').click();

    const descriptionBox = '.om-block-editor[contenteditable="true"]';
    await page.locator(descriptionBox).first().click();
    await page.locator(descriptionBox).first().clear();
    await page.locator(descriptionBox).first().fill(description);

    const patchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataProducts/') &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('save').click();
    await patchResponse;

    await page.waitForLoadState('networkidle');
  }

  test('Rename then update description - assets should be preserved', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_RenameDesc_${uuid()}`
    );
    const testTable = new TableClass();

    await testDataProduct.create(apiContext);
    await testTable.create(apiContext);

    await testTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: domain.responseData.id, type: 'domain' },
        },
      ],
    });

    let currentName = testDataProduct.responseData.name;

    try {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      await addAssetsToDataProduct(
        page,
        testDataProduct.responseData.fullyQualifiedName ?? '',
        [testTable]
      );

      await checkAssetsCount(page, 1);

      // Step 1: Rename the data product
      const newName = `renamed-${uuid()}`;
      await performRename(page, newName);
      currentName = newName;

      // Verify assets after rename
      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await checkAssetsCount(page, 1);

      // Step 2: Update description (this triggers consolidation logic)
      await page.getByTestId('documentation').click();
      await page.waitForLoadState('networkidle');
      await updateDescription(
        page,
        `Updated description after rename ${uuid()}`
      );

      // Step 3: Verify assets are still preserved after consolidation
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);

      const tableFqn = get(testTable, 'entityResponseData.fullyQualifiedName');
      await expect(
        page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
      ).toBeVisible();

      // Verify from the table side
      await page
        .locator(
          `[data-testid="table-data-card_${tableFqn}"] a[data-testid="entity-link"]`
        )
        .click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByTestId('KnowledgePanel.DataProducts')
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(`"${currentName}"`)}`
        );
      } catch {
        try {
          await testDataProduct.delete(apiContext);
        } catch {
          // Ignore
        }
      }
      await testTable.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename then add tags - assets should be preserved', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_RenameTag_${uuid()}`
    );
    const testTable = new TableClass();

    await testDataProduct.create(apiContext);
    await testTable.create(apiContext);

    await testTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: domain.responseData.id, type: 'domain' },
        },
      ],
    });

    let currentName = testDataProduct.responseData.name;

    try {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      await addAssetsToDataProduct(
        page,
        testDataProduct.responseData.fullyQualifiedName ?? '',
        [testTable]
      );

      await checkAssetsCount(page, 1);

      // Step 1: Rename
      const newName = `renamed-tag-${uuid()}`;
      await performRename(page, newName);
      currentName = newName;

      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await checkAssetsCount(page, 1);

      // Step 2: Add a tag (this triggers consolidation logic)
      await page.getByTestId('documentation').click();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('tags-container').getByTestId('add-tag').click();

      await page
        .locator('[data-testid="tag-selector"] input')
        .fill(tag.data.name);

      await page
        .locator(`[data-testid="tag-${tag.responseData.fullyQualifiedName}"]`)
        .click();

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataProducts/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('saveAssociatedTag').click();
      await patchResponse;

      await page.waitForLoadState('networkidle');

      // Step 3: Verify assets
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);

      const tableFqn = get(testTable, 'entityResponseData.fullyQualifiedName');
      await expect(
        page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(`"${currentName}"`)}`
        );
      } catch {
        try {
          await testDataProduct.delete(apiContext);
        } catch {
          // Ignore
        }
      }
      await testTable.delete(apiContext);
      await afterAction();
    }
  });

  test('Rename then change owner - assets should be preserved', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_RenameOwner_${uuid()}`
    );
    const testTable = new TableClass();
    const newOwner = new UserClass();

    await testDataProduct.create(apiContext);
    await testTable.create(apiContext);
    await newOwner.create(apiContext);

    await testTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: domain.responseData.id, type: 'domain' },
        },
      ],
    });

    let currentName = testDataProduct.responseData.name;

    try {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      await addAssetsToDataProduct(
        page,
        testDataProduct.responseData.fullyQualifiedName ?? '',
        [testTable]
      );

      await checkAssetsCount(page, 1);

      // Step 1: Rename
      const newName = `renamed-owner-${uuid()}`;
      await performRename(page, newName);
      currentName = newName;

      await page.getByTestId('assets').click();
      await page.waitForLoadState('networkidle');
      await checkAssetsCount(page, 1);

      // Step 2: Change owner (this triggers consolidation logic)
      await page.getByTestId('documentation').click();
      await page.waitForLoadState('networkidle');
      // Use add-owner since there's no owner initially
      await page.getByTestId('add-owner').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.getByRole('tab', { name: 'Users' }).click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Wait for search response after typing user name
      const ownerDisplayName = newOwner.getUserDisplayName();
      const searchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=user_search_index')
      );
      await page
        .getByTestId('owner-select-users-search-bar')
        .fill(ownerDisplayName);
      await searchResponse;
      await page.waitForLoadState('networkidle');

      // Click on the user in the list
      await page
        .getByRole('listitem', { name: ownerDisplayName, exact: true })
        .click();

      const patchResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataProducts/') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('selectable-list-update-btn').click();
      await patchResponse;

      await page.waitForLoadState('networkidle');

      // Step 3: Verify assets
      await page.getByTestId('assets').click();
      await checkAssetsCount(page, 1);

      const tableFqn = get(testTable, 'entityResponseData.fullyQualifiedName');
      await expect(
        page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(`"${currentName}"`)}`
        );
      } catch {
        try {
          await testDataProduct.delete(apiContext);
        } catch {
          // Ignore
        }
      }
      await testTable.delete(apiContext);
      await newOwner.delete(apiContext);
      await afterAction();
    }
  });

  test('Multiple rename + update cycles - assets should be preserved', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);

    const testDataProduct = new DataProduct(
      [domain],
      `PW_DP_MultiCycle_${uuid()}`
    );
    const testTable = new TableClass();

    await testDataProduct.create(apiContext);
    await testTable.create(apiContext);

    await testTable.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: { id: domain.responseData.id, type: 'domain' },
        },
      ],
    });

    let currentName = testDataProduct.responseData.name;

    try {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, testDataProduct.responseData);

      await addAssetsToDataProduct(
        page,
        testDataProduct.responseData.fullyQualifiedName ?? '',
        [testTable]
      );

      await checkAssetsCount(page, 1);

      // Perform 3 cycles of: rename -> update description
      for (let i = 1; i <= 3; i++) {
        // Rename
        const newName = `renamed-cycle-${i}-${uuid()}`;
        await performRename(page, newName);
        currentName = newName;

        // Verify assets after rename
        await page.getByTestId('assets').click();
        await page.waitForLoadState('networkidle');
        await checkAssetsCount(page, 1);

        // Update description
        await page.getByTestId('documentation').click();
        await page.waitForLoadState('networkidle');
        await updateDescription(page, `Description after rename cycle ${i}`);

        // Verify assets after description update
        await page.getByTestId('assets').click();
        await page.waitForLoadState('networkidle');
        await checkAssetsCount(page, 1);

        const tableFqn = get(
          testTable,
          'entityResponseData.fullyQualifiedName'
        );
        await expect(
          page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
        ).toBeVisible();
      }

      // Final verification from table side
      const tableFqn = get(testTable, 'entityResponseData.fullyQualifiedName');
      await page
        .locator(
          `[data-testid="table-data-card_${tableFqn}"] a[data-testid="entity-link"]`
        )
        .click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.getByTestId('KnowledgePanel.DataProducts')
      ).toBeVisible();
    } finally {
      try {
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(`"${currentName}"`)}`
        );
      } catch {
        try {
          await testDataProduct.delete(apiContext);
        } catch {
          // Ignore
        }
      }
      await testTable.delete(apiContext);
      await afterAction();
    }
  });
});
