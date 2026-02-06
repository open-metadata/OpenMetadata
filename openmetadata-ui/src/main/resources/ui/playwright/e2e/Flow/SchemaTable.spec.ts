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
import { expect, Page } from '@playwright/test';
import { get } from 'lodash';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  addOwner,
  copyAndGetClipboardText,
  testCopyLinkButton,
  updateDisplayNameForEntityChildren,
  validateCopiedLinkFormat,
} from '../../utils/entity';
import { test } from '../fixtures/pages';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

// Grant clipboard permissions for copy link tests
test.use({
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const table = new TableClass();

const crudColumnDisplayName = async (
  page: Page,
  columnFqn: string,
  columnName: string,
  rowSelector: string
) => {
  const searchResponse = page.waitForResponse(
    `/api/v1/tables/name/*/columns/search?q=${columnName}&**`
  );
  await page.getByTestId('searchbar').fill(columnName);
  await searchResponse;
  await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

  // Add the display name to a new value
  await updateDisplayNameForEntityChildren(
    page,
    {
      oldDisplayName: '',
      newDisplayName: `${columnName}_updated`,
    },
    columnFqn,
    rowSelector
  );

  // Update the display name to a new value
  await updateDisplayNameForEntityChildren(
    page,
    {
      oldDisplayName: `${columnName}_updated`,
      newDisplayName: `${columnName}_updated_again`,
    },
    columnFqn,
    rowSelector
  );

  // Reset the display name to the original value
  await updateDisplayNameForEntityChildren(
    page,
    {
      oldDisplayName: `${columnName}_updated_again`,
      newDisplayName: ``,
    },
    columnFqn,
    rowSelector
  );
};

test.beforeEach(
  async ({ editDescriptionPage, editTagsPage, editGlossaryTermPage }) => {
    await redirectToHomePage(editDescriptionPage);
    await redirectToHomePage(editTagsPage);
    await redirectToHomePage(editGlossaryTermPage);
  }
);

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.delete(apiContext);

  await afterAction();
});

test('schema table test', async ({ dataStewardPage, ownerPage, page }) => {
  test.slow();

  await test.step('set owner', async () => {
    const loggedInUserRequest = ownerPage.waitForResponse(
      `/api/v1/users/loggedInUser*`
    );
    await redirectToHomePage(ownerPage);
    const loggedInUserResponse = await loggedInUserRequest;
    const loggedInUser = await loggedInUserResponse.json();

    await redirectToHomePage(page);

    await table.visitEntityPage(page);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await addOwner({
      page,
      owner: loggedInUser.displayName,
      type: 'Users',
      endpoint: EntityTypeEndpoint.Table,
      dataTestId: 'data-assets-header',
    });
  });

  await test.step('set the description', async () => {
    const pages = [dataStewardPage, page, ownerPage];

    const columnFqn = get(
      table,
      'entityResponseData.columns[2].fullyQualifiedName'
    );

    const columnName = table.columnsName[2];

    for (const currentPage of pages) {
      await redirectToHomePage(currentPage);

      await table.visitEntityPage(currentPage);
      await currentPage.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await crudColumnDisplayName(
        currentPage,
        columnFqn,
        columnName,
        'data-row-key'
      );
    }
  });
});

test('Schema Table Pagination should work Properly', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  const tableResponse = page.waitForResponse(`/api/v1/tables?limit=15**`);

  await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
  await tableResponse;

  await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
    '15 / Page'
  );

  await expect(page.getByTestId('previous')).toBeDisabled();

  await expect(page.getByTestId('next')).not.toBeDisabled();

  const tableResponse2 = page.waitForResponse(`/api/v1/tables?**limit=15**`);
  await page.getByTestId('next').click();
  await tableResponse2;

  await expect(page.getByTestId('previous')).not.toBeDisabled();

  await expect(page.getByTestId('page-indicator')).toContainText('2');

  const tableResponse3 = page.waitForResponse(`/api/v1/tables?**limit=15**`);
  await page.getByTestId('previous').click();
  await tableResponse3;

  await expect(page.getByTestId('page-indicator')).toContainText('1');
});

