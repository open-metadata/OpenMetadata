/*
 *  Copyright 2024 Collate.
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
import { parseCSV } from '../../../src/utils/EntityImport/EntityImportUtils';
import { EXPECTED_HEADERS } from '../../constant/lineage.interface';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { addPipelineBetweenNodes } from '../../utils/lineage';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test('should download a CSV file on button click', async ({ browser }) => {
  const { page } = await createNewPage(browser);
  await redirectToHomePage(page);
  const { apiContext, afterAction } = await getApiContext(page);
  const table = new TableClass();
  const apiEndpoint = new ApiEndpointClass();
  await table.create(apiContext);
  await apiEndpoint.create(apiContext);

  await addPipelineBetweenNodes(page, table, apiEndpoint);

  await page.click('[data-testid="edit-lineage"]');

  await page.getByTestId('lineage-export').click();

  await expect(page.getByRole('dialog', { name: 'Export' })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button#submit-button'),
  ]);

  const filePath = await download.path();

  expect(filePath).not.toBeNull();

  const fileContent = await download.createReadStream();
  let fileData = '';
  for await (const item of fileContent) {
    fileData += item.toString();
  }

  const csvRows = fileData.split('\n').map((row) => row.split(','));
  const parsedData = parseCSV(csvRows);

  const headers = csvRows[0].map((header) => header.replace(/"/g, ''));
  EXPECTED_HEADERS.forEach((expectedHeader) => {
    expect(headers).toContain(expectedHeader);
  });

  expect(parsedData.length).toBeGreaterThan(0);

  await table.delete(apiContext);
  await apiEndpoint.delete(apiContext);

  await afterAction();
});
