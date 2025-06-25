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
import { expect, test } from '@playwright/test';
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
  };

  await table1.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table1.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(testCase.name);
      await page.getByTestId('test-type').click();
      const tableListSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*index=table_search_index*`
      );
      await page.getByTestId('tableDiff').click();
      await tableListSearchResponse;
      await page.click('#tableTestForm_params_table2');
      const tableSearchResponse = page.waitForResponse(
        `/api/v1/search/query?q=*${testCase.table2}*index=table_search_index*`
      );
      await page.fill(`#tableTestForm_params_table2`, testCase.table2);
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
        `#tableTestForm_params_keyColumns_0_value`,
        table1.entity?.columns[0].name
      );
      await page.getByTitle(table1.entity?.columns[0].name).click();
      await page.fill('#tableTestForm_params_threshold', testCase.threshold);
      await page.fill(
        '#tableTestForm_params_useColumns_0_value',
        table1.entity?.columns[0].name
      );

      await expect(
        page.getByTitle(table1.entity?.columns[0].name).nth(2)
      ).toHaveClass(/ant-select-item-option-disabled/);

      await page.locator('#tableTestForm_params_useColumns_0_value').clear();
      await page.fill(
        '#tableTestForm_params_useColumns_0_value',
        table1.entity?.columns[1].name
      );
      await page.getByTitle(table1.entity?.columns[1].name).click();

      await page.fill('#tableTestForm_params_where', 'test');
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(testCase.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page
        .locator('label')
        .filter({ hasText: 'Key Columns' })
        .getByRole('button')
        .click();
      await page.fill(
        '#tableTestForm_params_keyColumns_1_value',
        table1.entity?.columns[3].name
      );
      await page.getByTitle(table1.entity?.columns[3].name, { exact: true }).click();

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
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table1.delete(apiContext);
    await table2.delete(apiContext);

    await afterAction();
  }
});

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
  };

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(testCase.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId('tableCustomSQLQuery').click();
      await page.click('#tableTestForm_params_strategy');
      await page.locator('.CodeMirror-scroll').click();
      await
        page.getByTestId('code-mirror-container')
        .getByRole('textbox')
        .fill(testCase.sqlQuery);
      await page.getByLabel('Strategy').click();
      await page.getByTitle('ROWS').click();
      await page.fill('#tableTestForm_params_threshold', '23');
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(testCase.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${testCase.name}`
      );
      await expect(page.locator('#tableTestForm_name')).toHaveValue(
        testCase.name
      );
      await expect(page.getByTestId('code-mirror-container')).toContainText(
        testCase.sqlQuery
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', testCase.displayName);

      await page.locator('.CodeMirror-scroll').click();
      await page.getByTestId('code-mirror-container').getByRole('textbox').fill(' update');
      await page.getByText('ROWS').click();
      await page.getByTitle('COUNT').click();
      await page.getByPlaceholder('Enter a Threshold').clear();
      await page.getByPlaceholder('Enter a Threshold').fill('244');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

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
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(
        `[title="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.column}"]`
      );
      await testDefinitionResponse;
      await page.fill(
        '#tableTestForm_testName',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name
      );

      await page.fill(
        '#tableTestForm_testTypeId',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type
      );
      await page.click(
        `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.type}"]`
      );
      await page
        .locator(descriptionBox)
        .fill(NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.description);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      await page.waitForSelector('[data-testid="view-service-button"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click(`[data-testid="view-service-button"]`);
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(
          `[data-testid="${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}"]`
        )
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page
        .getByTestId(`edit-${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}`)
        .click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name}`
      );
      await expect(page.locator('#tableTestForm_name')).toHaveValue(
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill(
        '#tableTestForm_displayName',
        NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.displayName
      );
      await page.getByText('New table test case for').first().click();
      await page.keyboard.type(' update');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Be Unique', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_UNIQUE_TEST_CASE = {
    name: 'column_values_to_be_unique_test',
    displayName: 'Column Values To Be Unique Test',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeUnique',
    description: 'Test case to verify column values are unique',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_UNIQUE_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_UNIQUE_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_UNIQUE_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_UNIQUE_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_UNIQUE_TEST_CASE.description);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      await page.waitForSelector('[data-testid="view-service-button"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_UNIQUE_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_UNIQUE_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${COLUMN_UNIQUE_TEST_CASE.name}`
      );
      await expect(page.locator('#tableTestForm_name')).toHaveValue(
        COLUMN_UNIQUE_TEST_CASE.name
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_UNIQUE_TEST_CASE.displayName);
      await page.getByText('Test case to verify column values are unique').first().click();
      await page.keyboard.type(' - updated');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_UNIQUE_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_BETWEEN_TEST_CASE = {
    name: 'column_values_to_be_between_test',
    displayName: 'Column Values To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValuesToBeBetween',
    description: 'Test case to verify column values are within range',
    minValue: '10',
    maxValue: '100',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_BETWEEN_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_BETWEEN_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_BETWEEN_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_BETWEEN_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_BETWEEN_TEST_CASE.description);

      // Fill min and max values
      await page.fill('#tableTestForm_params_minValue', COLUMN_BETWEEN_TEST_CASE.minValue);
      await page.fill('#tableTestForm_params_maxValue', COLUMN_BETWEEN_TEST_CASE.maxValue);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      await page.waitForSelector('[data-testid="view-service-button"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_BETWEEN_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_BETWEEN_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${COLUMN_BETWEEN_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_BETWEEN_TEST_CASE.displayName);
      
      // Update min and max values
      await page.fill('#tableTestForm_params_minValue', '5');
      await page.fill('#tableTestForm_params_maxValue', '200');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_BETWEEN_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Match Regex', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_REGEX_TEST_CASE = {
    name: 'column_values_to_match_regex_test',
    displayName: 'Column Values To Match Regex Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesToMatchRegex',
    description: 'Test case to verify column values match regex pattern',
    regex: '^[A-Za-z0-9]+$',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_REGEX_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_REGEX_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_REGEX_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_REGEX_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_REGEX_TEST_CASE.description);

      // Fill regex pattern
      await page.fill('#tableTestForm_params_regex', COLUMN_REGEX_TEST_CASE.regex);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      await page.waitForSelector('[data-testid="view-service-button"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_REGEX_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_REGEX_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${COLUMN_REGEX_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_REGEX_TEST_CASE.displayName);
      
      // Update regex pattern
      await page.fill('#tableTestForm_params_regex', '^[A-Za-z]+$');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_REGEX_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Be In Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_IN_SET_TEST_CASE = {
    name: 'column_values_to_be_in_set_test',
    displayName: 'Column Values To Be In Set Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesToBeInSet',
    description: 'Test case to verify column values are in allowed set',
    allowedValues: ['value1', 'value2', 'value3'],
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_IN_SET_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_IN_SET_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_IN_SET_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_IN_SET_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_IN_SET_TEST_CASE.description);

      // Fill allowed values
      for (let i = 0; i < COLUMN_IN_SET_TEST_CASE.allowedValues.length; i++) {
        await page.fill(`#tableTestForm_params_allowedValues_${i}`, COLUMN_IN_SET_TEST_CASE.allowedValues[i]);
        if (i < COLUMN_IN_SET_TEST_CASE.allowedValues.length - 1) {
          await page.click('[data-testid="add-allowed-value"]');
        }
      }

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      await page.waitForSelector('[data-testid="view-service-button"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_IN_SET_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_IN_SET_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${COLUMN_IN_SET_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_IN_SET_TEST_CASE.displayName);
      
      // Add another allowed value
      await page.click('[data-testid="add-allowed-value"]');
      await page.fill('#tableTestForm_params_allowedValues_3', 'value4');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_IN_SET_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Row Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_ROW_COUNT_TEST_CASE = {
    name: 'table_row_count_to_be_between_test',
    displayName: 'Table Row Count To Be Between Test',
    type: 'tableRowCountToBeBetween',
    description: 'Test case to verify table row count is within range',
    minValue: '100',
    maxValue: '1000',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_ROW_COUNT_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_ROW_COUNT_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_ROW_COUNT_TEST_CASE.description);
      
      // Fill min and max values
      await page.fill('#tableTestForm_params_minValue', TABLE_ROW_COUNT_TEST_CASE.minValue);
      await page.fill('#tableTestForm_params_maxValue', TABLE_ROW_COUNT_TEST_CASE.maxValue);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_ROW_COUNT_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_ROW_COUNT_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_ROW_COUNT_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_ROW_COUNT_TEST_CASE.displayName);
      
      // Update min and max values
      await page.fill('#tableTestForm_params_minValue', '50');
      await page.fill('#tableTestForm_params_maxValue', '2000');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_ROW_COUNT_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Column Count To Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_COLUMN_COUNT_TEST_CASE = {
    name: 'table_column_count_to_equal_test',
    displayName: 'Table Column Count To Equal Test',
    type: 'tableColumnCountToEqual',
    description: 'Test case to verify table has exact number of columns',
    columnCount: '5',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_COLUMN_COUNT_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_COLUMN_COUNT_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_COLUMN_COUNT_TEST_CASE.description);
      
      // Fill column count
      await page.fill('#tableTestForm_params_columnCount', TABLE_COLUMN_COUNT_TEST_CASE.columnCount);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_COLUMN_COUNT_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_COLUMN_COUNT_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_COLUMN_COUNT_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_COLUMN_COUNT_TEST_CASE.displayName);
      
      // Update column count
      await page.fill('#tableTestForm_params_columnCount', '10');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_COLUMN_COUNT_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Value Max To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_MAX_TEST_CASE = {
    name: 'column_value_max_to_be_between_test',
    displayName: 'Column Value Max To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValueMaxToBeBetween',
    description: 'Test case to verify column maximum value is within range',
    minValueForMaxInCol: '50',
    maxValueForMaxInCol: '500',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_MAX_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_MAX_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_MAX_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_MAX_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_MAX_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForMaxInCol', COLUMN_MAX_TEST_CASE.minValueForMaxInCol);
      await page.fill('#tableTestForm_params_maxValueForMaxInCol', COLUMN_MAX_TEST_CASE.maxValueForMaxInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_MAX_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_MAX_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_MAX_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_MAX_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForMaxInCol', '100');
      await page.fill('#tableTestForm_params_maxValueForMaxInCol', '1000');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_MAX_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Value Mean To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_MEAN_TEST_CASE = {
    name: 'column_value_mean_to_be_between_test',
    displayName: 'Column Value Mean To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValueMeanToBeBetween',
    description: 'Test case to verify column mean value is within range',
    minValueForMeanInCol: '10',
    maxValueForMeanInCol: '100',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_MEAN_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_MEAN_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_MEAN_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_MEAN_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_MEAN_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForMeanInCol', COLUMN_MEAN_TEST_CASE.minValueForMeanInCol);
      await page.fill('#tableTestForm_params_maxValueForMeanInCol', COLUMN_MEAN_TEST_CASE.maxValueForMeanInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_MEAN_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_MEAN_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_MEAN_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_MEAN_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForMeanInCol', '5');
      await page.fill('#tableTestForm_params_maxValueForMeanInCol', '200');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_MEAN_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Value Min To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_MIN_TEST_CASE = {
    name: 'column_value_min_to_be_between_test',
    displayName: 'Column Value Min To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValueMinToBeBetween',
    description: 'Test case to verify column minimum value is within range',
    minValueForMinInCol: '1',
    maxValueForMinInCol: '50',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_MIN_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_MIN_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_MIN_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_MIN_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_MIN_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForMinInCol', COLUMN_MIN_TEST_CASE.minValueForMinInCol);
      await page.fill('#tableTestForm_params_maxValueForMinInCol', COLUMN_MIN_TEST_CASE.maxValueForMinInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');  
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_MIN_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_MIN_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_MIN_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_MIN_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForMinInCol', '0');
      await page.fill('#tableTestForm_params_maxValueForMinInCol', '100');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_MIN_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Value Std Dev To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_STDDEV_TEST_CASE = {
    name: 'column_value_stddev_to_be_between_test',
    displayName: 'Column Value Std Dev To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValueStdDevToBeBetween',
    description: 'Test case to verify column standard deviation is within range',
    minValueForStdDevInCol: '0.5',
    maxValueForStdDevInCol: '10.0',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_STDDEV_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_STDDEV_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_STDDEV_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_STDDEV_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_STDDEV_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForStdDevInCol', COLUMN_STDDEV_TEST_CASE.minValueForStdDevInCol);
      await page.fill('#tableTestForm_params_maxValueForStdDevInCol', COLUMN_STDDEV_TEST_CASE.maxValueForStdDevInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_STDDEV_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_STDDEV_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_STDDEV_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_STDDEV_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForStdDevInCol', '1.0');
      await page.fill('#tableTestForm_params_maxValueForStdDevInCol', '20.0');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_STDDEV_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Value Median To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_MEDIAN_TEST_CASE = {
    name: 'column_value_median_to_be_between_test',
    displayName: 'Column Value Median To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValueMedianToBeBetween',
    description: 'Test case to verify column median value is within range',
    minValueForMedianInCol: '20',
    maxValueForMedianInCol: '80',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_MEDIAN_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_MEDIAN_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_MEDIAN_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_MEDIAN_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_MEDIAN_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForMedianInCol', COLUMN_MEDIAN_TEST_CASE.minValueForMedianInCol);
      await page.fill('#tableTestForm_params_maxValueForMedianInCol', COLUMN_MEDIAN_TEST_CASE.maxValueForMedianInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_MEDIAN_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_MEDIAN_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_MEDIAN_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_MEDIAN_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForMedianInCol', '15');
      await page.fill('#tableTestForm_params_maxValueForMedianInCol', '85');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_MEDIAN_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values Sum To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_SUM_TEST_CASE = {
    name: 'column_values_sum_to_be_between_test',
    displayName: 'Column Values Sum To Be Between Test',
    column: table.entity?.columns[0].name, // Use NUMERIC column (index 0)
    type: 'columnValuesSumToBeBetween',
    description: 'Test case to verify column sum is within range',
    minValueForSumInCol: '1000',
    maxValueForSumInCol: '10000',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_SUM_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_SUM_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_SUM_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_SUM_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_SUM_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minValueForSumInCol', COLUMN_SUM_TEST_CASE.minValueForSumInCol);
      await page.fill('#tableTestForm_params_maxValueForSumInCol', COLUMN_SUM_TEST_CASE.maxValueForSumInCol);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_SUM_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_SUM_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_SUM_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_SUM_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValueForSumInCol', '500');
      await page.fill('#tableTestForm_params_maxValueForSumInCol', '20000');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_SUM_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values Lengths To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_LENGTHS_TEST_CASE = {
    name: 'column_values_lengths_to_be_between_test',
    displayName: 'Column Values Lengths To Be Between Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValueLengthsToBeBetween',
    description: 'Test case to verify column value lengths are within range',
    minLength: '5',
    maxLength: '50',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_LENGTHS_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_LENGTHS_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_LENGTHS_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_LENGTHS_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_LENGTHS_TEST_CASE.description);

      await page.fill('#tableTestForm_params_minLength', COLUMN_LENGTHS_TEST_CASE.minLength);
      await page.fill('#tableTestForm_params_maxLength', COLUMN_LENGTHS_TEST_CASE.maxLength);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_LENGTHS_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_LENGTHS_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_LENGTHS_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_LENGTHS_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minLength', '3');
      await page.fill('#tableTestForm_params_maxLength', '100');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_LENGTHS_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Not Match Regex', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_NOT_REGEX_TEST_CASE = {
    name: 'column_values_to_not_match_regex_test',
    displayName: 'Column Values To Not Match Regex Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesToNotMatchRegex',
    description: 'Test case to verify column values do not match regex pattern',
    regex: '^[0-9]+$', // Should not be only digits
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_NOT_REGEX_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_NOT_REGEX_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_NOT_REGEX_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_NOT_REGEX_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_NOT_REGEX_TEST_CASE.description);

      await page.fill('#tableTestForm_params_regex', COLUMN_NOT_REGEX_TEST_CASE.regex);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_NOT_REGEX_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_NOT_REGEX_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_NOT_REGEX_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_NOT_REGEX_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_regex', '^[A-Z]+$'); // Update regex pattern
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_NOT_REGEX_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Be Not In Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_NOT_IN_SET_TEST_CASE = {
    name: 'column_values_to_be_not_in_set_test',
    displayName: 'Column Values To Be Not In Set Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesToBeNotInSet',
    description: 'Test case to verify column values are not in forbidden set',
    forbiddenValues: ['forbidden1', 'forbidden2', 'forbidden3'],
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_NOT_IN_SET_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_NOT_IN_SET_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_NOT_IN_SET_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_NOT_IN_SET_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_NOT_IN_SET_TEST_CASE.description);

      // Fill forbidden values
      for (let i = 0; i < COLUMN_NOT_IN_SET_TEST_CASE.forbiddenValues.length; i++) {
        await page.fill(`#tableTestForm_params_forbiddenValues_${i}`, COLUMN_NOT_IN_SET_TEST_CASE.forbiddenValues[i]);
        if (i < COLUMN_NOT_IN_SET_TEST_CASE.forbiddenValues.length - 1) {
          await page.click('[data-testid="add-forbidden-value"]');
        }
      }

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_NOT_IN_SET_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_NOT_IN_SET_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_NOT_IN_SET_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_NOT_IN_SET_TEST_CASE.displayName);
      
      // Add another forbidden value
      await page.click('[data-testid="add-forbidden-value"]');
      await page.fill('#tableTestForm_params_forbiddenValues_3', 'forbidden4');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_NOT_IN_SET_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values Missing Count To Be Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_MISSING_COUNT_TEST_CASE = {
    name: 'column_values_missing_count_to_be_equal_test',
    displayName: 'Column Values Missing Count To Be Equal Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesMissingCount',
    description: 'Test case to verify column missing count equals expected value',
    missingCountValue: '5',
    missingValueMatch: 'N/A',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_MISSING_COUNT_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_MISSING_COUNT_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_MISSING_COUNT_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_MISSING_COUNT_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_MISSING_COUNT_TEST_CASE.description);

      await page.fill('#tableTestForm_params_missingCountValue', COLUMN_MISSING_COUNT_TEST_CASE.missingCountValue);
      await page.fill('#tableTestForm_params_missingValueMatch', COLUMN_MISSING_COUNT_TEST_CASE.missingValueMatch);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_MISSING_COUNT_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_MISSING_COUNT_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_MISSING_COUNT_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_MISSING_COUNT_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_missingCountValue', '10');
      await page.fill('#tableTestForm_params_missingValueMatch', 'NULL');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_MISSING_COUNT_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Column Values To Be At Expected Location', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const COLUMN_LOCATION_TEST_CASE = {
    name: 'column_values_to_be_at_expected_location_test',
    displayName: 'Column Values To Be At Expected Location Test',
    column: table.entity?.columns[2].name, // Use VARCHAR column (index 2)
    type: 'columnValuesToBeAtExpectedLocation',
    description: 'Test case to verify geographic coordinates are at expected location',
    locationReferenceType: 'CITY',
    longitudeColumnName: 'longitude',
    latitudeColumnName: 'latitude',
    radius: '1000.0',
  };
  await table.create(apiContext);

  await visitDataQualityTab(page, table);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  try {
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
      );
      await page.click('#tableTestForm_column');
      await page.click(`[title="${COLUMN_LOCATION_TEST_CASE.column}"]`);
      await testDefinitionResponse;
      await page.fill('#tableTestForm_testName', COLUMN_LOCATION_TEST_CASE.name);
      await page.fill('#tableTestForm_testTypeId', COLUMN_LOCATION_TEST_CASE.type);
      await page.click(`[data-testid="${COLUMN_LOCATION_TEST_CASE.type}"]`);
      await page.locator(descriptionBox).fill(COLUMN_LOCATION_TEST_CASE.description);

      await page.selectOption('#tableTestForm_params_locationReferenceType', COLUMN_LOCATION_TEST_CASE.locationReferenceType);
      await page.fill('#tableTestForm_params_longitudeColumnName', COLUMN_LOCATION_TEST_CASE.longitudeColumnName);
      await page.fill('#tableTestForm_params_latitudeColumnName', COLUMN_LOCATION_TEST_CASE.latitudeColumnName);
      await page.fill('#tableTestForm_params_radius', COLUMN_LOCATION_TEST_CASE.radius);

      await page.click('[data-testid="submit-test"]');
      await page.waitForSelector('[data-testid="success-line"]');
      const testCaseResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list?*fields=*'
      );
      await page.click('[data-testid="view-service-button"]');
      await testCaseResponse;
      await page.click('[data-testid="profiler-tab-left-panel"]');

      await expect(
        page.locator(`[data-testid="${COLUMN_LOCATION_TEST_CASE.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`edit-${COLUMN_LOCATION_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${COLUMN_LOCATION_TEST_CASE.name}`);
      
      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', COLUMN_LOCATION_TEST_CASE.displayName);
      await page.selectOption('#tableTestForm_params_locationReferenceType', 'POSTAL_CODE');
      await page.fill('#tableTestForm_params_radius', '2000.0');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, COLUMN_LOCATION_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Row Count To Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_ROW_EQUAL_TEST_CASE = {
    name: 'table_row_count_to_equal_test',
    displayName: 'Table Row Count To Equal Test',
    type: 'tableRowCountToEqual',
    description: 'Test case to verify table has exact number of rows',
    value: '100',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_ROW_EQUAL_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_ROW_EQUAL_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_ROW_EQUAL_TEST_CASE.description);
      await page.fill('#tableTestForm_params_value', TABLE_ROW_EQUAL_TEST_CASE.value);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_ROW_EQUAL_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_ROW_EQUAL_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_ROW_EQUAL_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_ROW_EQUAL_TEST_CASE.displayName);
      
      // Update value
      await page.fill('#tableTestForm_params_value', '200');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_ROW_EQUAL_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Column To Match Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_COLUMN_MATCH_SET_TEST_CASE = {
    name: 'table_column_to_match_set_test',
    displayName: 'Table Column To Match Set Test',
    type: 'tableColumnToMatchSet',
    description: 'Test case to verify table columns match expected set',
    columnNames: 'column1,column2,column3,column4',
    ordered: false,
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_COLUMN_MATCH_SET_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_COLUMN_MATCH_SET_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_COLUMN_MATCH_SET_TEST_CASE.description);
      await page.fill('#tableTestForm_params_columnNames', TABLE_COLUMN_MATCH_SET_TEST_CASE.columnNames);
      await page.uncheck('#tableTestForm_params_ordered'); // Set ordered to false
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_COLUMN_MATCH_SET_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_COLUMN_MATCH_SET_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(`Edit ${TABLE_COLUMN_MATCH_SET_TEST_CASE.name}`);

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_COLUMN_MATCH_SET_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_columnNames', 'col1,col2,col3,col4,col5');
      await page.check('#tableTestForm_params_ordered'); // Set ordered to true
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_COLUMN_MATCH_SET_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Row Inserted Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_ROW_INSERTED_TEST_CASE = {
    name: 'table_row_inserted_count_to_be_between_test',
    displayName: 'Table Row Inserted Count To Be Between Test',
    type: 'tableRowInsertedCountToBeBetween',
    description: 'Test case to verify inserted row count is within range',
    min: '10',
    max: '100',
    columnName: 'created_at',
    rangeType: 'DAY',
    rangeInterval: '1',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_ROW_INSERTED_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_ROW_INSERTED_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_ROW_INSERTED_TEST_CASE.description);
      await page.fill('#tableTestForm_params_min', TABLE_ROW_INSERTED_TEST_CASE.min);
      await page.fill('#tableTestForm_params_max', TABLE_ROW_INSERTED_TEST_CASE.max);
      await page.fill('#tableTestForm_params_columnName', TABLE_ROW_INSERTED_TEST_CASE.columnName);
      await page.selectOption('#tableTestForm_params_rangeType', TABLE_ROW_INSERTED_TEST_CASE.rangeType);
      await page.fill('#tableTestForm_params_rangeInterval', TABLE_ROW_INSERTED_TEST_CASE.rangeInterval);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_ROW_INSERTED_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_ROW_INSERTED_TEST_CASE.name}`).click();

      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_ROW_INSERTED_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_ROW_INSERTED_TEST_CASE.displayName);
      
      // Update min and max values
      await page.fill('#tableTestForm_params_min', '5');
      await page.fill('#tableTestForm_params_max', '200');
      
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_ROW_INSERTED_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Column Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE = {
    name: 'table_column_count_to_be_between_test',
    displayName: 'Table Column Count To Be Between Test',
    type: 'tableColumnCountToBeBetween',
    description: 'Test case to verify table column count is within range',
    minValue: '3',
    maxValue: '10',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.description);
      await page.fill('#tableTestForm_params_minValue', TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.minValue);
      await page.fill('#tableTestForm_params_maxValue', TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.maxValue);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_minValue', '5');
      await page.fill('#tableTestForm_params_maxValue', '15');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_COLUMN_COUNT_BETWEEN_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Table Column Name To Exist', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const TABLE_COLUMN_NAME_EXIST_TEST_CASE = {
    name: 'table_column_name_to_exist_test',
    displayName: 'Table Column Name To Exist Test',
    type: 'tableColumnNameToExist',
    description: 'Test case to verify specific column exists in table',
    columnName: 'id',
  };
  await table.create(apiContext);

  await table.visitEntityPage(page);
  const profileResponse = page.waitForResponse(
    `/api/v1/tables/${encodeURIComponent(
      table.entityResponseData?.['fullyQualifiedName']
    )}/tableProfile/latest?includeColumnProfile=false`
  );
  await page.getByText('Data Observability').click();
  await profileResponse;
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(TABLE_COLUMN_NAME_EXIST_TEST_CASE.name);
      await page.getByTestId('test-type').click();
      await page.getByTestId(TABLE_COLUMN_NAME_EXIST_TEST_CASE.type).click();
      
      await page.locator(descriptionBox).fill(TABLE_COLUMN_NAME_EXIST_TEST_CASE.description);
      await page.fill('#tableTestForm_params_columnName', TABLE_COLUMN_NAME_EXIST_TEST_CASE.columnName);
      
      const createTestCaseResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases`
      );
      await page.getByTestId('submit-test').click();
      await createTestCaseResponse;
      const tableTestResponse = page.waitForResponse(
        `/api/v1/dataQuality/testCases/search/list?*fields=*`
      );
      await page.getByTestId('view-service-button').click();
      await tableTestResponse;
    });

    await test.step('Edit', async () => {
      await expect(
        page.getByTestId(TABLE_COLUMN_NAME_EXIST_TEST_CASE.name).getByRole('link')
      ).toBeVisible();

      await page.getByTestId(`edit-${TABLE_COLUMN_NAME_EXIST_TEST_CASE.name}`).click();
      await expect(page.locator('.ant-modal-title')).toHaveText(
        `Edit ${TABLE_COLUMN_NAME_EXIST_TEST_CASE.name}`
      );

      await page.locator('#tableTestForm_displayName').clear();
      await page.fill('#tableTestForm_displayName', TABLE_COLUMN_NAME_EXIST_TEST_CASE.displayName);
      await page.fill('#tableTestForm_params_columnName', 'user_id');
      await page.getByRole('button', { name: 'Submit' }).click();

      await toastNotification(page, 'Test case updated successfully.');
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, TABLE_COLUMN_NAME_EXIST_TEST_CASE.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
