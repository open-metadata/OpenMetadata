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
import { BundleTestSuiteClass } from '../../support/entity/BundleTestSuiteClass';
import { TableClass } from '../../support/entity/TableClass';
import {
  addTestCaseListFilterByColumnInAddTestCasesDialog,
  addTestCaseListFilterByStatusInAddTestCasesDialog,
  addTestCaseListFilterByTableInAddTestCasesDialog,
  addTestCaseListFilterByTestTypeInAddTestCasesDialog,
  addTestCaseListResetFiltersInAddTestCasesDialog,
  ADD_TEST_CASE_SELECTION_CARD,
} from '../../utils/addTestCaseList';
import { performAdminLogin } from '../../utils/admin';
import {
  fillDescriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { verifyBundleSuitePageLoaded } from '../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';
import { enableAiAppMode } from '../Utils/appMode';

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
      await page.goto('/data-quality/test-suites/bundle-suites', {
        waitUntil: 'domcontentloaded',
      });
      await page.click('[data-testid="add-test-suite-btn"]');
      await initialListResponse;
      await page
        .locator('[data-testid="test-suite-name"] input')
        .fill(NEW_TEST_SUITE.name);
      await fillDescriptionBox(page, NEW_TEST_SUITE.description);
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

    await test.step('Find and open the test suite from the bundle suite list', async () => {
      await page.goto('/data-quality/test-suites/bundle-suites', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const testSuiteSearchResponse = page.waitForResponse(
        '/api/v1/dataQuality/testSuites/search/list*'
      );
      await page
        .getByPlaceholder('Search Bundle Suites')
        .fill(NEW_TEST_SUITE.name);
      await testSuiteSearchResponse;

      const testSuiteDetailsPage = page.waitForURL(
        (url) => url.pathname === `/test-suites/${NEW_TEST_SUITE.name}`,
        { waitUntil: 'domcontentloaded' }
      );
      await page
        .getByRole('link', { exact: true, name: NEW_TEST_SUITE.name })
        .click();
      await testSuiteDetailsPage;
      await verifyBundleSuitePageLoaded(page, NEW_TEST_SUITE.name, 1);
    });

    await test.step('Search test cases on the details page', async () => {
      const searchInput = page.getByTestId('test-suite-test-case-search');

      const testCaseSearchResponse = page.waitForResponse((response) => {
        const responseUrl = new URL(response.url());

        return (
          responseUrl.pathname.includes(
            '/api/v1/dataQuality/testCases/search/list'
          ) && responseUrl.searchParams.get('q') === testCaseName1
        );
      });
      await searchInput.fill(testCaseName1 ?? '');
      await testCaseSearchResponse;

      await expect(page.getByTestId(testCaseName1 ?? '')).toBeVisible();
    });

    await test.step('Open Add test case modal on details page', async () => {
      const modalListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.getByTestId('add-test-case-btn').click();
      await modalListResponse;
      const submit = page
        .getByRole('dialog', ADD_TEST_CASES_DIALOG)
        .getByTestId('submit');
      await expect(submit).toBeInViewport();
      const cancel = page
        .getByRole('dialog', ADD_TEST_CASES_DIALOG)
        .getByTestId('cancel');
      await expect
        .poll(async () => {
          const cancelBounds = await cancel.boundingBox();
          const submitBounds = await submit.boundingBox();

          return cancelBounds && submitBounds
            ? Math.abs(
                cancelBounds.y +
                  cancelBounds.height / 2 -
                  (submitBounds.y + submitBounds.height / 2)
              )
            : Number.POSITIVE_INFINITY;
        })
        .toBeLessThan(1);
      expect(
        await submit.evaluate((button) => {
          for (
            let parent = button.parentElement;
            parent;
            parent = parent.parentElement
          ) {
            if (
              /auto|scroll/.test(getComputedStyle(parent).overflowY) &&
              parent.scrollHeight > parent.clientHeight
            ) {
              return true;
            }
          }

          return false;
        })
      ).toBe(false);
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
      await addTestCaseListFilterByColumnInAddTestCasesDialog(
        page,
        table.columnsName[0]
      );
    });

    await test.step('Reset Test Type to All and clear filters, wait for API', async () => {
      await addTestCaseListResetFiltersInAddTestCasesDialog(
        page,
        table.entityResponseData?.fullyQualifiedName ?? '',
        table.columnsName[0]
      );
    });

    await test.step('Select all then unselect all test cases in modal', async () => {
      const dialog = page.getByRole('dialog', ADD_TEST_CASES_DIALOG);
      const selectAllCheckbox = dialog.getByTestId('select-all-test-cases');
      const firstTestCaseCheckbox = dialog
        .locator('[data-testid^="checkbox-"]')
        .first();

      await expect(
        dialog.getByTestId('select-all-total-test-cases')
      ).not.toBeVisible();

      await selectAllCheckbox.click();
      await expect(firstTestCaseCheckbox).toBeChecked();

      await selectAllCheckbox.click();
      await expect(firstTestCaseCheckbox).not.toBeChecked();
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

const SUITE_APP_MODES = [
  {
    label: 'Classic',
    suitePathPrefix: '/test-suites',
    openApp: redirectToHomePage,
  },
  {
    label: 'AI',
    suitePathPrefix: '/observability/test-suites',
    openApp: enableAiAppMode,
  },
];

for (const { label, suitePathPrefix, openApp } of SUITE_APP_MODES) {
  test.describe(`Search test cases inside a bundle suite (${label} mode)`, () => {
    let searchTable: TableClass;
    let searchSuite: BundleTestSuiteClass;
    let testCaseNames: string[];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      searchTable = new TableClass();
      searchSuite = new BundleTestSuiteClass();
      await searchTable.create(apiContext);
      const testCases = [
        await searchTable.createTestCase(apiContext),
        await searchTable.createTestCase(apiContext),
      ];
      testCaseNames = testCases.map((testCase) => testCase.name as string);
      await searchSuite.createBundleTestSuite(apiContext);
      const addResponse = await searchSuite.addTestCases(
        apiContext,
        testCases.map((testCase) => testCase.id as string)
      );
      expect(addResponse.status()).toBe(200);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await searchSuite.delete(apiContext);
      await searchTable.delete(apiContext);
      await afterAction();
    });

    test('finds a test case by an upper-cased part of its name', async ({
      page,
    }) => {
      const suiteFqn =
        searchSuite.bundleTestSuiteResponseData.fullyQualifiedName ?? '';
      const [matchName, otherName] = testCaseNames;
      // `case_<uuid>`: the uuid makes it unique to this test case, and the
      // `case` prefix guarantees letters, so upper-casing it always proves
      // the search is case-insensitive (a uuid alone can be all digits).
      const upperCaseQuery = matchName.slice(-13).toUpperCase();

      await test.step('Open the bundle suite', async () => {
        await openApp(page);
        const listResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list*'
        );
        await page.goto(`${suitePathPrefix}/${encodeURIComponent(suiteFqn)}`, {
          waitUntil: 'domcontentloaded',
        });
        await listResponse;
        await expect(page.getByTestId(matchName)).toBeVisible();
        await expect(page.getByTestId(otherName)).toBeVisible();
      });

      await test.step('Search shows only the matching test case', async () => {
        const searchResponse = page.waitForResponse((response) => {
          const responseUrl = new URL(response.url());

          return (
            responseUrl.pathname.includes(
              '/api/v1/dataQuality/testCases/search/list'
            ) && responseUrl.searchParams.get('q') === upperCaseQuery
          );
        });
        await page
          .getByTestId('test-suite-test-case-search')
          .fill(upperCaseQuery);
        await searchResponse;

        await expect(page.getByTestId(matchName)).toBeVisible();
        await expect(page.getByTestId(otherName)).toHaveCount(0);
      });
    });
  });
}

for (const { label, suitePathPrefix, openApp } of SUITE_APP_MODES) {
  test.describe(`Bulk remove test cases from a bundle suite (${label} mode)`, () => {
    let bulkRemoveTable: TableClass;
    let bulkRemoveSuite: BundleTestSuiteClass;
    let testCaseNames: string[];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      bulkRemoveTable = new TableClass();
      bulkRemoveSuite = new BundleTestSuiteClass();
      await bulkRemoveTable.create(apiContext);
      const testCases = [
        await bulkRemoveTable.createTestCase(apiContext),
        await bulkRemoveTable.createTestCase(apiContext),
        await bulkRemoveTable.createTestCase(apiContext),
      ];
      testCaseNames = testCases.map((testCase) => testCase.name as string);
      await bulkRemoveSuite.createBundleTestSuite(apiContext);
      const addResponse = await bulkRemoveSuite.addTestCases(
        apiContext,
        testCases.map((testCase) => testCase.id as string)
      );
      expect(addResponse.status()).toBe(200);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await bulkRemoveSuite.delete(apiContext);
      await bulkRemoveTable.delete(apiContext);
      await afterAction();
    });

    test('removes the selected test cases and keeps the rest', async ({
      page,
    }) => {
      const suiteFqn =
        bulkRemoveSuite.bundleTestSuiteResponseData.fullyQualifiedName ?? '';
      const [keptName, ...removedNames] = testCaseNames;
      const testCaseTable = page.getByTestId('test-case-table');
      const testCaseRow = (name: string) =>
        testCaseTable.locator('tbody tr[data-key]').filter({ hasText: name });

      await test.step('Open the bundle suite', async () => {
        await openApp(page);
        const listResponse = page.waitForResponse(
          '/api/v1/dataQuality/testCases/search/list*'
        );
        await page.goto(`${suitePathPrefix}/${encodeURIComponent(suiteFqn)}`, {
          waitUntil: 'domcontentloaded',
        });
        await listResponse;
        await verifyBundleSuitePageLoaded(page, suiteFqn, 3);
      });

      await test.step('Select two test cases', async () => {
        // Measured against the search box, which sits in the same header row as
        // the selection bar, so page scrolling does not affect the offset.
        const searchBox = page.getByTestId('test-suite-test-case-search');
        const rowOffsetFromSearch = async () => {
          const [row, search] = await Promise.all([
            testCaseRow(keptName).boundingBox(),
            searchBox.boundingBox(),
          ]);

          if (!row || !search) {
            throw new Error('The row or the search box has no bounding box');
          }

          return row.y - search.y;
        };
        const offsetBeforeSelection = await rowOffsetFromSearch();

        for (const name of removedNames) {
          await testCaseRow(name).locator('label[slot="selection"]').click();
        }

        await expect(page.getByText('2 test case(s) selected')).toBeVisible();
        await expect(
          page.getByTestId('add-selected-to-bundle-suite')
        ).not.toBeVisible();
        // The bar joins the header row instead of inserting a row above the
        // table, so selecting must not push the rows down.
        expect(await rowOffsetFromSearch()).toBe(offsetBeforeSelection);
      });

      await test.step('Remove them from the suite', async () => {
        await page.getByTestId('bulk-remove-test-cases').click();

        const confirmButton = page
          .getByRole('dialog')
          .getByTestId('save-button');

        await expect(confirmButton).toHaveClass(/tw:bg-error-solid/);

        const removeResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/logicalTestCases/bulk/remove') &&
            response.request().method() === 'POST'
        );
        await confirmButton.click();

        expect((await removeResponse).status()).toBe(200);
        await toastNotification(
          page,
          'Test cases were removed from the test suite successfully.'
        );
      });

      await test.step('Only the unselected test case remains', async () => {
        for (const name of removedNames) {
          await expect(testCaseRow(name)).toHaveCount(0);
        }
        await expect(testCaseRow(keptName)).toHaveCount(1);
        // The badge renders differently per mode; anchor on the trailing count.
        await expect(page.getByTestId('test-cases')).toHaveText(/(^|\D)1$/);
        await expect(
          page.getByTestId('bulk-remove-test-cases')
        ).not.toBeVisible();
      });
    });
  });
}
