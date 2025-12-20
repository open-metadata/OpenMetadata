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
import { TableClass } from '../../../support/entity/TableClass';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../../utils/common';
import { deleteTestCase } from '../../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Table Row Count To Be Between test case
 * @description Creates a `tableRowCountToBeBetween` test with min and max row count values;
 * verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableRowCountToBeBetween`, set min and max values.
 * 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end.
 */
test('Table Row Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_row_count_between`,
    type: 'tableRowCountToBeBetween',
    minValue: '10',
    maxValue: '1000',
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
      await page.getByTestId('tableRowCountToBeBetween').click();
      await page.waitForSelector(`[data-id="tableRowCountToBeBetween"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableRowCountToBeBetween"]')
      ).toBeVisible();

      await page.fill('#testCaseFormV1_params_minValue', testCase.minValue);
      await page.fill('#testCaseFormV1_params_maxValue', testCase.maxValue);

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

      await page.getByPlaceholder('Min Value').clear();
      await page.getByPlaceholder('Min Value').fill('20');
      await page.getByPlaceholder('Max Value').clear();
      await page.getByPlaceholder('Max Value').fill('2000');

      await page.getByTestId('update-btn').click();

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

/**
 * Table Row Count To Equal test case
 * @description Creates a `tableRowCountToEqual` test with an exact row count value;
 * verifies visibility in the Data Quality tab, edits the value, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableRowCountToEqual`, set exact row count value.
 * 3. Submit and verify in Data Quality tab; then edit the value; delete at the end.
 */
test('Table Row Count To Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_row_count_equal`,
    type: 'tableRowCountToEqual',
    value: '100',
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
      await page.getByTestId('tableRowCountToEqual').click();
      await page.waitForSelector(`[data-id="tableRowCountToEqual"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableRowCountToEqual"]')
      ).toBeVisible();

      await page.fill('#testCaseFormV1_params_value', testCase.value);

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

      await page.locator('#tableTestForm_params_value').clear();
      await page.locator('#tableTestForm_params_value').fill('200');

      await page.getByTestId('update-btn').click();

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

/**
 * Table Column Count To Be Between test case
 * @description Creates a `tableColumnCountToBeBetween` test with min and max column count values;
 * verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableColumnCountToBeBetween`, set min and max values.
 * 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end.
 */
test('Table Column Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_column_count_between`,
    type: 'tableColumnCountToBeBetween',
    minColValue: '3',
    maxColValue: '10',
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
      await page.getByTestId('tableColumnCountToBeBetween').click();
      await page.waitForSelector(`[data-id="tableColumnCountToBeBetween"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableColumnCountToBeBetween"]')
      ).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minColValue',
        testCase.minColValue
      );
      await page.fill(
        '#testCaseFormV1_params_maxColValue',
        testCase.maxColValue
      );

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

      await page.locator('#tableTestForm_params_minColValue').clear();
      await page.locator('#tableTestForm_params_minColValue').fill('5');
      await page.locator('#tableTestForm_params_maxColValue').clear();
      await page.locator('#tableTestForm_params_maxColValue').fill('15');

      await page.getByTestId('update-btn').click();

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

/**
 * Table Column Count To Equal test case
 * @description Creates a `tableColumnCountToEqual` test with an exact column count value;
 * verifies visibility in the Data Quality tab, edits the value, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableColumnCountToEqual`, set exact column count value.
 * 3. Submit and verify in Data Quality tab; then edit the value; delete at the end.
 */
test('Table Column Count To Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_column_count_equal`,
    type: 'tableColumnCountToEqual',
    columnCount: '4',
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
      await page.getByTestId('tableColumnCountToEqual').click();
      await page.waitForSelector(`[data-id="tableColumnCountToEqual"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableColumnCountToEqual"]')
      ).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_columnCount',
        testCase.columnCount
      );

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

      await page.locator('#tableTestForm_params_columnCount').clear();
      await page.locator('#tableTestForm_params_columnCount').fill('5');

      await page.getByTestId('update-btn').click();

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

/**
 * Table Column Name To Exist test case
 * @description Creates a `tableColumnNameToExist` test to verify a column exists;
 * verifies visibility in the Data Quality tab, edits the column name, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableColumnNameToExist`, set column name.
 * 3. Submit and verify in Data Quality tab; then edit the column name; delete at the end.
 */
test('Table Column Name To Exist', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_column_name_exist`,
    type: 'tableColumnNameToExist',
    columnName: table.entity?.columns[0].name,
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
      await page.getByTestId('tableColumnNameToExist').click();
      await page.waitForSelector(`[data-id="tableColumnNameToExist"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableColumnNameToExist"]')
      ).toBeVisible();

      await page.fill('#testCaseFormV1_params_columnName', testCase.columnName);

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

      await page.locator('#tableTestForm_params_columnName').clear();
      await page
        .locator('#tableTestForm_params_columnName')
        .fill(table.entity?.columns[1].name);

      await page.getByTestId('update-btn').click();

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

/**
 * Table Column To Match Set test case
 * @description Creates a `tableColumnToMatchSet` test to verify columns match expected set;
 * verifies visibility in the Data Quality tab, edits the column names, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableColumnToMatchSet`, set column names array.
 * 3. Submit and verify in Data Quality tab; then edit the column names; delete at the end.
 */
test('Table Column To Match Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_column_match_set`,
    type: 'tableColumnToMatchSet',
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
      await page.getByTestId('tableColumnToMatchSet').click();
      await page.waitForSelector(`[data-id="tableColumnToMatchSet"]`, {
        state: 'visible',
      });

      await expect(
        page.locator('[data-id="tableColumnToMatchSet"]')
      ).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_columnNames',
        `${table.entity?.columns[0].name},${table.entity?.columns[1].name}`
      );

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

      await page.fill(
        '#testCaseForm_params_columnNames',
        table.entity?.columns[2].name
      );

      await page.click('#tableTestForm_params_ordered');

      const updateTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('update-btn').click();
      const response = await updateTestCaseResponse;

      expect(response.status()).toBe(200);
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

/**
 * Table Difference test case
 * @description Creates a `tableDiff` test by selecting a second table, setting key columns, use columns, and threshold;
 * verifies visibility in the Data Quality tab, edits to add more columns, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableDiff`, pick Table 2 and its key columns; define Table 1 key/use columns and threshold.
 * 3. Submit and verify in Data Quality tab; then edit to add additional key/use columns; delete at the end.
 */
test('Table Difference', async ({ page }) => {
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
      await page.waitForLoadState('domcontentloaded');

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

      await expect(page.getByTestId('edit-test-form')).toBeVisible();

      const table1KeyColumnsEditInput = page.locator(
        '#tableTestForm_params_keyColumns_0_value'
      );

      await expect(table1KeyColumnsEditInput).toBeVisible();
      await expect(table1KeyColumnsEditInput).not.toBeDisabled();

      const columnName = table1.entity?.columns[0].name;
      const table1Select = page.getByTestId('keyColumns-select');

      await expect(table1Select).toBeVisible();
      await expect(table1Select.getByText(columnName)).toBeVisible();

      const table2KeyColumnsEditInput = page.locator(
        '#tableTestForm_params_table2\\.keyColumns_0_value'
      );

      await expect(table2KeyColumnsEditInput).toBeVisible();
      await expect(table2KeyColumnsEditInput).not.toBeDisabled();

      const table2ColumnName = table2.entity?.columns[0].name;
      const table2Select = page.getByTestId('table2.keyColumns-select');

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

    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

/**
 * Table Row Inserted Count To Be Between test case
 * @description Creates a `tableRowInsertedCountToBeBetween` test with min and max inserted row count values;
 * verifies visibility in the Data Quality tab, edits the threshold values, and finally deletes the test case.
 * Steps
 * 1. Navigate to entity → Data Observability → Table Profile.
 * 2. Open Test Case form, select type `tableRowInsertedCountToBeBetween`, set min and max values.
 * 3. Submit and verify in Data Quality tab; then edit threshold values; delete at the end.
 */
test('Table Row Inserted Count To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  await table.create(apiContext);
  const testCase = {
    name: `${table.entity.name}_row_inserted_between`,
    type: 'tableRowInsertedCountToBeBetween',
    minValue: '5',
    maxValue: '500',
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
      await page.getByTestId('tableRowInsertedCountToBeBetween').click();
      await page.waitForSelector(
        `[data-id="tableRowInsertedCountToBeBetween"]`,
        {
          state: 'visible',
        }
      );

      await expect(
        page.locator('[data-id="tableRowInsertedCountToBeBetween"]')
      ).toBeVisible();

      await page.fill('#testCaseFormV1_params_minValue', testCase.minValue);
      await page.fill('#testCaseFormV1_params_maxValue', testCase.maxValue);

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

      await page.fill('#testCaseForm_params_minValue', '');
      await page.fill('#testCaseForm_params_minValue', '10');
      await page.fill('#testCaseForm_params_maxValue', '');
      await page.fill('#testCaseForm_params_maxValue', '1000');

      const updateTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'PATCH'
      );
      await page.getByTestId('update-btn').click();
      const response = await updateTestCaseResponse;

      expect(response.status()).toBe(200);
    });

    await test.step('Delete', async () => {
      await deleteTestCase(page, testCase.name);
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
