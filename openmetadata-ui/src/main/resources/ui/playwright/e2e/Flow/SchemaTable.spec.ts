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
import { Page } from '@playwright/test';
import { test } from '../fixtures/pages';

import { redirectToHomePage } from '../../utils/common';
import { updateDisplayNameForEntityChildren } from '../../utils/entity';

test.beforeEach(
  async ({ editDescriptionPage, editTagsPage, editGlossaryTermPage }) => {
    await redirectToHomePage(editDescriptionPage);
    await redirectToHomePage(editTagsPage);
    await redirectToHomePage(editGlossaryTermPage);
  }
);

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
