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
import test, { expect, Page, Response } from '@playwright/test';
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_INGESTION_TAG_OBJ,
} from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import {
  chooseSelectOption,
  createNewPage,
  redirectToHomePage,
} from '../../../utils/common';
import {
  expectFormHint,
  ObservabilityFeature,
  selectAddObservabilityFeature,
} from '../../../utils/dataQuality';
import {
  submitTestCaseForm,
  visitDataQualityTab,
} from '../../../utils/testCases';

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

// Escape is not safe here: when the listbox has already closed (React Aria
// closes it as the drawer body re-lays out) it bubbles to the drawer and
// closes the form. An outside click can only dismiss the listbox.
const closeDimensionsListbox = async (page: Page) => {
  await page.getByTestId('form-heading').click();
  await expect(page.getByRole('listbox')).toBeHidden();
};

const dimensionsSelect = (page: Page) => page.getByTestId('dimensionColumns');

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

/**
 * Dimensionality Tests
 * @description Creates a dimension-level test case, edits dimension columns, and validates the dimension selector in the details view.
 */
test(
  'Dimensionality Tests',
  {
    tag: [
      `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`,
      PLAYWRIGHT_INGESTION_TAG_OBJ.tag,
    ],
  },
  async ({ page }) => {
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
      await selectAddObservabilityFeature(page, ObservabilityFeature.TEST_CASE);
      await page
        .getByTestId('select-table-card')
        .getByText('Dimension Level')
        .click();
      await testCaseDoc;

      await page.click('[id="root\\/column"]');
      await expectFormHint(page, 'Select Column');

      await chooseSelectOption(
        page.getByTestId('selectedColumn'),
        page
          .getByRole('option')
          .filter({ hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column })
      );

      await page.locator('[id="root\\/dimensionColumns"]').click();
      await expectFormHint(page, 'Select Dimensions');

      await expect(
        page
          .getByRole('option')
          .filter({ hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column })
      ).not.toBeVisible();

      for (const dimension of NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.dimensions) {
        await chooseSelectOption(
          dimensionsSelect(page),
          page.getByRole('option').filter({ hasText: dimension })
        );
      }

      await closeDimensionsListbox(page);

      await page.locator('[data-testid="test-case-name"] input').click();
      await page.fill(
        '[data-testid="test-case-name"] input',
        NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name
      );

      await chooseSelectOption(
        page.getByTestId('test-type'),
        page
          .getByRole('option')
          .filter({ hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.label })
          .first()
      );

      await submitTestCaseForm(page);
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

      await expect(page.getByTestId('form-heading')).toHaveText(
        `Edit ${NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.name}`
      );

      await page.locator('[id="root\\/dimensionColumns"]').click();
      await expectFormHint(page, 'Select Dimensions');

      await expect(
        page
          .getByRole('option')
          .filter({ hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.column })
      ).not.toBeVisible();

      await chooseSelectOption(
        dimensionsSelect(page),
        page.getByRole('option').filter({
          hasText: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.editDimensions[0],
        })
      );

      await closeDimensionsListbox(page);

      const updateTestCaseResponse = page.waitForResponse(
        (response: Response) =>
          response.url().includes('/api/v1/dataQuality/testCases') &&
          response.request().method() === 'PATCH'
      );

      await page.getByTestId('create-btn').click();
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

      await expect(
        page.locator(`[data-testid="dimensionality"]`)
      ).toBeVisible();

      await expect(
        page.locator(`[data-testid="dimension-select"]`)
      ).toBeVisible();

      await page.locator(`[data-testid="dimension-select"]`).click();

      await expect(
        page.getByRole('option', {
          name: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.dimensions[0],
        })
      ).toBeVisible();

      await expect(
        page.getByRole('option', {
          name: NEW_COLUMN_TEST_CASE_VALUE_TO_BE_BETWEEN.editDimensions[0],
        })
      ).toBeVisible();
    });
  }
);
