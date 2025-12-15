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
  // Clear page size preferences to prevent carryover between tests
  await page.evaluate(() => {
    const preferences = localStorage.getItem('om-user-preferences');
    if (preferences) {
      const parsed = JSON.parse(preferences);
      delete parsed.state?.globalPageSize;
      delete parsed.state?.assetListPageSize;
      delete parsed.state?.contentListPageSize;
      localStorage.setItem('om-user-preferences', JSON.stringify(parsed));
    }
  });

  const schemaTable = new TableClass();
  await schemaTable.create(page.request, 50);

  const res = page.waitForResponse('/api/v1/tables?limit=25**');
  await schemaTable.visitEntityPage(page);
  await res;

  // Check all schema from 1 to 50, and 25 is the max-pagination chip
  await expect(page.getByTitle('25')).toBeVisible();

  for (let i = 1; i <= 50; i++) {
    if (i < 10) {
      await expect(page.getByText(`test_col_000${i}`)).toBeVisible();
    } else {
      await expect(page.getByText(`test_col_00${i}`)).toBeVisible();
    }

    // Click "Next Page" after every 25 checks
    // Click "Next Page" after every 25 checks, but not at 50
    if (i % 25 === 0 && i < 50) {
      // Schema from 51 to 75 Should not be visible
      for (let j = 51; j <= 75; j++) {
        await expect(page.getByText(`test_col_00${j}`)).not.toBeVisible();
      }
      await page.getByRole('listitem', { name: 'Next Page' }).click();
    }
  }
});
