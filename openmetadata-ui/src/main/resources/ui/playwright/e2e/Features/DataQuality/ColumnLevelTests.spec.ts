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
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../../utils/common';
import { deleteTestCase, visitDataQualityTab } from '../../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

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
  const testCase = {
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.locator(descriptionBox).fill(testCase.description);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );
      await expect(page.locator('[id="root\\/name"]')).toHaveValue(
        testCase.name
      );

      await page.locator('[id="root\\/displayName"]').clear();
      await page.fill('[id="root\\/displayName"]', testCase.displayName);
      await page.getByText('New table test case for').first().click();
      await page.keyboard.type(' update');
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
 * Column Values To Be Between test case
 * @description Creates a `columnValuesToBeBetween` test for a numeric column with min and max values;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max values; submit; verify visibility in Data Quality tab.
 * 3. Edit min/max values; delete the test case.
 */
test('Column Values To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_between',
    displayName: 'Column Values Between Range',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeBetween',
    minValue: '0',
    maxValue: '1000',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_minValue', testCase.minValue);
      await page.fill('#testCaseFormV1_params_maxValue', testCase.maxValue);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minValue').clear();
      await page.locator('#tableTestForm_params_minValue').fill('10');
      await page.locator('#tableTestForm_params_maxValue').clear();
      await page.locator('#tableTestForm_params_maxValue').fill('2000');

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
 * Column Values To Be Unique test case
 * @description Creates a `columnValuesToBeUnique` test for a column to verify all values are unique;
 * verifies visibility in the Data Quality tab, edits display name, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name; submit; verify visibility in Data Quality tab.
 * 3. Edit display name; delete the test case.
 */
test('Column Values To Be Unique', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_unique',
    displayName: 'Column Values Should Be Unique',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeUnique',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('[id="root\\/displayName"]').clear();
      await page.fill('[id="root\\/displayName"]', testCase.displayName);

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
 * Column Values To Be In Set test case
 * @description Creates a `columnValuesToBeInSet` test to verify column values are within allowed set;
 * verifies visibility in the Data Quality tab, edits the allowed values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and allowed values array; submit; verify visibility in Data Quality tab.
 * 3. Edit allowed values; delete the test case.
 */
test('Column Values To Be In Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_in_set',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeInSet',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_allowedValues_0', '1');
      await page
        .locator('label')
        .filter({ hasText: 'Allowed Values' })
        .getByRole('button')
        .click();
      await page.fill('#testCaseFormV1_params_allowedValues_1', '2');
      await page
        .locator('label')
        .filter({ hasText: 'Allowed Values' })
        .getByRole('button')
        .click();
      await page.fill('#testCaseFormV1_params_allowedValues_2', '3');

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page
        .locator('label')
        .filter({ hasText: 'Allowed Values' })
        .getByRole('button')
        .click();
      await page.fill('#tableTestForm_params_allowedValues_3', '4');

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
 * Column Values To Be Not In Set test case
 * @description Creates a `columnValuesToBeNotInSet` test to verify column values are NOT in forbidden set;
 * verifies visibility in the Data Quality tab, edits the forbidden values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and forbidden values array; submit; verify visibility in Data Quality tab.
 * 3. Edit forbidden values; delete the test case.
 */
test('Column Values To Be Not In Set', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_not_in_set',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToBeNotInSet',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_forbiddenValues_0', '-1');
      await page
        .locator('label')
        .filter({ hasText: 'Forbidden Values' })
        .getByRole('button')
        .click();
      await page.fill('#testCaseFormV1_params_forbiddenValues_1', '-999');

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page
        .locator('label')
        .filter({ hasText: 'Forbidden Values' })
        .getByRole('button')
        .click();
      await page.fill('#tableTestForm_params_forbiddenValues_2', '-2');

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
 * Column Values To Match Regex test case
 * @description Creates a `columnValuesToMatchRegex` test to verify column values match a regex pattern;
 * verifies visibility in the Data Quality tab, edits the regex pattern, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and regex pattern; submit; verify visibility in Data Quality tab.
 * 3. Edit regex pattern; delete the test case.
 */
test('Column Values To Match Regex', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_match_regex',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToMatchRegex',
    regex: '^[0-9]+$',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_regex', testCase.regex);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_regex').clear();
      await page.locator('#tableTestForm_params_regex').fill('^[0-9]{1,5}$');

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
 * Column Values To Not Match Regex test case
 * @description Creates a `columnValuesToNotMatchRegex` test to verify column values do NOT match a regex pattern;
 * verifies visibility in the Data Quality tab, edits the regex pattern, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and regex pattern; submit; verify visibility in Data Quality tab.
 * 3. Edit regex pattern; delete the test case.
 */
test('Column Values To Not Match Regex', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_values_not_match_regex',
    column: table.entity?.columns[0].name,
    type: 'columnValuesToNotMatchRegex',
    regex: '[a-zA-Z]',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_regex', testCase.regex);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_regex').clear();
      await page.locator('#tableTestForm_params_regex').fill('[^0-9]');

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
 * Column Value Max To Be Between test case
 * @description Creates a `columnValueMaxToBeBetween` test to verify maximum value in column is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for max value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Value Max To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_max_between',
    column: table.entity?.columns[0].name,
    type: 'columnValueMaxToBeBetween',
    minValueForMaxInCol: '0',
    maxValueForMaxInCol: '10000',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForMaxInCol',
        testCase.minValueForMaxInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForMaxInCol',
        testCase.maxValueForMaxInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minValueForMaxInCol').clear();
      await page
        .locator('#tableTestForm_params_minValueForMaxInCol')
        .fill('100');
      await page.locator('#tableTestForm_params_maxValueForMaxInCol').clear();
      await page
        .locator('#tableTestForm_params_maxValueForMaxInCol')
        .fill('20000');

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
 * Column Value Min To Be Between test case
 * @description Creates a `columnValueMinToBeBetween` test to verify minimum value in column is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for min value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Value Min To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_min_between',
    column: table.entity?.columns[0].name,
    type: 'columnValueMinToBeBetween',
    minValueForMinInCol: '0',
    maxValueForMinInCol: '100',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForMinInCol',
        testCase.minValueForMinInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForMinInCol',
        testCase.maxValueForMinInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minValueForMinInCol').clear();
      await page
        .locator('#tableTestForm_params_minValueForMinInCol')
        .fill('10');
      await page.locator('#tableTestForm_params_maxValueForMinInCol').clear();
      await page
        .locator('#tableTestForm_params_maxValueForMinInCol')
        .fill('200');

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
 * Column Value Mean To Be Between test case
 * @description Creates a `columnValueMeanToBeBetween` test to verify mean value of column is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for mean value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Value Mean To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_mean_between',
    column: table.entity?.columns[0].name,
    type: 'columnValueMeanToBeBetween',
    minValueForMeanInCol: '0',
    maxValueForMeanInCol: '500',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForMeanInCol',
        testCase.minValueForMeanInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForMeanInCol',
        testCase.maxValueForMeanInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minValueForMeanInCol').clear();
      await page
        .locator('#tableTestForm_params_minValueForMeanInCol')
        .fill('50');
      await page.locator('#tableTestForm_params_maxValueForMeanInCol').clear();
      await page
        .locator('#tableTestForm_params_maxValueForMeanInCol')
        .fill('1000');

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
 * Column Value Median To Be Between test case
 * @description Creates a `columnValueMedianToBeBetween` test to verify median value of column is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for median value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Value Median To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_median_between',
    column: table.entity?.columns[0].name,
    type: 'columnValueMedianToBeBetween',
    minValueForMedianInCol: '0',
    maxValueForMedianInCol: '400',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForMedianInCol',
        testCase.minValueForMedianInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForMedianInCol',
        testCase.maxValueForMedianInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page
        .locator('#tableTestForm_params_minValueForMedianInCol')
        .clear();
      await page
        .locator('#tableTestForm_params_minValueForMedianInCol')
        .fill('100');
      await page
        .locator('#tableTestForm_params_maxValueForMedianInCol')
        .clear();
      await page
        .locator('#tableTestForm_params_maxValueForMedianInCol')
        .fill('800');

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
 * Column Value StdDev To Be Between test case
 * @description Creates a `columnValueStdDevToBeBetween` test to verify standard deviation of column is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for std dev value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Value StdDev To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_stddev_between',
    column: table.entity?.columns[0].name,
    type: 'columnValueStdDevToBeBetween',
    minValueForStdDevInCol: '0',
    maxValueForStdDevInCol: '100',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForStdDevInCol',
        testCase.minValueForStdDevInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForStdDevInCol',
        testCase.maxValueForStdDevInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page
        .locator('#tableTestForm_params_minValueForStdDevInCol')
        .clear();
      await page
        .locator('#tableTestForm_params_minValueForStdDevInCol')
        .fill('5');
      await page
        .locator('#tableTestForm_params_maxValueForStdDevInCol')
        .clear();
      await page
        .locator('#tableTestForm_params_maxValueForStdDevInCol')
        .fill('200');

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
 * Column Values Sum To Be Between test case
 * @description Creates a `columnValuesSumToBeBetween` test to verify sum of column values is between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max for sum value; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Values Sum To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_sum_between',
    column: table.entity?.columns[0].name,
    type: 'columnValuesSumToBeBetween',
    minValueForSumInCol: '0',
    maxValueForSumInCol: '100000',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_minValueForSumInCol',
        testCase.minValueForSumInCol
      );
      await page.fill(
        '#testCaseFormV1_params_maxValueForSumInCol',
        testCase.maxValueForSumInCol
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minValueForSumInCol').clear();
      await page
        .locator('#tableTestForm_params_minValueForSumInCol')
        .fill('1000');
      await page.locator('#tableTestForm_params_maxValueForSumInCol').clear();
      await page
        .locator('#tableTestForm_params_maxValueForSumInCol')
        .fill('200000');

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
 * Column Values Lengths To Be Between test case
 * @description Creates a `columnValuesLengthsToBeBetween` test to verify string lengths in column are between range;
 * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and min/max length values; submit; verify visibility in Data Quality tab.
 * 3. Edit range values; delete the test case.
 */
test('Column Values Lengths To Be Between', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_lengths_between',
    column: table.entity?.columns[0].name,
    type: 'columnValuesLengthsToBeBetween',
    minLength: '1',
    maxLength: '50',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill('#testCaseFormV1_params_minLength', testCase.minLength);
      await page.fill('#testCaseFormV1_params_maxLength', testCase.maxLength);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_minLength').clear();
      await page.locator('#tableTestForm_params_minLength').fill('5');
      await page.locator('#tableTestForm_params_maxLength').clear();
      await page.locator('#tableTestForm_params_maxLength').fill('100');

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
 * Column Values Missing Count To Be Equal test case
 * @description Creates a `columnValuesMissingCountToBeEqual` test to verify missing/null count equals expected value;
 * verifies visibility in the Data Quality tab, edits the missing count value, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name and missing count value; submit; verify visibility in Data Quality tab.
 * 3. Edit missing count value; delete the test case.
 */
test('Column Values Missing Count To Be Equal', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_missing_count_equal',
    column: table.entity?.columns[0].name,
    type: 'columnValuesMissingCountToBeEqual',
    missingCountValue: '0',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_missingCountValue',
        testCase.missingCountValue
      );

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_missingCountValue').clear();
      await page.locator('#tableTestForm_params_missingCountValue').fill('5');

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
 * Column Value To Be At Expected Location test case
 * @description Creates a `columnValueToBeAtExpectedLocation` test to verify a value at a specific row location;
 * verifies visibility in the Data Quality tab, edits the expected value and row, and finally deletes the test case.
 * Steps
 * 1. From entity page, open create test case (Column Level), select column and definition.
 * 2. Fill name, expected value, and row number; submit; verify visibility in Data Quality tab.
 * 3. Edit expected value and row number; delete the test case.
 */
test('Column Value To Be At Expected Location', async ({ page }) => {
  test.slow();

  await redirectToHomePage(page);
  const { afterAction, apiContext } = await getApiContext(page);
  const table = new TableClass();
  const testCase = {
    name: 'column_value_at_location',
    column: table.entity?.columns[0].name,
    type: 'columnValueToBeAtExpectedLocation',
    expectedValue: '1',
    rowNumber: '0',
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
    await test.step('Create', async () => {
      const testDefinitionResponse = page.waitForResponse(
        '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC'
      );
      await page.click('[id="root\\/column"]');
      await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

      await expect(page.locator('[data-id="column"]')).toBeVisible();

      await page.click(`[title="${testCase.column}"]`);
      await testDefinitionResponse;
      await page.getByTestId('test-case-name').click();
      await page.waitForSelector(`[data-id="name"]`, { state: 'visible' });

      await expect(page.locator('[data-id="name"]')).toBeVisible();

      await page.fill('[data-testid="test-case-name"]', testCase.name);

      await page.fill('[id="root\\/testType"]', testCase.type);
      await page.click(`[data-testid="${testCase.type}"]`);
      await page.waitForSelector(`[data-id="${testCase.type}"]`, {
        state: 'visible',
      });

      await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

      await page.fill(
        '#testCaseFormV1_params_expectedValue',
        testCase.expectedValue
      );
      await page.fill('#testCaseFormV1_params_rowNumber', testCase.rowNumber);

      const createTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'POST'
      );

      await page.click('[data-testid="create-btn"]');

      const response = await createTestCaseResponse;

      expect(response.status()).toBe(201);
      await expect(
        page.locator(`[data-testid="${testCase.name}"]`)
      ).toBeVisible();
    });

    await test.step('Edit', async () => {
      await page.getByTestId(`action-dropdown-${testCase.name}`).click();
      await page.getByTestId(`edit-${testCase.name}`).click();

      await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
        `Edit ${testCase.name}`
      );

      await page.locator('#tableTestForm_params_expectedValue').clear();
      await page.locator('#tableTestForm_params_expectedValue').fill('2');
      await page.locator('#tableTestForm_params_rowNumber').clear();
      await page.locator('#tableTestForm_params_rowNumber').fill('1');

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
