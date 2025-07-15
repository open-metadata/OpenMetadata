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
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(testCase.name);
      await page.getByTestId('test-type').click();
      await page.fill('#tableTestForm_testTypeId', testCase.type);
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
      await page.getByRole('button', { name: 'Save' }).click();

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
  await page.getByRole('menuitem', { name: 'Table Profile' }).click();

  try {
    await test.step('Create', async () => {
      await page.getByTestId('profiler-add-table-test-btn').click();
      await page.getByTestId('test-case').click();
      await page.getByTestId('test-case-name').fill(testCase.name);
      await page.getByTestId('test-type').click();
      await page.fill('#tableTestForm_testTypeId', testCase.type);
      await page.getByTestId('tableCustomSQLQuery').click();
      await page.click('#tableTestForm_params_strategy');
      await page.locator('.CodeMirror-scroll').click();
      await page
        .getByTestId('code-mirror-container')
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
      await page
        .getByTestId('code-mirror-container')
        .getByRole('textbox')
        .fill(' update');
      await page.getByText('ROWS').click();
      await page.getByTitle('COUNT').click();
      await page.getByPlaceholder('Enter a Threshold').clear();
      await page.getByPlaceholder('Enter a Threshold').fill('244');
      await page.getByRole('button', { name: 'Save' }).click();

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
      await page.getByRole('button', { name: 'Save' }).click();

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
