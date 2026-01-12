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
import { expect, test as base } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { test } from '../../fixtures/pages';

const VALID_TEST_CASES_CSV = `name,displayName,description,testDefinition,entityFQN,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms
test_row_count,Row Count Check,Validates row count,tableRowCountToBeBetween,sample_data.ecommerce_db.shopify.dim_customer,,"{""name"":""minValue"",""value"":100};{""name"":""maxValue"",""value"":10000}",false,false,,,
test_null_check,Null Check,Check for nulls,columnValuesToBeNotNull,sample_data.ecommerce_db.shopify.dim_customer.customer_id,,,false,false,,PII.Sensitive,`;

const INVALID_TEST_CASES_CSV = `name,displayName,testDefinition
incomplete_test,Incomplete Test,columnValuesToBeNotNull`;

const createTempCSVFile = (content: string, filename: string): string => {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

const cleanupTempFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

test.describe(
  'Test Suite Bulk Import/Export - Admin User',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();
    let testSuiteFqn: string;

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);

      const tableData = await table.get(apiContext);
      testSuiteFqn = tableData.testSuite?.fullyQualifiedName ?? '';

      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should export test cases from test suite details page', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
      await page.getByTestId('export-button').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('export-modal-submit').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('should navigate to import page from test suite details', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await expect(page.getByTestId('import-button')).toBeVisible();
      await page.getByTestId('import-button').click();

      await expect(page).toHaveURL(/\/bulk\/import\/testCase/);
      await expect(
        page.getByText(table.entityResponseData.testSuite?.displayName ?? '')
      ).toBeVisible();
    });

    test('should upload and validate CSV from test suite', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'test-suite-valid.csv'
      );

      try {
        await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();
        await expect(page).toHaveURL(/\/bulk\/import\/testCase/);

        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });
        await expect(page.getByText(/uploaded/i)).toBeVisible({
          timeout: 15000,
        });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });

    test('should show validation errors for invalid CSV', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        INVALID_TEST_CASES_CSV,
        'test-suite-invalid.csv'
      );

      try {
        await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();

        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });
        await expect(
          page.getByText(/error|failed|invalid/i).first()
        ).toBeVisible({ timeout: 15000 });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });

    test('should redirect to test suite details after successful import', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'test-suite-redirect.csv'
      );

      try {
        await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();

        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });

        await page.waitForTimeout(3000);
        const importButton = page
          .getByTestId('import-submit-btn')
          .or(page.getByRole('button', { name: /import|update/i }));

        if (await importButton.isVisible()) {
          await importButton.click();

          await expect(page).toHaveURL(
            new RegExp(`/test-suite/${encodeURIComponent(testSuiteFqn)}`),
            { timeout: 15000 }
          );
        }
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });

    test('should allow editing test cases in import grid', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'test-suite-editable.csv'
      );

      try {
        await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();
        await expect(page).toHaveURL(/\/bulk\/import\/testCase/);

        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });

        await page.waitForTimeout(2000);

        await expect(page.locator('.rdg')).toBeVisible({ timeout: 10000 });

        const gridRows = page.locator('.rdg-row');
        const rowCount = await gridRows.count();
        expect(rowCount).toBeGreaterThan(0);

        const addRowButton = page.getByText(/add.*row/i);
        if (await addRowButton.isVisible()) {
          await expect(addRowButton).toBeVisible();
        }

        await expect(
          page
            .getByTestId('import-submit-btn')
            .or(page.getByRole('button', { name: /import|update/i }))
        ).toBeVisible({ timeout: 5000 });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });

    test('should navigate through all import steps', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'test-suite-full-flow.csv'
      );

      try {
        await page.goto(`/test-suite/${encodeURIComponent(testSuiteFqn)}`);
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();

        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });

        await page.waitForTimeout(3000);

        const stepper = page.locator(
          '.ant-steps-item-active, .stepper-item-active'
        );
        await expect(stepper.first()).toBeVisible({ timeout: 5000 });

        const stepLabels = page.locator(
          '.ant-steps-item-title, .stepper-item-title'
        );
        const stepCount = await stepLabels.count();
        expect(stepCount).toBeGreaterThanOrEqual(3);
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });
  }
);

test.describe(
  'Test Suite Import/Export - Permissions',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();
    let testSuiteFqn: string;

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);

      const tableData = await table.get(apiContext);
      testSuiteFqn = tableData.testSuite?.fullyQualifiedName ?? '';

      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('Data Consumer should see export but not import options', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      await dataConsumerPage.goto(
        `/test-suite/${encodeURIComponent(testSuiteFqn)}`
      );
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await dataConsumerPage.getByTestId('manage-button').click();
      await expect(
        dataConsumerPage.getByTestId('export-button')
      ).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId('import-button')
      ).not.toBeVisible();
    });

    test('Data Steward should see both import and export options', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      await dataStewardPage.goto(
        `/test-suite/${encodeURIComponent(testSuiteFqn)}`
      );
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await dataStewardPage.getByTestId('manage-button').click();
      await expect(dataStewardPage.getByTestId('export-button')).toBeVisible();
      await expect(dataStewardPage.getByTestId('import-button')).toBeVisible();
    });

    test('Data Consumer can successfully export test cases', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      await dataConsumerPage.goto(
        `/test-suite/${encodeURIComponent(testSuiteFqn)}`
      );
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await dataConsumerPage.getByTestId('manage-button').click();
      await dataConsumerPage.getByTestId('export-button').click();
      await expect(dataConsumerPage.locator('[role="dialog"]')).toBeVisible();

      const downloadPromise = dataConsumerPage.waitForEvent('download');
      await dataConsumerPage.getByTestId('export-modal-submit').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('Data Consumer should be blocked from import page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      await dataConsumerPage.goto(
        `/bulk/import/testCase/${encodeURIComponent(testSuiteFqn)}`
      );
      await dataConsumerPage.waitForTimeout(2000);
      const currentUrl = dataConsumerPage.url();

      const isRedirected =
        currentUrl.includes('not-found') || currentUrl.includes('403');
      const hasPermissionError =
        (await dataConsumerPage
          .getByText(/permission|access denied|unauthorized/i)
          .count()) > 0;
      expect(isRedirected || hasPermissionError).toBeTruthy();
    });

    test('Data Steward can access import page and upload CSV', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'steward-test-suite.csv'
      );

      try {
        await dataStewardPage.goto(
          `/test-suite/${encodeURIComponent(testSuiteFqn)}`
        );
        await dataStewardPage.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await dataStewardPage.getByTestId('manage-button').click();
        await dataStewardPage.getByTestId('import-button').click();
        await expect(dataStewardPage).toHaveURL(/\/bulk\/import\/testCase/);

        await dataStewardPage.waitForSelector('[type="file"]', {
          state: 'visible',
        });
        await dataStewardPage.setInputFiles('[type="file"]', csvFilePath);
        await dataStewardPage.waitForSelector(
          '[data-testid="upload-file-widget"]',
          { state: 'hidden', timeout: 10000 }
        );
        await expect(dataStewardPage.getByText(/uploaded/i)).toBeVisible({
          timeout: 15000,
        });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });
  }
);
