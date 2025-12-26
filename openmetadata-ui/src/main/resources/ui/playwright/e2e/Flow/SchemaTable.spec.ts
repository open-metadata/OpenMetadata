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
import { test } from '../fixtures/pages';

import { get } from 'lodash';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  addOwner,
  updateDisplayNameForEntityChildren,
} from '../../utils/entity';

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

test('Schema Table Pagination should work Properly', async ({ page }) => {
  const tableResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/tables') &&
      response.url().includes('limit=25')
  );

  await page.goto('/databaseSchema/sample_data.ecommerce_db.shopify');
  await tableResponse;

  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

  // Verify page size dropdown shows correct value (25 for assetListPageSize)
  await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
    '25 / Page'
  );

  // Verify the page size options include the new larger sizes
  await page.getByTestId('page-size-selection-dropdown').click();

  // Check that 250 and 500 options are available
  await expect(
    page.getByRole('menuitem', { name: '250 / Page' })
  ).toBeVisible();
  await expect(
    page.getByRole('menuitem', { name: '500 / Page' })
  ).toBeVisible();
});
