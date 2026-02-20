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
import { expect, Page } from '@playwright/test';
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_INGESTION_TAG_OBJ,
} from '../../../constant/config';
import { ResponseDataType } from '../../../support/entity/Entity.interface';
import { TableClass } from '../../../support/entity/TableClass';
import { ClassificationClass } from '../../../support/tag/ClassificationClass';
import { TagClass } from '../../../support/tag/TagClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { getCurrentMillis } from '../../../utils/dateTime';
import { test } from '../../fixtures/pages';

const table = new TableClass();
const testClassification = new ClassificationClass();
const testTag1 = new TagClass({
  classification: testClassification.data.name,
});

const testCaseResult = {
  result: 'Found min=10001, max=27809 vs. the expected min=90001, max=96162.',
  testCaseStatus: 'Failed',
  testResultValue: [
    {
      name: 'minValueForMaxInCol',
      value: '10001',
    },
    {
      name: 'maxValueForMaxInCol',
      value: '27809',
    },
  ],
  timestamp: getCurrentMillis(),
};

/**
 * Profiler Role Access Tests
 * @description Validates profiler matrix and test case graph visibility for different user roles.
 * Tests are run sequentially (not in parallel) to avoid flakiness.
 */

const validateProfilerAccessForRole = async (
  page: Page,
  tableInstance: TableClass,
  testCase: ResponseDataType
) => {
  await redirectToHomePage(page);
  await tableInstance.visitEntityPage(page);

  await page.waitForSelector(`[data-testid="entity-header-name"]`);

  await expect(
    page.locator(`[data-testid="entity-header-name"]`)
  ).toContainText(tableInstance.entity.name);

  const profilerApiCall = page.waitForResponse(
    `/api/v1/tables/*/tableProfile/latest?includeColumnProfile=false`
  );
  await page.click('[data-testid="profiler"]');
  const profilerResponse = await profilerApiCall;

  expect(profilerResponse.status()).toBe(200);

  const listColumnApiCall = page.waitForResponse(
    '/api/v1/tables/name/*/columns?*'
  );
  await page
    .getByRole('tab', {
      name: 'Column Profile',
    })
    .click();
  await listColumnApiCall;
  const listColumnResponse = await listColumnApiCall;

  expect(listColumnResponse.status()).toBe(200);

  const getProfilerInfo = page.waitForResponse(
    '/api/v1/tables/*/columnProfile?*'
  );
  await page
    .locator(
      `[data-row-key="${tableInstance.entityResponseData.columns[1].fullyQualifiedName}"]`
    )
    .getByText(tableInstance.entity.columns[1].name)
    .click();
  await getProfilerInfo;
  const getProfilerInfoResponse = await getProfilerInfo;

  expect(getProfilerInfoResponse.status()).toBe(200);

  await expect(page.locator('#count_graph')).toBeVisible();
  await expect(page.locator('#proportion_graph')).toBeVisible();
  await expect(page.locator('#math_graph')).toBeVisible();
  await expect(page.locator('#sum_graph')).toBeVisible();

  const getTestCaseDetails = page.waitForResponse(
    '/api/v1/dataQuality/testCases/name/*?fields=*'
  );
  const getTestResult = page.waitForResponse(
    '/api/v1/dataQuality/testCases/testCaseResults/*?*'
  );

  await page.goto(`test-case/${testCase.fullyQualifiedName}/test-case-results`);

  const getTestCaseDetailsResponse = await getTestCaseDetails;
  const getTestResultResponse = await getTestResult;

  expect(getTestCaseDetailsResponse.status()).toBe(200);
  expect(getTestResultResponse.status()).toBe(200);

  await expect(page.locator(`#${testCase.name}_graph`)).toBeVisible();
};