test('Copy column link button should copy the column URL to clipboard', async ({
  page,
}) => {
  // Navigate directly to the table page instead of searching
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await testCopyLinkButton({
    page,
    buttonTestId: 'copy-column-link-button',
    containerTestId: 'entity-table',
    expectedUrlPath: '/table/',
    entityFqn: table.entityResponseData?.['fullyQualifiedName'] ?? '',
  });
});

test('Copy column link should have valid URL format', async ({ page }) => {
  await redirectToHomePage(page);
  const columnResponse = page.waitForResponse(
    `/api/v1/tables/name/${table.entityResponseData?.['fullyQualifiedName']}/columns?*`
  );
  await table.visitEntityPage(page);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
  const columnData = await columnResponse.then((res) => res.json());

  await expect(page.getByTestId('entity-table')).toBeVisible();

  const copyButton = page.getByTestId('copy-column-link-button').first();
  await expect(copyButton).toBeVisible();

  const clipboardText = await copyAndGetClipboardText(page, copyButton);

  const validationResult = validateCopiedLinkFormat({
    clipboardText,
    expectedEntityType: 'table',
    entityFqn: table.entityResponseData?.['fullyQualifiedName'] ?? '',
  });

  expect(validationResult.isValid).toBe(true);
  expect(validationResult.protocol).toMatch(/^https?:$/);
  expect(validationResult.pathname).toContain('table');

  // Visit the copied link to verify it opens the side panel
  await page.goto(clipboardText);

  // Verify side panel is open
  const sidePanel = page.locator('.column-detail-panel');
  await expect(sidePanel).toBeVisible();
  // Verify the correct column is showing in the panel
  const columnName = columnData.data?.[0]?.name;

  await expect(sidePanel).toContainText(columnName);

  // Close side panel
  await page.getByTestId('close-button').click();
  await expect(sidePanel).not.toBeVisible();

  // Verify URL does not contain the column part
  await expect(page).toHaveURL(
    new RegExp(`/table/${table.entityResponseData?.['fullyQualifiedName']}$`)
  );
});

test('Copy nested column link should include full hierarchical path', async ({
  page,
}) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  await expect(page.getByTestId('entity-table')).toBeVisible();

  const expandButtons = page.locator('[data-testid="expand-icon"]');
  const expandButtonCount = await expandButtons.count();

  if (expandButtonCount > 0) {
    await expandButtons.first().click();

    const nestedCopyButtons = page.getByTestId('copy-column-link-button');
    const nestedButtonCount = await nestedCopyButtons.count();

    if (nestedButtonCount > 1) {
      const nestedCopyButton = nestedCopyButtons.nth(1);
      await expect(nestedCopyButton).toBeVisible();

      const clipboardText = await copyAndGetClipboardText(
        page,
        nestedCopyButton
      );

      expect(clipboardText).toContain('/table/');
      expect(clipboardText).toContain(
        table.entityResponseData?.['fullyQualifiedName'] ?? ''
      );

      // Visit the copied link to verify it opens the side panel
      await page.goto(clipboardText);

      // Verify side panel is open
      const sidePanel = page.locator('.column-detail-panel');
      await expect(sidePanel).toBeVisible();

      // Verify the correct column is showing in the panel
      const nestedColumnName =
        table.entityResponseData.columns?.[0]?.children?.[0]?.name;
      if (nestedColumnName) {
        await expect(sidePanel).toContainText(nestedColumnName);
      }

      // Close side panel
      await page.getByTestId('close-button').click();
      await expect(sidePanel).not.toBeVisible();

      // Verify URL does not contain the column part
      await expect(page).toHaveURL(
        new RegExp(
          `/table/${table.entityResponseData?.['fullyQualifiedName']}$`
        )
      );
    }
  }
});
