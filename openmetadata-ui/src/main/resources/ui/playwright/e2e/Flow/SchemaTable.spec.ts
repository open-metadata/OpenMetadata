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
import { Page, test as base } from '@playwright/test';

import { redirectToHomePage } from '../../utils/common';
import { updateDisplayNameForEntityChildren } from '../../utils/entity';

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
  editDescriptionPage: Page;
  editTagsPage: Page;
  editGlossaryTermPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage({
      storageState: 'playwright/.auth/admin.json',
    });

    await use(adminPage);
    await adminPage.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/dataConsumer.json',
    });

    await use(page);
    await page.close();
  },
  editDescriptionPage: async ({ browser }, use) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/editDescription.json',
    });

    await use(page);
    await page.close();
  },
  editTagsPage: async ({ browser }, use) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/editTags.json',
    });

    await use(page);
    await page.close();
  },
  editGlossaryTermPage: async ({ browser }, use) => {
    const page = await browser.newPage({
      storageState: 'playwright/.auth/editGlossaryTerm.json',
    });

    await use(page);
    await page.close();
  },
});

test.beforeEach(async ({ adminPage, userPage }) => {
  await redirectToHomePage(adminPage);
  await redirectToHomePage(userPage);
});

const crudColumnDisplayName = async (
  page: Page,
  columnFqn: string,
  columnName: string,
  rowSelector: string
) => {
  const searchResponse = page.waitForResponse(
    `/api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns/search?q=${columnName}&limit=50&offset=0&fields=tags%2CcustomMetrics&include=all`
  );
  await page.getByTestId('searchbar').fill(columnName);
  await searchResponse;

  await updateDisplayNameForEntityChildren(
    page,
    {
      oldDisplayName: columnName,
      newDisplayName: `${columnName}_updated`,
    },
    columnFqn,
    rowSelector
  );
};

test('schema table test', async ({
  //   adminPage,
  //   userPage,
  editDescriptionPage,
  editTagsPage,
  editGlossaryTermPage,
}) => {
  await editDescriptionPage.goto(
    '/table/sample_data.ecommerce_db.shopify.performance_test_table'
  );
  await editDescriptionPage.waitForLoadState('networkidle');
  await crudColumnDisplayName(
    editDescriptionPage,
    'sample_data.ecommerce_db.shopify.performance_test_table.test_col_2000',
    'test_col_2000',
    'data-row-key'
  );
  await editTagsPage.goto(
    '/table/sample_data.ecommerce_db.shopify.performance_test_table'
  );
  await editTagsPage.waitForLoadState('networkidle');
  await crudColumnDisplayName(
    editTagsPage,
    'sample_data.ecommerce_db.shopify.performance_test_table.test_col_2000',
    'test_col_2000',
    'data-row-key'
  );
  await editGlossaryTermPage.goto(
    '/table/sample_data.ecommerce_db.shopify.performance_test_table'
  );
  await editGlossaryTermPage.waitForLoadState('networkidle');
  await crudColumnDisplayName(
    editGlossaryTermPage,
    'sample_data.ecommerce_db.shopify.performance_test_table.test_col_2000',
    'test_col_2000',
    'data-row-key'
  );
});
