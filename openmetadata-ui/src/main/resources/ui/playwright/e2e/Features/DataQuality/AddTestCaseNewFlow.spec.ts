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
import { DOMAIN_TAGS, PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { visitDataQualityTab } from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

/**
 * Data Quality: Add Test Case (New Flow)
 * @description E2E coverage for creating table/column test cases via the new flow, validating scheduler/pipeline behavior, bulk adding from entity page, and enforcing permissions for non-owner roles.
 */
test.describe('Add TestCase New Flow', { tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`, PLAYWRIGHT_INGESTION_TAG_OBJ.tag] }, () => {
  // Helper function to select table
  const selectTable = async (page: Page, table: TableClass) => {
    await page.click('[id="root\\/table"]');
    const tableResponse = page.waitForResponse(
      '/api/v1/search/query?*index=table_search_index*'
    );
    await page.fill('[id="root\\/table"]', table.entity.name);
    await tableResponse;
    await page
      .locator(
        `.ant-select-dropdown [title="${table.entityResponseData.fullyQualifiedName}"]`
      )
      .click();

    await page.waitForSelector(`[data-id="selected-entity"]`, {
      state: 'visible',
    });

    await expect(page.locator('[data-id="selected-entity"]')).toBeVisible();
  };

  const selectColumn = async (page: Page, columnName: string) => {
    await page.click('[id="root\\/column"]');
    // appearing dropdown takes bit time and its not based on API call so adding manual wait to prevent flakiness.
    await page.waitForTimeout(2000);
    await page.waitForSelector(`.ant-select-dropdown [title="${columnName}"]`, {
      state: 'visible',
    });
    await page.locator(`.ant-select-dropdown [title="${columnName}"]`).click();
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
    await page.getByTestId('test-case-name').click();
    await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

    await expect(page.locator('[data-id="name"]')).toBeVisible();

    // test case name restriction for `:: " >` character
    const invalidTestCaseNames = ['test::case', 'test"case', 'test>case'];
    for (const name of invalidTestCaseNames) {
      await page.getByTestId('test-case-name').fill(name);
      await page.waitForSelector(`#testCaseFormV1_testName_help`, {
        state: 'visible',
      });

      await expect(page.locator('#testCaseFormV1_testName_help')).toHaveText(
        'Name cannot contain double colons (::), quotes ("), or greater-than symbols (>).'
      );

      await page.getByTestId('test-case-name').clear();
    }

    await page.getByTestId('test-case-name').fill(`${testTypeId}_test_case`);
    await page.click('[id="root\\/testType"]');
    await page.waitForSelector(`[data-id="testType"]`, { state: 'visible' });

    await expect(page.locator('[data-id="testType"]')).toBeVisible();

    await page.fill('[id="root\\/testType"]', testType);
    await page.getByTestId(testTypeId).click();

    await page.waitForSelector(`[data-id="${testTypeId}"]`, {
      state: 'visible',
    });

    await expect(page.locator(`[data-id="${testTypeId}"]`)).toBeVisible();

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

      const requestBody = JSON.parse(
        ingestionPipelineResponse.request().postData() || '{}'
      );

      expect(requestBody?.sourceConfig?.config).not.toHaveProperty('testCases');
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
  };

  // Helper function to open test case form
  const openTestCaseForm = async (page: Page) => {
    const testCaseDoc = page.waitForResponse(
      '/locales/en-US/OpenMetadata/TestCaseForm.md'
    );
    const tableEntityResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=table_search_index*'
    );
    await page.getByTestId('add-test-case-btn').click();
    await tableEntityResponse;
    await page.waitForSelector('[data-testid="test-case-form-v1"]', {
      state: 'visible',
    });
    await testCaseDoc;
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);
  };

  const visitDataQualityPage = async (page: Page) => {
    await page.goto('/data-quality/test-cases');
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);
  };

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  const tableTestCaseDetails = {
    testType: 'table row count to equal',
    testTypeId: 'tableRowCountToEqual',
    paramsValue: '10',
  };

  const columnTestCaseDetails = {
    testType: 'Column Values To Be Unique',
    testTypeId: 'columnValuesToBeUnique',
  };

  /**
   * Tests creating a table-level test case
   * @description Creates a table-row-count Equals test case from the Data Quality page and verifies the test entity and associated pipeline visibility.
   * Steps
   * 1. Open the test case form and select a table via indexed search.
   * 2. Fill the test name, select "table row count to equal", set params, and submit.
   * 3. Assert that TestSuite pipeline creation call occurs and the created test case is visible on the entity page.
   */
  test('Add Table Test Case', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    await visitDataQualityPage(page);

    await test.step('Create table-level test case', async () => {
      // Create table-level test case
      await openTestCaseForm(page);
      await selectTable(page, table);
      await createTestCase({
        page,
        ...tableTestCaseDetails,
      });
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        `${tableTestCaseDetails.testTypeId}_test_case`
      );
    });

    await test.step('Validate test case in Entity Page', async () => {
      await visitDataQualityTab(page, table);

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
            `[data-row-key*="${table.entityResponseData.fullyQualifiedName}.testSuite"]`
          )
      ).toHaveCount(1);
    });
  });

  /**
   * Tests creating a column-level test case
   * @description Creates a Column Values To Be Unique test case from the Data Quality page and validates the created test entity and test suite pipeline.
   * Steps
   * 1. Open the test case form, switch to Column Level, select table and a column.
   * 2. Fill test metadata and submit the form.
   * 3. Verify the created test displays on the entity page and pipeline tab shows the TestSuite pipeline.
   */
  test('Add Column Test Case', async ({ page }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    await visitDataQualityPage(page);

    await test.step('Create column-level test case', async () => {
      await visitDataQualityPage(page);
      // Create column-level test case
      await openTestCaseForm(page);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();
      await selectTable(page, table);

      await selectColumn(page, table.entity.columns[0].name);

      await createTestCase({
        page,
        ...columnTestCaseDetails,
      });

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        `${columnTestCaseDetails.testTypeId}_test_case`
      );
    });

    await test.step('Validate test case in Entity Page', async () => {
      await visitDataQualityTab(page, table);

      await expect(
        page.getByTestId('columnValuesToBeUnique_test_case')
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
            `[data-row-key*="${table.entityResponseData.fullyQualifiedName}.testSuite"]`
          )
      ).toHaveCount(1);
    });
  });

  /**
   * Tests bulk creation from entity page and pipeline validation
   * @description Adds a table-level and a column-level test case from the table details page and verifies test counts and the TestSuite pipeline, including edit navigation.
   * Steps
   * 1. From the table details page, add a table-level test case.
   * 2. Add a column-level test case (scheduler card hidden; verify no pipeline POST).
   * 3. Assert test count is 2 and pipeline count is 1; open pipeline list and navigate to edit.
   */
  test('Add multiple test case from table details page and validate pipeline', async ({
    page,
  }) => {
    test.slow();

    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    await visitDataQualityTab(page, table);

    await page
      .getByRole('tab', {
        name: 'Data Quality',
      })
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page.click('[data-testid="profiler-add-table-test-btn"]');
    await page.getByRole('menuitem', { name: 'Test case' }).click();
    await page.waitForLoadState('networkidle');

    await createTestCase({
      page,
      ...tableTestCaseDetails,
    });

    await page.click('[data-testid="profiler-add-table-test-btn"]');
    await page.getByRole('menuitem', { name: 'Test case' }).click();
    await page
      .getByTestId('select-table-card')
      .getByText('Column Level')
      .click();
    await page.waitForLoadState('networkidle');

    await selectColumn(page, table.entity.columns[0].name);

    await createTestCase({
      page,
      ...columnTestCaseDetails,
      expectSchedulerCard: false,
    });

    await page.waitForSelector('[data-testid="test-case-form-v1"]', {
      state: 'detached',
    });

    await expect(
      page.getByTestId('test-cases').getByTestId('count')
    ).toHaveText('2');

    await expect(page.getByTestId('pipeline').getByTestId('count')).toHaveText(
      '1'
    );

    const pipelineApi = page.waitForResponse(
      '/api/v1/services/ingestionPipelines?*pipelineType=TestSuite*'
    );
    await page.getByTestId('pipeline').click();
    await pipelineApi;

    await page.getByTestId('more-actions').first().click();
    await page.waitForSelector('[data-testid="actions-dropdown"]', {
      state: 'visible',
    });

    await page.waitForSelector(
      '[data-testid="actions-dropdown"] [data-testid="edit-button"]',
      {
        state: 'visible',
      }
    );

    await page
      .getByTestId('actions-dropdown')
      .getByTestId('edit-button')
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });
    await page.waitForSelector('[data-testid="select-all-test-cases"]', {
      state: 'visible',
    });

    await expect(page.getByTestId('select-all-test-cases')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  /**
   * Tests permission enforcement for non-owner roles
   * @description Validates that Data Consumer and Data Steward roles cannot create test cases and see the correct form validation message.
   * Steps
   * 1. As Data Consumer and Data Steward, open the create test case form.
   * 2. Select a table and attempt to submit.
   * 3. Verify the form helper shows lack-of-permission message and creation is blocked.
   */
  test('Non-owner user should not able to add test case', async ({
    dataConsumerPage,
    dataStewardPage,
    page,
  }) => {
    const table = new TableClass();
    const { apiContext } = await getApiContext(page);
    await table.create(apiContext);

    for (const page of [dataConsumerPage, dataStewardPage]) {
      await visitDataQualityPage(page);

      await openTestCaseForm(page);

      await selectTable(page, table);

      await page.getByTestId('create-btn').click();

      await expect(
        page.locator('#testCaseFormV1_selectedTable_help')
      ).toContainText(
        'You do not have the necessary permissions to create a test case on this table.'
      );
    }
  });
});
