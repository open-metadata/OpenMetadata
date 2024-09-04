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
  createNewPage,
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { visitEntityPage } from '../../utils/entity';
import { deleteTestCase, visitDataQualityTab } from '../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table1.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table1.delete(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Table test case', async ({ page }) => {
  test.slow();

  const NEW_TABLE_TEST_CASE = {
    name: `table_column_name_to_exist_in_id_${uuid()}`,
    label: 'Table Column Name To Exist',
    type: 'tableColumnNameToExist',
    field: 'testCase',
    description: 'New table test case for TableColumnNameToExist',
  };
  await visitDataQualityTab(page, table1);

  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="table"]');

  await test.step('Create', async () => {
    await page.click('#tableTestForm_testTypeId');
    await page.waitForSelector(`text=${NEW_TABLE_TEST_CASE.label}`);
    await page.click(`text=${NEW_TABLE_TEST_CASE.label}`);
    await page.fill('#tableTestForm_testName', NEW_TABLE_TEST_CASE.name);
    await page.fill(
      '#tableTestForm_params_columnName',
      NEW_TABLE_TEST_CASE.field
    );
    await page.fill(descriptionBox, NEW_TABLE_TEST_CASE.description);
    await page.click('[data-testid="submit-test"]');

    await page.waitForSelector('[data-testid="success-line"]');

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();

    await page.waitForSelector('[data-testid="add-ingestion-button"]');
    await page.click('[data-testid="add-ingestion-button"]');
    await page.click('[data-testid="select-all-test-cases"]');

    // Schedule & Deploy
    await page.click('[data-testid="cron-type"]');
    await page.waitForSelector('.ant-select-item-option-content');
    await page.click('.ant-select-item-option-content:has-text("Hour")');
    const ingestionPipelines = page.waitForResponse(
      '/api/v1/services/ingestionPipelines'
    );
    const deploy = page.waitForResponse(
      '/api/v1/services/ingestionPipelines/deploy/*'
    );
    const status = page.waitForResponse(
      '/api/v1/services/ingestionPipelines/status'
    );
    await page.click('[data-testid="deploy-button"]');
    await ingestionPipelines;
    await deploy;
    await status;

    // check success
    await page.waitForSelector('[data-testid="success-line"]', {
      timeout: 15000,
    });

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();
    await expect(
      page.getByText('has been created and deployed successfully')
    ).toBeVisible();

    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases?fields=*'
    );
    await page.click(`[data-testid="view-service-button"]`);
    await testCaseResponse;

    await expect(page.getByTestId(NEW_TABLE_TEST_CASE.name)).toBeVisible();
  });

  await test.step('Edit', async () => {
    await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);
    await page.waitForSelector('.ant-modal-title');
    await page.locator('#tableTestForm_params_columnName').clear();
    await page.fill('#tableTestForm_params_columnName', 'new_column_name');
    const updateTestCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/*'
    );
    await page.locator('button').filter({ hasText: 'Submit' }).click();
    await updateTestCaseResponse;
    await toastNotification(page, 'Test case updated successfully.');
    await page.click(`[data-testid="edit-${NEW_TABLE_TEST_CASE.name}"]`);

    await page.waitForSelector('#tableTestForm_params_columnName');

    await expect(page.locator('#tableTestForm_params_columnName')).toHaveValue(
      'new_column_name'
    );

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await test.step('Delete', async () => {
    await deleteTestCase(page, NEW_TABLE_TEST_CASE.name);
  });
});

test('Column test case', async ({ page }) => {
  test.slow();

  const NEW_COLUMN_TEST_CASE = {
    name: 'email_column_value_lengths_to_be_between',
    column: 'email',
    type: 'columnValueLengthsToBeBetween',
    label: 'Column Value Lengths To Be Between',
    min: '3',
    max: '6',
    description: 'New table test case for columnValueLengthsToBeBetween',
  };

  await visitDataQualityTab(page, table1);
  await page.click('[data-testid="profiler-add-table-test-btn"]');
  await page.click('[data-testid="column"]');

  await test.step('Create', async () => {
    const testDefinitionResponse = page.waitForResponse(
      '/api/v1/dataQuality/testDefinitions?limit=*&entityType=COLUMN&testPlatform=OpenMetadata&supportedDataType=VARCHAR'
    );
    await page.click('#tableTestForm_column');
    await page.click(`[title="${NEW_COLUMN_TEST_CASE.column}"]`);
    await testDefinitionResponse;
    await page.fill('#tableTestForm_testName', NEW_COLUMN_TEST_CASE.name);
    await page.click('#tableTestForm_testTypeId');
    await page.click(`[title="${NEW_COLUMN_TEST_CASE.label}"]`);
    await page.fill(
      '#tableTestForm_params_minLength',
      NEW_COLUMN_TEST_CASE.min
    );
    await page.fill(
      '#tableTestForm_params_maxLength',
      NEW_COLUMN_TEST_CASE.max
    );
    await page.fill(descriptionBox, NEW_COLUMN_TEST_CASE.description);

    await page.click('[data-testid="submit-test"]');
    await page.waitForSelector('[data-testid="success-line"]');

    await expect(page.locator('[data-testid="success-line"]')).toBeVisible();

    await page.waitForSelector('[data-testid="view-service-button"]');

    const testCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases?fields=*'
    );
    await page.click(`[data-testid="view-service-button"]`);
    await testCaseResponse;

    await page.waitForSelector(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`);

    await expect(
      page.locator(`[data-testid="${NEW_COLUMN_TEST_CASE.name}"]`)
    ).toBeVisible();
  });

  await test.step('Edit', async () => {
    await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
    await page.waitForSelector('#tableTestForm_params_minLength');
    await page.locator('#tableTestForm_params_minLength').clear();
    await page.fill('#tableTestForm_params_minLength', '4');
    const updateTestCaseResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/*'
    );
    await page.locator('button').getByText('Submit').click();
    await updateTestCaseResponse;
    await toastNotification(page, 'Test case updated successfully.');

    await page.click(`[data-testid="edit-${NEW_COLUMN_TEST_CASE.name}"]`);
    await page.waitForSelector('#tableTestForm_params_minLength');
    const minLengthValue = await page
      .locator('#tableTestForm_params_minLength')
      .inputValue();

    expect(minLengthValue).toBe('4');

    await page.locator('button').getByText('Cancel').click();
  });

  await test.step('Delete', async () => {
    await deleteTestCase(page, NEW_COLUMN_TEST_CASE.name);
  });
});

test('Profiler matrix and test case graph should visible', async ({ page }) => {
  const DATA_QUALITY_TABLE = {
    term: 'dim_address',
    serviceName: 'sample_data',
    testCaseName: 'column_value_max_to_be_between',
  };

  await visitEntityPage({
    page,
    searchTerm: DATA_QUALITY_TABLE.term,
    dataTestId: `${DATA_QUALITY_TABLE.serviceName}-${DATA_QUALITY_TABLE.term}`,
  });
  await page.waitForSelector(`[data-testid="entity-header-display-name"]`);

  await expect(
    page.locator(`[data-testid="entity-header-display-name"]`)
  ).toContainText(DATA_QUALITY_TABLE.term);

  const profilerResponse = page.waitForResponse(
    `/api/v1/tables/*/tableProfile/latest`
  );
  await page.click('[data-testid="profiler"]');
  await profilerResponse;
  await page.waitForTimeout(1000);
  await page
    .getByRole('menuitem', {
      name: 'Column Profile',
    })
    .click();
  const getProfilerInfo = page.waitForResponse(
    '/api/v1/tables/*/columnProfile?*'
  );
  await page.locator('[data-row-key="shop_id"]').getByText('shop_id').click();
  await getProfilerInfo;

  await expect(page.locator('#count_graph')).toBeVisible();
  await expect(page.locator('#proportion_graph')).toBeVisible();
  await expect(page.locator('#math_graph')).toBeVisible();
  await expect(page.locator('#sum_graph')).toBeVisible();

  await page
    .getByRole('menuitem', {
      name: 'Data Quality',
    })
    .click();

  await page.waitForSelector(
    `[data-testid="${DATA_QUALITY_TABLE.testCaseName}"]`
  );
  const getTestCaseDetails = page.waitForResponse(
    '/api/v1/dataQuality/testCases/name/*?fields=*'
  );
  const getTestResult = page.waitForResponse(
    '/api/v1/dataQuality/testCases/*/testCaseResult?*'
  );
  await page
    .locator(`[data-testid="${DATA_QUALITY_TABLE.testCaseName}"]`)
    .getByText(DATA_QUALITY_TABLE.testCaseName)
    .click();

  await getTestCaseDetails;
  await getTestResult;

  await expect(
    page.locator(`#${DATA_QUALITY_TABLE.testCaseName}_graph`)
  ).toBeVisible();
});
