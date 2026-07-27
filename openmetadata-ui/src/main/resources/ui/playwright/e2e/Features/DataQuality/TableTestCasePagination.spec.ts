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
import { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { visitDataQualityTab } from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

// The table Data Quality tab paginates at PAGE_SIZE_BASE (15). Creating 16 test
// cases forces a second page, so the pagination control must render. This guards
// the regression where QualityTab stopped forwarding `showPagination` to
// DataQualityTab and the control silently disappeared.
const TEST_CASE_COUNT = 16;
const table = new TableClass();

test.describe(
  'Table Data Quality tab pagination',
  { tag: ['@Features', '@Observability', PLAYWRIGHT_BASIC_TEST_TAG_OBJ.tag] },
  () => {
    test.beforeAll(
      'Create a table with test cases beyond the page size',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await table.create(apiContext);
        for (let i = 0; i < TEST_CASE_COUNT; i++) {
          await table.createTestCase(apiContext);
        }
        await afterAction();
      }
    );

    test.afterAll('Cleanup created entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('renders pagination and navigates when test cases exceed the page size', async ({
      page,
    }) => {
      await test.step('Pagination control is visible on the Data Quality tab', async () => {
        await visitDataQualityTab(page, table);
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('pagination')).toBeVisible();
        await expect(page.getByTestId('previous')).toBeDisabled();
        await expect(page.getByTestId('next')).toBeEnabled();
      });

      await test.step('Next page fetches data and updates the page indicator', async () => {
        const [page2Response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response
                .url()
                .includes('/api/v1/dataQuality/testCases/search/list') &&
              response.request().method() === 'GET' &&
              response.status() === 200
          ),
          page.getByTestId('next').click(),
        ]);

        expect(page2Response.status()).toBe(200);
        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('previous')).toBeEnabled();
        await expect(page.getByTestId('page-indicator')).toContainText(
          /2\s*of\s*\d+/
        );
      });
    });
  }
);
