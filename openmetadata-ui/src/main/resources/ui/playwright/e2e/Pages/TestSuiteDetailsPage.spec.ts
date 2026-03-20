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
import { expect } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import {
  ADD_TEST_CASE_SELECTION_CARD,
  addTestCaseListFilterByFirstColumnInAddTestCasesDialog,
  addTestCaseListFilterByStatusInAddTestCasesDialog,
  addTestCaseListFilterByTableInAddTestCasesDialog,
  addTestCaseListFilterByTestTypeInAddTestCasesDialog,
  addTestCaseListResetFiltersInAddTestCasesDialog,
  addTestCaseListToggleSelectAllInAddTestCasesDialog,
} from '../../utils/addTestCaseList';
import {
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

const table = new TableClass();

const ADD_TEST_CASES_DIALOG = { name: 'Add Test Cases' };

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.create(apiContext);
  await table.createTestCase(apiContext);
  await table.createTestCase(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test(
  'Add test case modal on Test Suite details page - filters and select',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    test.slow();

    const NEW_TEST_SUITE = {
      name: `mysql_matrix_details_${uuid()}`,
      description: 'mysql critical matrix for details page e2e',
    };
    const testCaseName1 = table.testCasesResponseData?.[0]?.['name'];

    await test.step('Create logical test suite', async () => {
      const initialListResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list*`
      );
      await page.goto('/data-quality/test-suites/bundle-suites');
      await page.click('[data-testid="add-test-suite-btn"]');
      await initialListResponse;
      await page.fill('[data-testid="test-suite-name"]', NEW_TEST_SUITE.name);
      await page.locator(descriptionBox).fill(NEW_TEST_SUITE.description);
      await page.waitForSelector(
        "[data-testid='test-case-selection-card'] [data-testid='loader']",
        { state: 'detached' }
      );

      const getTestCase = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*`
      );
      await page
        .locator(ADD_TEST_CASE_SELECTION_CARD)
        .getByTestId('searchbar')
        .fill(testCaseName1 ?? '');
      await getTestCase;
      await page.click(
        `[data-testid="test-case-selection-card"] [data-testid="${testCaseName1}"]`
      );
      const createTestSuiteResponse = page.waitForResponse(
        '/api/v1/dataQuality/testSuites'
      );
      await page.click('[data-testid="submit-button"]');
      await createTestSuiteResponse;
      await toastNotification(page, 'Test Suite created successfully.');
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Open Add test case modal on details page', async () => {
      const testCaseListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.goto(
        `/test-suites/${encodeURIComponent(NEW_TEST_SUITE.name)}`
      );
      await testCaseListResponse;
      await waitForAllLoadersToDisappear(page);

      const modalListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.getByTestId('add-test-case-btn').click();
      await modalListResponse;
      await page
        .getByRole('dialog', ADD_TEST_CASES_DIALOG)
        .locator(
          "[data-testid='test-case-selection-card'] [data-testid='loader']"
        )
        .waitFor({ state: 'detached' });
    });

    await test.step('Verify add test case modal filter dropdowns are visible', async () => {
      await expect(page.getByTestId('search-dropdown-Status')).toBeVisible();
      await expect(page.getByTestId('search-dropdown-Test Type')).toBeVisible();
      await expect(page.getByTestId('search-dropdown-Table')).toBeVisible();
      await expect(page.getByTestId('search-dropdown-Column')).toBeVisible();
    });

    await test.step('Filter by Test Type Table and wait for API', async () => {
      await addTestCaseListFilterByTestTypeInAddTestCasesDialog(page, 'Table');
    });

    await test.step('Filter by Status Success and wait for API', async () => {
      await addTestCaseListFilterByStatusInAddTestCasesDialog(page, 'Success');
    });

    await test.step('Filter by Table and wait for API', async () => {
      await addTestCaseListFilterByTableInAddTestCasesDialog(
        page,
        table.entity?.name ?? '',
        table.entityResponseData?.fullyQualifiedName ?? ''
      );
    });

    await test.step('Filter by Column and wait for API', async () => {
      await addTestCaseListFilterByFirstColumnInAddTestCasesDialog(page);
    });

    await test.step('Reset Test Type to All and clear filters, wait for API', async () => {
      await addTestCaseListResetFiltersInAddTestCasesDialog(
        page,
        table.entityResponseData?.fullyQualifiedName ?? ''
      );
    });

    await test.step('Select all then unselect all test cases in modal', async () => {
      await addTestCaseListToggleSelectAllInAddTestCasesDialog(page);
    });

    await test.step('Select test case in modal then cancel', async () => {
      const getTestCase = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*`
      );
      await page.getByTestId('searchbar').fill(testCaseName1 ?? '');
      await getTestCase;

      await page
        .getByRole('dialog', ADD_TEST_CASES_DIALOG)
        .getByTestId(testCaseName1 ?? '')
        .click();
      await page.getByRole('dialog').getByTestId('cancel').click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  }
);
