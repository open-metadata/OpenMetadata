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
import { expect, Response, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { deleteTestCase, visitDataQualityTab } from '../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Table Difference test case
 * @description Creates a `tableDiff` test by selecting a second table, setting key columns, use columns, and threshold;
 * verifies visibility in the Data Quality tab, edits to add more columns, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableDiff`, pick Table 2 and its key columns; define Table 1 key/use columns and threshold.
 * 3. Submit and verify in Data Quality tab; then edit to add additional key/use columns; delete at the end.
 */
test('Table difference test case', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table1 = new TableClass();
  const table2 = new TableClass();
  await table1.create(apiContext);
  await table2.create(apiContext);
  const testCase = {
    name: `${table1.entity.name}_test_case`,
    table2: table2.entity.name,
    threshold: '23',
    type: 'tableDiff',
  };

  await table1.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table1.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('tab', { name: 'Table Profile' }).click();

  try {
    /**
     * Step 1: Create table difference test case
     * @description Opens the Test Case form, selects `tableDiff`, searches and selects Table 2, configures key columns
     * for Table 1 and Table 2, sets threshold and use columns, submits, and verifies the test appears under Data Quality.
     */
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      const testCaseDoc = page.waitForResponse(
        '/locales/en-US/OpenMetadata/TestCaseForm.md'
      );
      await page.getByTestId('test-case').click();
      await testCaseDoc;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.getByTestId('test-case-name').fill(testCase.name);

      await page.click('[id="root\\/testType"]');
      await page.waitForSelector(`[data-id="testType"]`, { state: 'visible' });

      await expect(page.locator('[data-id="testType"]')).toBeVisible();

      await page.fill('[id="root\\/testType"]', testCase.type);
      const tableListSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*index=table_search_index*`
      );
      await page.getByTestId('tableDiff').click();
      await tableListSearchResponse;

      const table2KeyColumnsInput = page.locator(
        '#testCaseFormV1_params_table2\\.keyColumns_0_value'
      );

      await expect(table2KeyColumnsInput).toBeDisabled();

      await page.click('#testCaseFormV1_params_table2');
      await page.waitForSelector(`[data-id="tableDiff"]`, {
        state: 'visible',
      });

      await expect(page.locator('[data-id="tableDiff"]')).toBeVisible();

      const tableSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${testCase.table2}*index=table_search_index*`
      );
      await page.fill(`#testCaseFormV1_params_table2`, testCase.table2);
      await tableSearchResponse;
      // The 'networkidle' parameter tells Playwright to wait until there are no network connections
      // for at least 500 ms.
      await page.waitForLoadState('networkidle');

      await expect(
        page
          .getByTitle(table2.entityResponseData?.['fullyQualifiedName'])
          .locator('div')
      ).toBeVisible();

      await page
        .getByTitle(table2.entityResponseData?.['fullyQualifiedName'])
        .locator('div')
        .click();

      await page.fill(
        `#testCaseFormV1_params_keyColumns_0_value`,
        table1.entity?.columns[0].name
      );
      await page.getByTitle(table1.entity?.columns[0].name).click();

      await page.fill(
        '#testCaseFormV1_params_table2\\.keyColumns_0_value',
        table2.entity?.columns[0].name
      );
      await page.getByTitle(table2.entity?.columns[0].name).click();

      await expect(table2KeyColumnsInput).not.toBeDisabled();

      await page.fill('#testCaseFormV1_params_threshold', testCase.threshold);
      await page.fill(
        '#testCaseFormV1_params_useColumns_0_value',
        table1.entity?.columns[0].name
      );

      await expect(
        page.getByTitle(table1.entity?.columns[0].name).nth(2)
      ).toHaveClass(/ant-select-item-option-disabled/);

      await page.locator('#testCaseFormV1_params_useColumns_0_value').clear();
      await page.fill(
        '#testCaseFormV1_params_useColumns_0_value',
        table1.entity?.columns[1].name
      );
      await page.getByTitle(table1.entity?.columns[1].name).click();

      await page.fill('#testCaseFormV1_params_where', 'test');
      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('create-btn').click();
      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);

      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await testCaseResponse;

      await expect(page.getByTestId(testCase.name)).toBeVisible();
    });

    /**
     * Step 2: Edit table difference test case
     * @description Opens the edit drawer, verifies pre-filled key columns for both tables, adds an additional key column
     * and use column, updates the test, and expects a success toast confirming the update.
     */
    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(testCase.name).getByRole('link')
      ).toBeVisible();

      const testCaseDoc = page.waitForResponse(
        '/locales/en-US/OpenMetadata/TestCaseForm.md'
      );
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();
      await testCaseDoc;

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      // Wait for form to finish loading (isLoading becomes false)
      await expect(page.getByTestId('edit-test-form')).toBeVisible();

      // Verify Table 1's keyColumns is enabled and populated in edit mode
      const table1KeyColumnsEditInput = page.locator(
        '#tableTestForm_params_keyColumns_0_value'
      );

      // Wait for the input to be visible and enabled, and then check its value
      await expect(table1KeyColumnsEditInput).toBeVisible();
      await expect(table1KeyColumnsEditInput).not.toBeDisabled();

      // Wait for the value to be populated
      // Use data-testid to find the select component
      const columnName = table1.entity?.columns[0].name;
      const table1Select = page.getByTestId('keyColumns-select');

      // Wait for the select to be visible and verify the selected value is displayed
      await expect(table1Select).toBeVisible();
      await expect(table1Select.getByText(columnName)).toBeVisible();

      // Verify table2.keyColumns is enabled and populated in edit mode
      const table2KeyColumnsEditInput = page.locator(
        '#tableTestForm_params_table2\\.keyColumns_0_value'
      );

      // Wait for the input to be visible and enabled, and then check its value
      await expect(table2KeyColumnsEditInput).toBeVisible();
      await expect(table2KeyColumnsEditInput).not.toBeDisabled();

      // Wait for the value to be populated
      const table2ColumnName = table2.entity?.columns[0].name;
      const table2Select = page.getByTestId('table2.keyColumns-select');

      // Wait for the select to be visible and verify the selected value is displayed
      await expect(table2Select).toBeVisible();
      await expect(table2Select.getByText(table2ColumnName)).toBeVisible();

      await page
        .locator('label')
        .filter({ hasText: "Table 1's key columns" })
        .getByRole('button')
        .click();
      await page.waitForSelector(`[data-id="tableDiff"]`, {
        state: 'visible',
      });

      await expect(page.locator('[data-id="tableDiff"]')).toBeVisible();

      await page.fill(
        '#tableTestForm_params_keyColumns_1_value',
        table1.entity?.columns[3].name
      );
      await page
        .getByTitle(table1.entity?.columns[3].name, { exact: true })
        .click();

      await page
        .locator('label')
        .filter({ hasText: 'Use Columns' })
        .getByRole('button')
        .click();
      await page.fill(
        '#tableTestForm_params_useColumns_1_value',
        table1.entity?.columns[2].name
      );
      await page
        .getByTitle(table1.entity?.columns[2].name, { exact: true })
        .click();
      await page.getByTestId('update-btn').click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    /**
     * Step 3: Delete table difference test case
     * @description Uses the shared delete helper to remove the created test case and validate cleanup.
     */
    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table1.delete(apiContext);
    await table2.delete(apiContext);

    await afterAction();
  }
});

