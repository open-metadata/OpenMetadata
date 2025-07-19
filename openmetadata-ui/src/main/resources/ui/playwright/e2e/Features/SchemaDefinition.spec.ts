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
import test, { expect } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { visitEntityPageWithCustomSearchBox } from '../../utils/entity';

const table = {
  term: 'dim___reserved__colon____reserved__arrow__address',
  serviceName: 'sample_data',
};
const query =
  'CREATE TABLE dim_address(address_id NUMERIC PRIMARY KEY, shop_id NUMERIC)';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Schema definition (views)', () => {
  test.beforeEach('pre-requisite', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify schema definition (views) of table entity', async ({ page }) => {
    await visitEntityPageWithCustomSearchBox({
      page,
      searchTerm: table.term,
      dataTestId: `${table.serviceName}-${table.term}`,
    });

    await page.click('[data-testid="schema_definition"]');
    await page.waitForSelector('.CodeMirror-line > [role="presentation"]');

    await expect(
      page.locator('.CodeMirror-line > [role="presentation"]')
    ).toContainText(query);
  });
});