test.describe(
  'Profiler Role Access Tests',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Profiler` },
  () => {
    // Store the created test case to avoid stale data from array
    let createdTestCase: ResponseDataType;

    test.beforeAll(async ({ browser }) => {
      // Clear any stale test cases from previous runs
      table.testCasesResponseData = [];

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      const testCase = await table.createTestCase(apiContext, {
        name: `email_column_values_to_be_in_set_${uuid()}`,
        entityLink: `<#E::table::${table.entityResponseData?.['fullyQualifiedName']}::columns::${table.entity?.columns[3].name}>`,
        parameterValues: [
          { name: 'allowedValues', value: '["gmail","yahoo","collate"]' },
        ],
        testDefinition: 'columnValuesToBeInSet',
      });

      // Store the test case for use in tests
      createdTestCase = testCase;

      // Create test case result
      await table.addTestCaseResult(
        apiContext,
        testCase['fullyQualifiedName'],
        testCaseResult
      );

      // Add profiler data for table to support profiler testing
      await apiContext.put(
        `/api/v1/tables/${table.entityResponseData.id}/tableProfile`,
        {
          data: {
            tableProfile: {
              timestamp: getCurrentMillis(),
              columnCount: table.entity.columns.length,
              rowCount: 100,
            },
            columnProfile: table.entity.columns.map((col) => ({
              name: col.name,
              uniqueCount: 50,
              uniqueProportion: 0.5,
              min: 1,
              max: 100,
              mean: 50,
              sum: 5000,
              timestamp: getCurrentMillis(),
            })),
          },
        }
      );

      // Create test tags
      await testClassification.create(apiContext);
      await testTag1.create(apiContext);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);

      // Clean up test tags
      await testTag1.delete(apiContext);
      await testClassification.delete(apiContext);

      await afterAction();
    });

    /**
     * Admin role profiler access
     * @description Verifies that admin users can access profiler data, view table/column profiles, and see test case graphs.
     */
    test(
      'Admin role can access profiler and view test case graphs',
      PLAYWRIGHT_INGESTION_TAG_OBJ,
      async ({ page }) => {
        await validateProfilerAccessForRole(page, table, createdTestCase);
      }
    );

    /**
     * Data consumer role profiler access
     * @description Verifies that data consumer users can access profiler data, view table/column profiles, and see test case graphs.
     */
    test(
      'Data consumer role can access profiler and view test case graphs',
      PLAYWRIGHT_INGESTION_TAG_OBJ,
      async ({ dataConsumerPage }) => {
        await validateProfilerAccessForRole(
          dataConsumerPage,
          table,
          createdTestCase
        );
      }
    );

    /**
     * Data steward role profiler access
     * @description Verifies that data steward users can access profiler data, view table/column profiles, and see test case graphs.
     */
    test(
      'Data steward role can access profiler and view test case graphs',
      PLAYWRIGHT_INGESTION_TAG_OBJ,
      async ({ dataStewardPage }) => {
        await validateProfilerAccessForRole(
          dataStewardPage,
          table,
          createdTestCase
        );
      }
    );

    /**
     * Update profiler setting modal
     * @description Tests profiler configuration updates including profile sample, exclude/include columns,
     * partition settings, and validates settings persistence and reset functionality.
     */
    test('Update profiler setting modal', async ({ page }) => {
      const profilerSetting = {
        profileSample: '60',
        sampleDataCount: '100',
        profileQuery: 'select * from table',
        excludeColumns: table.entity?.columns[0].name,
        includeColumns: table.entity?.columns[1].name,
        partitionColumnName: table.entity?.columns[2].name,
        partitionIntervalType: 'COLUMN-VALUE',
        partitionValues: 'test',
      };

      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await page.getByTestId('profiler').click();
      await page.getByRole('tab', { name: 'Data Quality' }).click();

      await page.reload();
      await page.waitForLoadState('networkidle');

      await test.step('Update profiler setting', async () => {
        await page.click('[data-testid="profiler-setting-btn"]');
        await page.waitForSelector('[data-testid="profiler-settings-modal"]');

        await page.locator('[data-testid="slider-input"]').clear();
        await page
          .locator('[data-testid="slider-input"]')
          .fill(profilerSetting.profileSample);

        await page.locator('[data-testid="sample-data-count-input"]').clear();
        await page
          .locator('[data-testid="sample-data-count-input"]')
          .fill(profilerSetting.sampleDataCount);
        await page.locator('[data-testid="exclude-column-select"]').click();
        await page.keyboard.type(`${profilerSetting.excludeColumns}`);
        await page.keyboard.press('Enter');
        await page.locator('.CodeMirror-scroll').click();
        await page.keyboard.type(profilerSetting.profileQuery);

        await page.locator('[data-testid="include-column-select"]').click();
        await page
          .locator('.ant-select-dropdown')
          .locator(
            `[title="${profilerSetting.includeColumns}"]:not(.ant-select-dropdown-hidden)`
          )
          .last()
          .click();
        await page.locator('[data-testid="enable-partition-switch"]').click();
        await page.locator('[data-testid="interval-type"]').click();
        await page
          .locator('.ant-select-dropdown')
          .locator(
            `[title="${profilerSetting.partitionIntervalType}"]:not(.ant-select-dropdown-hidden)`
          )
          .click();

        await page
          .locator('#includeColumnsProfiler_partitionColumnName')
          .click();
        await page
          .locator('.ant-select-dropdown')
          .locator(
            `[title="${profilerSetting.partitionColumnName}"]:not(.ant-select-dropdown-hidden)`
          )
          .last()
          .click();
        await page
          .locator('[data-testid="partition-value"]')
          .fill(profilerSetting.partitionValues);

        const updateTableProfilerConfigResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tables/') &&
            response.url().includes('/tableProfilerConfig') &&
            response.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: 'Save' }).click();
        const updateResponse = await updateTableProfilerConfigResponse;
        const requestBody = await updateResponse.request().postData();

        expect(requestBody).toEqual(
          JSON.stringify({
            excludeColumns: [table.entity?.columns[0].name],
            profileQuery: 'select * from table',
            profileSample: 60,
            profileSampleType: 'PERCENTAGE',
            includeColumns: [{ columnName: table.entity?.columns[1].name }],
            partitioning: {
              partitionColumnName: table.entity?.columns[2].name,
              partitionIntervalType: 'COLUMN-VALUE',
              partitionValues: ['test'],
              enablePartitioning: true,
            },
            sampleDataCount: 100,
          })
        );
      });

      await test.step('Reset profile sample type', async () => {
        await page.click('[data-testid="profiler-setting-btn"]');
        await page.waitForSelector('[data-testid="profiler-settings-modal"]');

        await expect(
          page.locator('[data-testid="profile-sample"]')
        ).toBeVisible();

        await page.getByTestId('clear-slider-input').click();

        await expect(page.locator('[data-testid="slider-input"]')).toBeEmpty();

        const updateTableProfilerConfigResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/tables/') &&
            response.url().includes('/tableProfilerConfig') &&
            response.request().method() === 'PUT'
        );
        await page.getByRole('button', { name: 'Save' }).click();
        const updateResponse = await updateTableProfilerConfigResponse;
        const requestBody = await updateResponse.request().postData();

        expect(requestBody).toEqual(
          JSON.stringify({
            excludeColumns: [table.entity?.columns[0].name],
            profileQuery: 'select * from table',
            profileSample: null,
            profileSampleType: 'PERCENTAGE',
            includeColumns: [{ columnName: table.entity?.columns[1].name }],
            partitioning: {
              partitionColumnName: table.entity?.columns[2].name,
              partitionIntervalType: 'COLUMN-VALUE',
              partitionValues: ['test'],
              enablePartitioning: true,
            },
            sampleDataCount: 100,
          })
        );

        await page.waitForSelector('[data-testid="profiler-settings-modal"]', {
          state: 'detached',
        });

        // Validate the profiler setting is updated
        await page.click('[data-testid="profiler-setting-btn"]');
        await page.waitForSelector('[data-testid="profiler-settings-modal"]');

        await expect(
          page.locator('[data-testid="profile-sample"]')
        ).toBeVisible();
        await expect(page.locator('[data-testid="slider-input"]')).toBeEmpty();
        await expect(
          page.getByTestId('profile-sample').locator('div')
        ).toBeVisible();
      });
    });
  }
);
