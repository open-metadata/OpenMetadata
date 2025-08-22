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
