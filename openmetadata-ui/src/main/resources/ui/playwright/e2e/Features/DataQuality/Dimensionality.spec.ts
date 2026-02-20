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
import test, { expect, Response } from '@playwright/test';
import { DOMAIN_TAGS, PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { visitDataQualityTab } from '../../../utils/testCases';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

const NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN = {
  name: 'id_column_value_lengths_to_be_between',
  displayName: 'name Column Value Lengths To Be Between',
  column: table.entity?.columns[2].name,
  dimensions: [table.entity?.columns[3].name],
  editDimensions: [
    table.entity?.columns[0].name,
    table.entity?.columns[1].name,
  ],
  type: 'columnValueLengthsToBeBetween',
  label: 'Column Value Lengths To Be Between',
  description: 'New table test case for Column Value Lengths To Be Between',
};

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.slow();

/**
 * Dimensionality Tests
 * @description Creates a dimension-level test case, edits dimension columns, and validates the dimension selector in the details view.
 */
test('Dimensionality Tests', { tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`, PLAYWRIGHT_INGESTION_TAG_OBJ.tag] }, async ({ page }) => {
  await test.step('Add dimensionality test case', async () => {
    /**
     * Step 1: Create dimension-level test case
     * @description Opens the create form in Dimension Level mode, selects a primary column and dimension columns,
     * chooses the test definition, submits, waits for pipeline deploy endpoints, and verifies the new test.
     */
    await redirectToHomePage(page);
    await visitDataQualityTab(page, table);
    await page.click('[data-testid="profiler-add-table-test-btn"]');
    const testCaseDoc = page.waitForResponse(
      '/locales/en-US/OpenMetadata/TestCaseForm.md'
    );
    await page.getByRole('menuitem', { name: 'Test case' }).click();
    await page
      .getByTestId('select-table-card')
      .getByText('Dimension Level')
      .click();
    await testCaseDoc;

    await page.click('[id="root\\/column"]');
    await page.waitForSelector(`[data-id="column"]`, { state: 'visible' });

    await expect(page.locator('[data-id="column"]')).toBeVisible();

    await page.click(
      `[title="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column}"]`
    );

    await page.locator('[id="root\\/dimensionColumns"]').click();
    await page.waitForSelector(`[data-id="dimensionColumns"]`, {
      state: 'visible',
    });

    await expect(
      page.locator(
        `.ant-select-dropdown:not(.ant-select-dropdown-hidden) [title="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column}"]`
      )
    ).not.toBeVisible();

    for (const dimension of NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.dimensions) {
      await page.click(
        `.ant-select-dropdown:not(.ant-select-dropdown-hidden) [title="${dimension}"]`
      );
    }

    await page.locator('[data-id="dimensionColumns"]').click();

    await page.getByTestId('test-case-name').click();
    await page.fill(
      '[data-testid="test-case-name"]',
      NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name
    );

    await page.fill(
      '[id="root\\/testType"]',
      NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.type
    );
    await page.click(
      `[data-testid="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.type}"]`
    );

    const createTestCaseResponse = page.waitForResponse(
      (response: Response) =>
        response.url().includes('/api/v1/dataQuality/testCases') &&
        response.request().method() === 'POST'
    );

    const ingestionPipelines = page.waitForResponse(
      '/api/v1/services/ingestionPipelines'
    );
    const deploy = page.waitForResponse(
      '/api/v1/services/ingestionPipelines/deploy/*'
    );

    await page.click('[data-testid="create-btn"]');

    const response = await createTestCaseResponse;
    await ingestionPipelines;
    await deploy;

    expect(response.status()).toBe(201);
    await expect(
      page.locator(
        `[data-testid="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}"]`
      )
    ).toBeVisible();
  });

  await test.step('Edit dimensionality from entity page', async () => {
    /**
     * Step 2: Edit dimension columns
     * @description Opens the edit drawer for the created test, adds a new dimension column, submits a PATCH,
     * and verifies a successful update response.
     */
    await page
      .getByTestId(
        `action-dropdown-${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}`
      )
      .click();
    await page
      .getByTestId(`edit-${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}`)
      .click();

    await expect(page.getByTestId('edit-test-case-drawer-title')).toHaveText(
      `Edit ${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}`
    );

    await page.locator('[id="root\\/dimensionColumns"]').click();
    await page.waitForSelector(`[data-id="dimensionColumns"]`, {
      state: 'visible',
    });

    await expect(
      page.locator(
        `.ant-select-dropdown:not(.ant-select-dropdown-hidden) [title="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column}"]`
      )
    ).not.toBeVisible();

    await page.click(
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) [title="${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.editDimensions[0]}"]`
    );

    const updateTestCaseResponse = page.waitForResponse(
      (response: Response) =>
        response.url().includes('/api/v1/dataQuality/testCases') &&
        response.request().method() === 'PATCH'
    );

    await page.getByTestId('update-btn').click();
    const response = await updateTestCaseResponse;

    expect(response.status()).toBe(200);
  });

  await test.step('Details page should show updated dimensions', async () => {
    /**
     * Step 3: Validate details view dimensions
     * @description Opens the dimension results from the test card, ensures the dimensionality view and selector are visible,
     * and verifies both original and edited dimension values are present in the selector options.
     */
    await expect(
      page.locator(
        `[data-testid="dimension-count-${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}"]`
      )
    ).toBeVisible();

    const dimensionResponse = page.waitForResponse(
      '/api/v1/dataQuality/testCases/dimensionResults/*?*'
    );
    await page
      .locator(
        `[data-testid="dimension-count-${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}"]`
      )
      .click();

    await dimensionResponse;

    await expect(page.locator(`[data-testid="dimensionality"]`)).toBeVisible();

    await expect(
      page.locator(`[data-testid="dimension-select"]`)
    ).toBeVisible();

    await page.locator(`[data-testid="dimension-select"]`).click();

    await expect(
      page.locator(
        `[data-value=${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.dimensions[0]}]`
      )
    ).toBeVisible();

    await expect(
      page.locator(
        `[data-value=${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.editDimensions[0]}]`
      )
    ).toBeVisible();
  });
});
