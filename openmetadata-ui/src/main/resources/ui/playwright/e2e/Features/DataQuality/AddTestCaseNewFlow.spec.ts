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
import { expect, Page, Response } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { toastNotification } from '../../../utils/common';
import { visitDataQualityTab } from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

test.describe('Add TestCase New Flow', () => {
  const table1 = new TableClass();

  // Helper function to select table
  const selectTable = async (page: Page, tableName: string) => {
    await page.click('#testCaseFormV1_selectedTable');
    const tableResponse = page.waitForResponse(
      '/api/v1/search/query?*index=table_search_index*'
    );
    await page.fill('#testCaseFormV1_selectedTable', tableName);
    await tableResponse;
    await page
      .locator(
        `.ant-select-dropdown [title="${table1.entityResponseData.fullyQualifiedName}"]`
      )
      .click();
  };

  // Helper function to create test case
  const createTestCase = async (data: {
    page: Page;
    testType: string;
    testTypeId: string;
    paramsValue?: string;
    expectSchedulerCard?: boolean;
  }) => {
    const {
      page,
      testType,
      testTypeId,
      paramsValue,
      expectSchedulerCard = true,
    } = data;
    await page.getByTestId('test-case-name').fill(`${testTypeId}_test_case`);
    await page.click('#testCaseFormV1_testTypeId');
    await page.fill('#testCaseFormV1_testTypeId', testType);
    await page.getByTestId(testTypeId).click();

    if (paramsValue) {
      await page.fill('#testCaseFormV1_params_value', paramsValue);
    }

    if (expectSchedulerCard) {
      await expect(page.getByTestId('scheduler-card')).toBeVisible();
    } else {
      await expect(page.getByTestId('scheduler-card')).not.toBeVisible();
    }

    // Set up response tracking
    const tableTestCaseResponse = page.waitForResponse(
      (response: Response) =>
        response.url().includes('/api/v1/dataQuality/testCases') &&
        response.request().method() === 'POST'
    );

    let ingestionPipelineCalled = false;
    if (expectSchedulerCard) {
      const ingestionPipeline = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/services/ingestionPipelines') &&
          response.request().method() === 'POST'
      );

      await page.getByTestId('create-btn').click();
      const response = await tableTestCaseResponse;
      const ingestionPipelineResponse = await ingestionPipeline;

      expect(response.status()).toBe(201);
      expect(ingestionPipelineResponse.status()).toBe(201);
    } else {
      // Track if ingestion pipeline API is called
      page.on('response', (response: Response) => {
        if (
          response.url().includes('/api/v1/services/ingestionPipelines') &&
          response.request().method() === 'POST'
        ) {
          ingestionPipelineCalled = true;
        }
      });

      await page.getByTestId('create-btn').click();
      const response = await tableTestCaseResponse;

      expect(response.status()).toBe(201);
      expect(ingestionPipelineCalled).toBe(false);
    }

    await toastNotification(page, 'Test case created successfully.');
  };

  // Helper function to open test case form
  const openTestCaseForm = async (page: Page) => {
    await page.getByTestId('add-test-case-btn').click();
    await page.waitForSelector('[data-testid="test-case-form-v1"]', {
      state: 'visible',
    });
    await page.waitForLoadState('networkidle');
  };

  const visitDataQualityPage = async (page: Page) => {
    await page.goto('/data-quality/test-cases');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
  };

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await table1.create(apiContext);

    await afterAction();
  });

  test('Add Table & Column Test Case', async ({ page }) => {
    test.slow(true);

    const testCaseDetails = {
      testType: 'table row count to equal',
      testTypeId: 'tableRowCountToEqual',
      paramsValue: '10',
    };
    await visitDataQualityPage(page);

    await test.step('Create table-level test case', async () => {
      // Create table-level test case
      await openTestCaseForm(page);
      await selectTable(page, table1.entity.name);
      await createTestCase({
        page,
        ...testCaseDetails,
      });

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        `${testCaseDetails.testTypeId}_test_case`
      );
    });

    await test.step('Create column-level test case', async () => {
      const testCaseDetails = {
        testType: 'Column Values To Be Unique',
        testTypeId: 'columnValuesToBeUnique',
        expectSchedulerCard: false,
      };
      await visitDataQualityPage(page);
      // Create column-level test case
      await openTestCaseForm(page);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();
      await selectTable(page, table1.entity.name);

      await page.click('#testCaseFormV1_selectedColumn');
      await page
        .locator(
          `.ant-select-dropdown [title="${table1.entity.columns[0].name}"]`
        )
        .click();

      await createTestCase({
        page,
        ...testCaseDetails,
      });

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        `${testCaseDetails.testTypeId}_test_case`
      );
    });

    await test.step('Validate test case in Entity Page', async () => {
      await visitDataQualityTab(page, table1);

      await expect(
        page.getByTestId('columnValuesToBeUnique_test_case')
      ).toBeVisible();
      await expect(
        page.getByTestId('tableRowCountToEqual_test_case')
      ).toBeVisible();

      const pipelineApi = page.waitForResponse(
        '/api/v1/services/ingestionPipelines?*'
      );
      await page.getByTestId('pipeline').click();
      await pipelineApi;

      await expect(
        page
          .getByTestId('ingestion-list-table')
          .locator(
            `[data-row-key*="${table1.entityResponseData.fullyQualifiedName}.testSuite"]`
          )
      ).toHaveCount(1);
    });
  });

  test('Non-owner user should not able to add test case', async ({
    dataConsumerPage,
    dataStewardPage,
  }) => {
    await visitDataQualityPage(dataConsumerPage);
    await visitDataQualityPage(dataStewardPage);

    await dataConsumerPage.getByTestId('add-test-case-btn').click();
    await dataStewardPage.getByTestId('add-test-case-btn').click();

    await selectTable(dataConsumerPage, table1.entity.name);
    await selectTable(dataStewardPage, table1.entity.name);

    await dataConsumerPage.getByTestId('create-btn').click();
    await dataStewardPage.getByTestId('create-btn').click();

    await expect(
      dataConsumerPage.locator('#testCaseFormV1_selectedTable_help')
    ).toContainText(
      'You do not have the necessary permissions to create a test case on this table.'
    );
    await expect(
      dataStewardPage.locator('#testCaseFormV1_selectedTable_help')
    ).toContainText(
      'You do not have the necessary permissions to create a test case on this table.'
    );
  });
});
