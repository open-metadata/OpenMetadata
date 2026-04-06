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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { getFailedRowsData, visitDataQualityTab } from '../../utils/testCases';

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
      await page.locator('.ant-modal-body').waitFor({ state: 'visible' });
      await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
      const deleteSampleData = page.waitForResponse(
        '/api/v1/dataQuality/testCases/*/failedRowsSample'
      );
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
