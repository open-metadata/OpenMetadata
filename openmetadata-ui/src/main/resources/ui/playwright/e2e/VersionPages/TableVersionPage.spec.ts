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
import { redirectToHomePage } from '../../utils/common';
import { columnPaginationTable } from '../../utils/table';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Table Version Page', () => {
  test('Pagination and Search should works for columns', async ({ page }) => {
    await redirectToHomePage(page);
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table/versions/0.1'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await test.step('Pagination Should Work', async () => {
      await columnPaginationTable(page);
    });

    await test.step('Search Should Work', async () => {
      const searchResponse = page.waitForResponse(
        '/api/v1/tables/name/sample_data.ecommerce_db.shopify.performance_test_table/columns/search?q=test_col_0250*'
      );
      await page.getByTestId('searchbar').fill('test_col_0250');
      await searchResponse;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      expect(page.getByTestId('entity-table').getByRole('row')).toHaveCount(2);

      expect(
        page.getByTestId('entity-table').getByText('test_col_0250')
      ).toBeVisible();
    });
  });
});
