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

import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { performAdminLogin } from '../../utils/admin';
import {
  expectNoErrorToast,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { fillDeleteConfirmationIfPresent } from '../../utils/entity';
import {
  getFailedRowsData,
  verifyTestCaseLastRunBanner,
  visitDataQualityTab,
} from '../../utils/testCases';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

const createTestCaseWithSampleData = async (
  apiContext: Awaited<ReturnType<typeof getApiContext>>['apiContext'],
  table: TableClass
) => {
  const columnName = table.entity.columns[0].name;
  const tableFqn = table.entityResponseData?.fullyQualifiedName;

  // Create test case
  const testCase = await apiContext
    .post('/api/v1/dataQuality/testCases', {
      data: {
        name: `pw_column_value_max_to_be_between_${uuid()}`,
        entityLink: `<#E::table::${tableFqn}::columns::${columnName}>`,
        parameterValues: [
          { name: 'minValueForMaxInCol', value: 90001 },
          { name: 'maxValueForMaxInCol', value: 96162 },
        ],
        testDefinition: 'columnValueMaxToBeBetween',
      },
    })
    .then((res) => res.json());

  // Add failed result
  await apiContext.post(
    `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
      testCase.fullyQualifiedName
    )}`,
    {
      data: {
        result:
          'Found min=10001, max=27809 vs. the expected min=90001, max=96162.',
        testCaseStatus: 'Failed',
        testResultValue: [
          { name: 'minValueForMaxInCol', value: '10001' },
          { name: 'maxValueForMaxInCol', value: '27809' },
        ],
        timestamp: Date.now(),
      },
    }
  );

  // Add failed rows sample
  await apiContext.put(
    `/api/v1/dataQuality/testCases/${testCase.id}/failedRowsSample`,
    { data: getFailedRowsData(table) }
  );

  return testCase;
};

test(
  'FailedTestCaseSampleData',
  PLAYWRIGHT_INGESTION_TAG_OBJ,
  async ({ page }) => {
    const { apiContext } = await getApiContext(page);
    const table = new TableClass();
    await table.create(apiContext);

    const testCase = await createTestCaseWithSampleData(apiContext, table);
    const testCaseName = testCase.name;

    await test.step('Highlight the failed test case sample data', async () => {
      await visitDataQualityTab(page, table);

      await page.click(
        `[data-testid="${testCaseName}"] >> text=${testCaseName}`
      );

      await page
        .locator('[data-testid="test-case-result-tab-container"]')
        .waitFor({ state: 'visible' });

      await expect(
        page.locator('.failed-sample-data-column').first()
      ).toBeVisible();

      const sampleDataTable = page.getByTestId('sample-data-table').first();

      const failedColumns = sampleDataTable.locator(
        '.failed-sample-data-column'
      );

      await expect(failedColumns).toHaveCount(3);
    });

    await test.step('Delete sample data', async () => {
      await page.click('[data-testid="sample-data-manage-button"]');
      await page.click('[data-testid="delete-button"]');
      await page.getByTestId('delete-modal').waitFor({ state: 'visible' });
      const deleteSampleData = page.waitForResponse(
        '/api/v1/dataQuality/testCases/*/failedRowsSample'
      );
      await fillDeleteConfirmationIfPresent(page);
      await page.click('[data-testid="confirm-button"]');
      await deleteSampleData;
      await page.locator('[data-testid="sample-data-manage-button"]').waitFor({
        state: 'hidden',
      });
    });

    // Cleanup
    await table.delete(apiContext);
  }
);

test.describe('Failed rows sample fetch gating', () => {
  const table = new TableClass();
  let passingTestCaseFqn = '';
  let failedTestCaseFqn = '';

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await table.create(apiContext);

    // A passing test case — a failed-rows sample can never exist for it, so the
    // UI must not request one.
    const passingTestCase = await table.createTestCase(apiContext, {
      name: `pw_passing_row_count_${uuid()}`,
    });
    await table.addTestCaseResult(
      apiContext,
      passingTestCase.fullyQualifiedName,
      {
        result: 'Passing (fixture)',
        testCaseStatus: 'Success',
        testResultValue: [{ name: 'rowCount', value: '100' }],
        timestamp: Date.now(),
      }
    );
    passingTestCaseFqn = passingTestCase.fullyQualifiedName;

    // A failing test case with no computed failed-rows sample stored — the UI
    // still requests it (status is Failed) but the backend answers 404.
    const failedTestCase = await table.createTestCase(apiContext, {
      name: `pw_failing_no_sample_${uuid()}`,
    });
    await table.addTestCaseResult(
      apiContext,
      failedTestCase.fullyQualifiedName,
      {
        result: 'Failed (fixture)',
        testCaseStatus: 'Failed',
        testResultValue: [{ name: 'rowCount', value: '0' }],
        timestamp: Date.now(),
      }
    );
    failedTestCaseFqn = failedTestCase.fullyQualifiedName;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test(
    'gates the sample fetch on failed status',
    PLAYWRIGHT_INGESTION_TAG_OBJ,
    async ({ page }) => {
      await test.step('passing test case does not request the failed-rows sample', async () => {
        // Intercept so any failed-rows request is caught the moment it starts,
        // independent of response timing.
        let sampleRequested = false;
        await page.route('**/failedRowsSample', async (route) => {
          sampleRequested = true;
          await route.continue();
        });

        const testCaseDetails = page.waitForResponse(
          (res) =>
            res.url().includes('/api/v1/dataQuality/testCases/name/') &&
            res.status() === 200
        );
        // The results tab loads its own testCaseResults on the same mount that
        // would have fired the sample fetch — awaiting it is a deterministic
        // "the tab has mounted and settled" signal.
        const testCaseResults = page.waitForResponse(
          (res) =>
            res.url().includes('/dataQuality/testCases/testCaseResults/') &&
            res.request().method() === 'GET'
        );
        await page.goto(
          `test-case/${encodeURIComponent(
            passingTestCaseFqn
          )}/test-case-results`
        );
        await testCaseDetails;
        await testCaseResults;
        await page
          .locator('[data-testid="test-case-result-tab-container"]')
          .waitFor({ state: 'visible' });
        await verifyTestCaseLastRunBanner(page, 'success');

        await page.unroute('**/failedRowsSample');
        expect(sampleRequested).toBe(false);
      });

      await test.step('failed test case without a sample gets a 404 and shows no error toast', async () => {
        const failedRowsSample = page.waitForResponse((res) =>
          res.url().includes('/failedRowsSample')
        );
        await page.goto(
          `test-case/${encodeURIComponent(failedTestCaseFqn)}/test-case-results`
        );
        const response = await failedRowsSample;
        expect(response.status()).toBe(404);

        await page
          .locator('[data-testid="test-case-result-tab-container"]')
          .waitFor({ state: 'visible' });
        await verifyTestCaseLastRunBanner(page, 'failed');

        // The 404 is the expected "no sample stored" empty state — it must not
        // surface as an error toast.
        await expectNoErrorToast(page);
      });
    }
  );
});
