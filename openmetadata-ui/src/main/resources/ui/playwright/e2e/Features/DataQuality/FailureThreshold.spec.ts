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
import { APIRequestContext, Locator, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { fillCodeEditor } from '../../../utils/codeEditor';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  scrollIntoViewAndSettle,
  selectOptionWithRetry,
  uuid,
} from '../../../utils/common';
import {
  clickEditTestCaseButton,
  selectTestType,
  visitCreateTestCasePanelFromEntityPage,
} from '../../../utils/dataQuality';
import {
  openTestCaseDetailsPage,
  submitTestCaseForm,
  visitDataQualityTab,
} from '../../../utils/testCases';
import { expect, test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

const NULL_ROWS = 3;
const EVALUATED_ROWS = 100;
const RELATIVE_THRESHOLD = 5;

// Seed verdicts to exercise persistence and presentation; this does not run
// ingestion or verify the threshold evaluation algorithm.
const seedNotNullResult = async (
  apiContext: APIRequestContext,
  table: TableClass,
  testCaseFqn: string,
  testCaseStatus: 'Success' | 'Failed'
) => {
  await table.addTestCaseResult(apiContext, testCaseFqn, {
    result: `Found ${NULL_ROWS} null rows out of ${EVALUATED_ROWS} evaluated (3.00%).`,
    testCaseStatus,
    timestamp: Date.now(),
    failedRows: NULL_ROWS,
    passedRows: EVALUATED_ROWS - NULL_ROWS,
    failedRowsPercentage: (NULL_ROWS / EVALUATED_ROWS) * 100,
    passedRowsPercentage: ((EVALUATED_ROWS - NULL_ROWS) / EVALUATED_ROWS) * 100,
    testResultValue: [{ name: 'nullCount', value: String(NULL_ROWS) }],
  });
};

const expectRunDetails = async (
  page: Page,
  expected: {
    status: 'Success' | 'Failed';
    threshold: string;
    failed: string;
  }
) => {
  const card = page.getByTestId('run-details-card');

  await expect(card).toHaveAttribute('data-status', expected.status);
  await expect(card.getByTestId('run-details-threshold')).toHaveText(
    expected.threshold
  );
  await expect(card.getByTestId('run-details-failed')).toHaveText(
    expected.failed
  );
  await expect(card.getByTestId('run-details-evaluated')).toHaveText(
    `${EVALUATED_ROWS} row(s)`
  );
};

// The options live in a react-aria popover that closes on any scroll around its
// trigger, which can land right after it opens. Reopen it until the assertions
// hold on a single open popover.
const expectListboxOptions = async (
  trigger: Locator,
  assertions: (listbox: Locator) => Promise<void>
) => {
  const listbox = trigger.page().getByRole('listbox');

  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await scrollIntoViewAndSettle(trigger);
      await trigger.click();
    }
    await assertions(listbox);
  }).toPass({ timeout: 15000 });
};

/**
 * Data Quality failure thresholds
 * @description Covers the `threshold` / `thresholdUnit` parameters end to end in the UI: enum
 * parameters read as sentences and round-trip through the test case form, and seeded strict
 * and relative results display their configured thresholds alongside the reported verdicts.
 */