/**
 * Custom SQL Query test case
 * @description Creates a `tableCustomSQLQuery` test with SQL in CodeMirror, selects strategy and threshold; verifies,
 * edits display name, SQL and strategy, updates threshold, and deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select `tableCustomSQLQuery`, input SQL, choose strategy (ROWS/COUNT), set threshold.
 * 3. Submit and verify in Data Quality tab; then edit display name, SQL and strategy; delete at the end.
 */
test('Custom SQL Query', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_test_case`,
    displayName: 'SQL Test Case Display Name',
    sqlQuery: 'SELECT * FROM table',
    type: 'tableCustomSQLQuery',
  };

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('tab', { name: 'Table Profile' }).click();

  try {
    /**
     * Step 1: Create custom SQL query test case
     * @description Opens the Test Case form, selects `tableCustomSQLQuery`, enters SQL in CodeMirror, chooses a strategy
     * and threshold, submits, and verifies the test appears in the Data Quality tab.
     */
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      const testCaseDoc = page.waitForResponse(
        '/locales/en-US/OpenMetadata/TestCaseForm.md'
      );
      await page.getByTestId('test-case').click();
      await testCaseDoc;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.getByTestId('test-case-name').fill(testCase.name);

      await page.click('[id="root\\/testType"]');
      await page.waitForSelector(`[data-id="testType"]`, { state: 'visible' });

      await expect(page.locator('[data-id="testType"]')).toBeVisible();

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.getByTestId('tableCustomSQLQuery').click();
      await page.waitForSelector(`[data-id="tableCustomSQLQuery"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableCustomSQLQuery"]')
      ).toBeVisible();

      await page.click('#testCaseFormV1_params_strategy');
      await page.locator('.CodeMirror-scroll').click();
      await page
        .getByTestId('code-mirror-container')
        .getByRole('textbox')
        .fill(testCase.sqlQuery);
      await page.getByLabel('Strategy').click();
      await page.getByTitle('ROWS').click();
      await page.fill('#testCaseFormV1_params_threshold', '23');
      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('create-btn').click();
      await createTestCaseResponse;

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);

      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await testCaseResponse;

      await expect(page.getByTestId(testCase.name)).toBeVisible();
    });

    /**
     * Step 2: Edit custom SQL query test case
     * @description Opens the edit drawer, updates display name, SQL content and strategy, adjusts threshold,
     * submits the update, and expects a success toast.
     */
    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(testCase.name).getByRole('link')
      ).toBeVisible();

      const testCaseDoc = page.waitForResponse(
        '/locales/en-US/OpenMetadata/TestCaseForm.md'
      );
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();
      await testCaseDoc;

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );
      await expect(page.locator('[id="root\\/name"]')).toHaveValue(
        testCase.name
      );
      await expect(page.getByTestId('code-mirror-container')).toContainText(
        testCase.sqlQuery
      );

      await page.locator('[id="root\\/displayName"]').clear();
      await page.fill('[id="root\\/displayName"]', testCase.displayName);

      await page.locator('.CodeMirror-scroll').click();
      await page
        .getByTestId('code-mirror-container')
        .getByRole('textbox')
        .fill(' update');
      await page.getByTestId('edit-test-form').getByText('ROWS').click();
      await page.getByTitle('COUNT').click();
      await page.waitForSelector(`[data-id="tableCustomSQLQuery"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableCustomSQLQuery"]')
      ).toBeVisible();

      await page.getByPlaceholder('Enter a Threshold').clear();
      await page.getByPlaceholder('Enter a Threshold').fill('244');
      await page.getByTestId('update-btn').click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    /**
     * Step 3: Delete custom SQL query test case
     * @description Uses the shared delete helper to remove the created SQL test case and validate cleanup.
     */
    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

/**
 * Column Values To Be Not Null test case
 * @description Creates a column-level `columnValuesToBeNotNull` test for a numeric column with description; verifies,
 * edits display name and description, and deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and description; submit; verify visibility in Data Quality tab.
 * 3. Edit display name and description; delete the test case.
 */
test('Column Values To Be Not Null', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE = {
    name: 'id_column_values_to_be_not_null',
    displayName: 'ID Column Values To Be Not Null',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeNotNull',
    label: 'Column Values To Be Not Null',
    description: 'New table test case for columnValuesToBeNotNull',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  const testCaseDoc = page.waitForResponse(
    '/locales/en-US/OpenMetadata/TestCaseForm.md'
  );
  await page.getByRole('menuitem', { name: 'Test case' }).click();
  await page.getByTestId('select-table-card').getByText('Column Level').click();
  await testCaseDoc;

  try {
    /**
     * Step 1: Create not-null column test case
     * @description Switches to Column Level, selects a numeric column, picks `columnValuesToBeNotNull` definition,
     * sets name and description, submits the form, and verifies visibility of the created test case.
     */
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(
        `[title="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.column}"]`
      );
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill(
        '[data-testid="test-case-name"]',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name
      );

      await page.fill(
        '[id="root\\/testType"]',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type
      );
      await page.click(
        `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type}"]`
      );
      await page.waitForSelector(
        `[data-id="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type}"]`,
        {
          state: 'visible',
        }
      );

      await expect(
        page.locator(`[data-id="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type}"]`)
      ).toBeVisible();

      await page
        .locator(descriptionBox)
        .fill(NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.description);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(
          `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}"]`
        )
      ).toBeVisible();
    });

    /**
     * Step 2: Edit not-null column test case
     * @description Opens the edit drawer, updates display name and description content, submits, and expects a success toast.
     */
    await test.step('Edit', async () => {
      await page
        .getByTestId(
          `action-dropdown-${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}`
        )
        .click();
      await page
        .getByTestId(`edit-${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}`)
        .click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}`
      );
      await expect(page.locator('[id="root\\/name"]')).toHaveValue(
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name
      );

      await page.locator('[id="root\\/displayName"]').clear();
      await page.fill(
        '[id="root\\/displayName"]',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.displayName
      );
      await page.getByText('New table test case for').first().click();
      await page.keyboard.type(' update');
      await page.getByTestId('update-btn').click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    /**
     * Step 3: Delete not-null column test case
     * @description Uses the shared delete helper to remove the created column-level test case and validate cleanup.
     */
    await test.step('Delete', async () => {
      await deleteTestCase(page, NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
