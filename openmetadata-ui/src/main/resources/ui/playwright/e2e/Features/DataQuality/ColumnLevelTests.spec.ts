/*
 *  Copyright 2026 Collate.
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
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../../utils/common';
import {
  clickCreateTestCaseButton,
  clickEditTestCaseButton,
  clickUpdateButton,
  visitCreateTestCasePanelFromEntityPage,
} from '../../../utils/dataQuality';
import { deleteTestCase } from '../../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Column Level Data Quality Test Cases',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await afterAction();
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'id_column_values_to_be_not_null',
        displayName: 'ID Column Values To Be Not Null',
        column: table.entity?.columns[0].name,
        type: 'columnValuesToBeNotNull',
        label: 'Column Values To Be Not Null',
        description: 'New table test case for columnValuesToBeNotNull',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown and wait for documentation panel to be visible
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for test definitions API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC&supportedService=Mysql*'
        );
        const columnOption = page
          .locator('.ant-select-dropdown:visible')
          .locator(`[title="${testCase.column}"]`);
        await expect(columnOption).toBeVisible();
        await columnOption.click();
        await testDefinitionResponse;

        // Wait for dropdown to close after selection
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name and wait for documentation panel
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type and wait for documentation panel
        await page.fill('[id="root/testType"]', testCase.type);
        const testTypeOption = page
          .locator('.ant-select-dropdown:visible')
          .getByTestId(testCase.type);
        await expect(testTypeOption).toBeVisible();
        await testTypeOption.click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close after test type selection
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.locator(descriptionBox).fill(testCase.description);

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);
        await expect(page.locator('[id="root/name"]')).toHaveValue(
          testCase.name
        );

        await page.locator('[id="root/displayName"]').clear();
        await page.fill('[id="root/displayName"]', testCase.displayName);
        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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

      const testCase = {
        name: 'column_values_between',
        displayName: 'Column Values Between Range',
        column: table.entity?.columns[1].name,
        type: 'columnValuesToBeBetween',
        minValue: '0',
        maxValue: '1000',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown and wait for documentation panel
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for test definitions API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill('#testCaseFormV1_params_minValue', testCase.minValue);
        await page.fill('#testCaseFormV1_params_maxValue', testCase.maxValue);

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_minValue').clear();
        await page.locator('#tableTestForm_params_minValue').fill('10');
        await page.locator('#tableTestForm_params_maxValue').clear();
        await page.locator('#tableTestForm_params_maxValue').fill('2000');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_values_unique',
        displayName: 'Column Values Should Be Unique',
        column: table.entity?.columns[0].name,
        type: 'columnValuesToBeUnique',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('[id="root/displayName"]').clear();
        await page.fill('[id="root/displayName"]', testCase.displayName);

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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

      const testCase = {
        name: 'column_values_in_set',
        column: table.entity?.columns[1].name,
        type: 'columnValuesToBeInSet',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill allowed values
        await page.fill(
          '#testCaseFormV1_params_allowedValues_0_value',
          'active'
        );
        await page.getByRole('button', { name: 'plus' }).click();
        await page.fill(
          '#testCaseFormV1_params_allowedValues_1_value',
          'inactive'
        );

        await page.click('#testCaseFormV1_params_matchEnum');
        await page
          .locator('#testCaseFormV1_params_matchEnum[aria-checked="true"]')
          .waitFor({ state: 'attached' });
        await expect(
          page.locator('#testCaseFormV1_params_matchEnum')
        ).toHaveAttribute('aria-checked', 'true');

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.getByRole('button', { name: 'plus' }).click();
        await page.fill('#tableTestForm_params_allowedValues_2_value', 'open');
        await page.click('#tableTestForm_params_matchEnum');
        await page
          .locator('#tableTestForm_params_matchEnum[aria-checked="false"]')
          .waitFor({ state: 'attached' });
        await expect(
          page.locator('#tableTestForm_params_matchEnum')
        ).toHaveAttribute('aria-checked', 'false');
        await clickUpdateButton(page);

        await clickEditTestCaseButton(page, testCase.name);
        await expect(
          page.locator('#tableTestForm_params_matchEnum')
        ).toHaveAttribute('aria-checked', 'false');

        await page.getByTestId('cancel-btn').click();
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_values_not_in_set',
        column: table.entity?.columns[1].name,
        type: 'columnValuesToBeNotInSet',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill forbidden values
        await page.fill('#testCaseFormV1_params_forbiddenValues_0_value', '-1');
        await page.getByRole('button', { name: 'plus' }).click();
        await page.fill(
          '#testCaseFormV1_params_forbiddenValues_1_value',
          '-999'
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.getByRole('button', { name: 'plus' }).click();
        await page.fill(
          '#tableTestForm_params_forbiddenValues_2_value',
          '-9999'
        );

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_values_match_regex',
        column: table.entity?.columns[2].name,
        type: 'columnValuesToMatchRegex',
        regex: '^[0-9]+$',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill('#testCaseFormV1_params_regex', testCase.regex);

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_regex').clear();
        await page.locator('#tableTestForm_params_regex').fill('^[0-9]{1,5}$');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_values_not_match_regex',
        column: table.entity?.columns[2].name,
        type: 'columnValuesToNotMatchRegex',
        regex: '[a-zA-Z]',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_forbiddenRegex',
          testCase.regex
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_forbiddenRegex').clear();
        await page
          .locator('#tableTestForm_params_forbiddenRegex')
          .fill('[^0-9]');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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

      const testCase = {
        name: 'column_max_between',
        column: table.entity?.columns[1].name,
        type: 'columnValueMaxToBeBetween',
        minValueForMaxInCol: '0',
        maxValueForMaxInCol: '10000',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForMaxInCol',
          testCase.minValueForMaxInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForMaxInCol',
          testCase.maxValueForMaxInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_minValueForMaxInCol').clear();
        await page
          .locator('#tableTestForm_params_minValueForMaxInCol')
          .fill('100');
        await page.locator('#tableTestForm_params_maxValueForMaxInCol').clear();
        await page
          .locator('#tableTestForm_params_maxValueForMaxInCol')
          .fill('20000');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_min_between',
        column: table.entity?.columns[1].name,
        type: 'columnValueMinToBeBetween',
        minValueForMinInCol: '0',
        maxValueForMinInCol: '100',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForMinInCol',
          testCase.minValueForMinInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForMinInCol',
          testCase.maxValueForMinInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_minValueForMinInCol').clear();
        await page
          .locator('#tableTestForm_params_minValueForMinInCol')
          .fill('10');
        await page.locator('#tableTestForm_params_maxValueForMinInCol').clear();
        await page
          .locator('#tableTestForm_params_maxValueForMinInCol')
          .fill('200');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_mean_between',
        column: table.entity?.columns[1].name,
        type: 'columnValueMeanToBeBetween',
        minValueForMeanInCol: '0',
        maxValueForMeanInCol: '500',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForMeanInCol',
          testCase.minValueForMeanInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForMeanInCol',
          testCase.maxValueForMeanInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page
          .locator('#tableTestForm_params_minValueForMeanInCol')
          .clear();
        await page
          .locator('#tableTestForm_params_minValueForMeanInCol')
          .fill('50');
        await page
          .locator('#tableTestForm_params_maxValueForMeanInCol')
          .clear();
        await page
          .locator('#tableTestForm_params_maxValueForMeanInCol')
          .fill('1000');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_median_between',
        column: table.entity?.columns[1].name,
        type: 'columnValueMedianToBeBetween',
        minValueForMedianInCol: '0',
        maxValueForMedianInCol: '400',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForMedianInCol',
          testCase.minValueForMedianInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForMedianInCol',
          testCase.maxValueForMedianInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

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

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_stddev_between',
        column: table.entity?.columns[1].name,
        type: 'columnValueStdDevToBeBetween',
        minValueForStdDevInCol: '0',
        maxValueForStdDevInCol: '100',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForStdDevInCol',
          testCase.minValueForStdDevInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForStdDevInCol',
          testCase.maxValueForStdDevInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

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

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
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
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_sum_between',
        column: table.entity?.columns[1].name,
        type: 'columnValuesSumToBeBetween',
        minValueForSumInCol: '0',
        maxValueForSumInCol: '100000',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_minValueForColSum',
          testCase.minValueForSumInCol
        );
        await page.fill(
          '#testCaseFormV1_params_maxValueForColSum',
          testCase.maxValueForSumInCol
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_minValueForColSum').clear();
        await page
          .locator('#tableTestForm_params_minValueForColSum')
          .fill('1000');
        await page.locator('#tableTestForm_params_maxValueForColSum').clear();
        await page
          .locator('#tableTestForm_params_maxValueForColSum')
          .fill('200000');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
    });

    /**
     * Column Values Length To Be Between test case
     * @description Creates a `columnValuesLengthToBeBetween` test to verify string lengths in column are between range;
     * verifies visibility in the Data Quality tab, edits the range values, and finally deletes the test case.
     * Steps
     * 1. From entity page, open create test case (Column Level), select column and definition.
     * 2. Fill name and min/max length values; submit; verify visibility in Data Quality tab.
     * 3. Edit range values; delete the test case.
     */
    test('Column Values Length To Be Between', async ({ page }) => {
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_length_between',
        column: table.entity?.columns[2].name,
        type: 'columnValueLengthsToBeBetween',
        minLength: '1',
        maxLength: '50',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill('#testCaseFormV1_params_minLength', testCase.minLength);
        await page.fill('#testCaseFormV1_params_maxLength', testCase.maxLength);

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_minLength').clear();
        await page.locator('#tableTestForm_params_minLength').fill('5');
        await page.locator('#tableTestForm_params_maxLength').clear();
        await page.locator('#tableTestForm_params_maxLength').fill('100');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
    });

    /**
     * Column Values Missing Count To Be Equal test case
     * @description Creates a `columnValuesMissingCount` test to verify missing/null count equals expected value;
     * verifies visibility in the Data Quality tab, edits the missing count value, and finally deletes the test case.
     * Steps
     * 1. From entity page, open create test case (Column Level), select column and definition.
     * 2. Fill name and missing count value; submit; verify visibility in Data Quality tab.
     * 3. Edit missing count value; delete the test case.
     */
    test('Column Values Missing Count To Be Equal', async ({ page }) => {
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_missing_count_equal',
        column: table.entity?.columns[0].name,
        type: 'columnValuesMissingCount',
        missingCountValue: '0',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=NUMERIC&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        await expect(
          page.locator(`[data-id="${testCase.type}"]`)
        ).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_missingCountValue',
          testCase.missingCountValue
        );

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.locator('#tableTestForm_params_missingCountValue').clear();
        await page.locator('#tableTestForm_params_missingCountValue').fill('5');

        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
    });

    /**
     * Column Value To Be At Expected Location test case
     * @description Creates a `columnValuesToBeAtExpectedLocation` test to verify a value at a specific row location;
     * verifies visibility in the Data Quality tab, edits the expected value and row, and finally deletes the test case.
     * Steps
     * 1. From entity page, open create test case (Column Level), select column and definition.
     * 2. Fill name, expected value, and row number; submit; verify visibility in Data Quality tab.
     * 3. Edit expected value and row number; delete the test case.
     */
    test('Column Value To Be At Expected Location', async ({ page }) => {
      await redirectToHomePage(page);

      const testCase = {
        name: 'column_value_at_location',
        column: table.entity?.columns[1].name,
        type: 'columnValuesToBeAtExpectedLocation',
      };

      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('select-table-card')
        .getByText('Column Level')
        .click();

      await test.step('Create', async () => {
        // Click column dropdown
        await page.click('[id="root/column"]');
        await expect(page.locator('[data-id="column"]')).toBeVisible();

        // Select column and wait for API response
        const testDefinitionResponse = page.waitForResponse(
          '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=INT&supportedService=Mysql*'
        );
        await page.click(`[title="${testCase.column}"]`);
        await testDefinitionResponse;

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Fill test case name
        await page.getByTestId('test-case-name').click();
        await expect(page.locator('[data-id="name"]')).toBeVisible();
        await page.getByTestId('test-case-name').fill(testCase.name);

        // Select test type
        await page.fill('[id="root/testType"]', testCase.type);
        await page.getByTestId(testCase.type).click();
        // Todo: uncomment below assertion after adding docs for columnValuesToBeAtExpectedLocation test case -> @ShaileshParmar11
        // await expect(page.locator(`[data-id="${testCase.type}"]`)).toBeVisible();

        // Wait for dropdown to close
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        // Select location reference type from dropdown
        await page.click('#testCaseFormV1_params_locationReferenceType');
        const postalCodeOption = page.locator(
          `.ant-select-dropdown:visible [title="POSTAL_CODE"]`
        );
        await expect(postalCodeOption).toBeVisible();
        await postalCodeOption.click();

        // Wait for dropdown to close after selection
        await expect(
          page.locator('.ant-select-dropdown:visible')
        ).not.toBeVisible();

        await page.fill(
          '#testCaseFormV1_params_longitudeColumnName',
          'longitudeColumnName'
        );
        await page.fill(
          '#testCaseFormV1_params_latitudeColumnName',
          'latitudeColumnName'
        );
        await page.fill('#testCaseFormV1_params_radius', '1000');

        await clickCreateTestCaseButton(page, testCase.name);
      });

      await test.step('Edit', async () => {
        await clickEditTestCaseButton(page, testCase.name);

        await expect(
          page.getByTestId('edit-test-case-drawer-title')
        ).toHaveText(`Edit ${testCase.name}`);

        await page.fill('#tableTestForm_params_longitudeColumnName', 'Edit');
        await page.fill('#tableTestForm_params_latitudeColumnName', 'Edit');
        await page.locator('#tableTestForm_params_radius').clear();
        await page.fill('#tableTestForm_params_radius', '500');
        await clickUpdateButton(page);
      });

      await test.step('Delete', async () => {
        await deleteTestCase(page, testCase.name);
      });
    });
  }
);