test.describe(
  'Data Quality failure thresholds',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    let table: TableClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      table = new TableClass();
      try {
        await table.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      try {
        await table.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    /**
     * Enum parameters render as sentences
     * @description The stored enums (`<=`, `>=`, `ABSOLUTE`, `PERCENTAGE`) never reach the user:
     * the options and the selected value are sentences, and the preview restates the choice.
     * Steps
     * 1. Open the table-level form and pick Custom SQL Query.
     * 2. Open Operator: every option is a sentence and no comparison symbol is shown.
     * 3. Pick "at least", a percentage unit and a threshold; the preview reads as a sentence.
     * 4. Save and reopen the test; the stored enums and restored sentence labels match.
     */
    test('Enum parameters render as sentences, not raw values', async ({
      page,
    }) => {
      const testCaseName = `pw_threshold_sql_${uuid()}`;
      await visitCreateTestCasePanelFromEntityPage(page, table);
      await page
        .getByTestId('test-case-name')
        .locator('input')
        .fill(testCaseName);
      await selectTestType(page, 'Custom SQL Query');
      await fillCodeEditor(
        page,
        page.getByTestId('code-mirror-container'),
        `SELECT * FROM ${table.entity.name}`
      );

      const operator = page.locator('#testCaseFormV1_params_operator');

      await test.step('Operator options are sentences', async () => {
        await expectListboxOptions(operator, async (listbox) => {
          for (const label of [
            'at most',
            'fewer than',
            'at least',
            'more than',
            'exactly',
            'anything other than',
          ]) {
            await expect(
              listbox.getByRole('option', { name: label, exact: true })
            ).toBeVisible({ timeout: 2000 });
          }
          await expect(listbox).not.toContainText(/[<>]|==|!=/, {
            timeout: 2000,
          });
        });
        const listbox = page.getByRole('listbox');

        await selectOptionWithRetry(
          operator,
          listbox.getByRole('option', { name: 'at least', exact: true })
        );

        await expect(listbox).toBeHidden();
        await expect(operator).toContainText('at least');
        await expect(operator).not.toContainText('>=');
      });

      await test.step('Threshold unit options are sentences', async () => {
        const unit = page.locator('#testCaseFormV1_params_thresholdUnit');
        await expectListboxOptions(unit, async (listbox) => {
          await expect(
            listbox.getByRole('option', { name: 'rows', exact: true })
          ).toBeVisible({ timeout: 2000 });
          await expect(listbox).not.toContainText(/ABSOLUTE|PERCENTAGE/, {
            timeout: 2000,
          });
        });
        const listbox = page.getByRole('listbox');

        await selectOptionWithRetry(
          unit,
          listbox.getByRole('option', { name: '% of table rows', exact: true })
        );

        await expect(unit).toContainText('% of table rows');
        await expect(unit).not.toContainText('PERCENTAGE');
      });

      await test.step('Preview restates the threshold in words', async () => {
        await page.fill('#testCaseFormV1_params_threshold', '10');

        await expect(page.getByTestId('threshold-preview-sentence')).toHaveText(
          'Pass when the query returns at least 10% of table rows.'
        );
      });

      await test.step('Saved enums restore their sentence labels', async () => {
        const response = await submitTestCaseForm(page);
        const created = await response.json();

        expect(created.parameterValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'operator', value: '>=' }),
            expect.objectContaining({
              name: 'thresholdUnit',
              value: 'PERCENTAGE',
            }),
            expect.objectContaining({ name: 'threshold', value: '10' }),
          ])
        );

        await visitDataQualityTab(page, table);
        await clickEditTestCaseButton(page, testCaseName);

        await expect(operator).toContainText('at least');
        await expect(operator).not.toContainText('>=');
        const unit = page.locator('#testCaseFormV1_params_thresholdUnit');
        await expect(unit).toContainText('% of table rows');
        await expect(unit).not.toContainText('PERCENTAGE');
        await expect(
          page.locator('#testCaseFormV1_params_threshold')
        ).toHaveValue('10');
        await expect(page.getByTestId('threshold-preview-sentence')).toHaveText(
          'Pass when the query returns at least 10% of table rows.'
        );
      });
    });

    /**
     * Seeded strict and relative results display their thresholds
     * @description A `columnValuesToBeNotNull` test with a 5% threshold is created through the form
     * next to a strict one on the same column. Both are given seeded results reporting 3 nulls
     * in 100 rows with precomputed Failed/Success verdicts. Each run shows its saved threshold
     * beside the failing share and the evaluated rows; ingestion evaluation is covered separately.
     * Steps
     * 1. Create the relative test in the form; the preview and the saved parameters carry 5% of rows.
     * 2. Create the strict test through the API.
     * 3. Seed the same 3-in-100 run on both.
     * 4. The strict run reads Failed with no tolerance; the relative run reads Success at 5% of rows.
     */
    test('Seeded strict and relative results display their thresholds', async ({
      page,
    }) => {
      const column = table.entity.columns[0].name;
      const relativeName = `pw_not_null_relative_${uuid()}`;
      const strictName = `pw_not_null_strict_${uuid()}`;
      let relativeFqn = '';
      let strictFqn = '';

      await test.step('Create the relative test in the form', async () => {
        await visitCreateTestCasePanelFromEntityPage(page, table);
        await page
          .getByTestId('select-table-card')
          .getByText('Column Level')
          .click();

        await selectOptionWithRetry(
          page.locator('[id="root/column"]'),
          page.getByRole('option', { name: column, exact: true })
        );
        await expect(page.getByRole('listbox')).toBeHidden();

        await page
          .getByTestId('test-case-name')
          .locator('input')
          .fill(relativeName);
        await selectTestType(page, 'Column Values To Be Not Null');

        await page.fill(
          '#testCaseFormV1_params_threshold',
          String(RELATIVE_THRESHOLD)
        );
        await selectOptionWithRetry(
          page.locator('#testCaseFormV1_params_thresholdUnit'),
          page.getByRole('option', { name: '% of rows', exact: true })
        );

        await expect(page.getByTestId('threshold-preview-sentence')).toHaveText(
          `Fail when more than ${RELATIVE_THRESHOLD}% of rows in ${column} fail this test.`
        );

        const response = await submitTestCaseForm(page);
        const created = await response.json();

        expect(created.parameterValues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: 'threshold',
              value: String(RELATIVE_THRESHOLD),
            }),
            expect.objectContaining({
              name: 'thresholdUnit',
              value: 'PERCENTAGE',
            }),
          ])
        );

        relativeFqn = created.fullyQualifiedName;
      });

      const { apiContext, afterAction } = await getApiContext(page);

      try {
        await test.step('Create the strict test and seed both runs', async () => {
          const strict = await table.createTestCase(apiContext, {
            name: strictName,
            entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}::columns::${column}>`,
            testDefinition: 'columnValuesToBeNotNull',
            parameterValues: [],
          });
          strictFqn = strict.fullyQualifiedName as string;

          await seedNotNullResult(apiContext, table, strictFqn, 'Failed');
          await seedNotNullResult(apiContext, table, relativeFqn, 'Success');
        });
      } finally {
        await afterAction();
      }
      await enableAiAppMode(page);

      await test.step('The strict test fails with no tolerance', async () => {
        await openTestCaseDetailsPage(page, strictFqn);

        await expectRunDetails(page, {
          status: 'Failed',
          threshold: 'No tolerance',
          failed: `${NULL_ROWS} row(s) (3.00%)`,
        });
      });

      await test.step('The relative test passes at 5% of rows', async () => {
        await openTestCaseDetailsPage(page, relativeFqn);

        await expectRunDetails(page, {
          status: 'Success',
          threshold: `${RELATIVE_THRESHOLD}% of rows`,
          failed: `3.00% (${NULL_ROWS} row(s))`,
        });
      });
    });
  }
);
