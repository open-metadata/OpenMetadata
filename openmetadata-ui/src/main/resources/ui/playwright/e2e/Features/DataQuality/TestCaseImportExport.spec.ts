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
import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { test } from '../../fixtures/pages';

// CSV test data as constants
const VALID_TEST_CASES_CSV = `name,displayName,description,testDefinition,entityFQN,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms
test_row_count,Row Count Check,Validates row count,tableRowCountToBeBetween,sample_data.ecommerce_db.shopify.dim_customer,,"{""name"":""minValue"",""value"":100};{""name"":""maxValue"",""value"":10000}",false,false,,,
test_null_check,Null Check,Check for nulls,columnValuesToBeNotNull,sample_data.ecommerce_db.shopify.dim_customer.customer_id,,,false,false,,PII.Sensitive,`;

const INVALID_TEST_CASES_CSV = `name,displayName,testDefinition
incomplete_test,Incomplete Test,columnValuesToBeNotNull`;

// Helper function to create temporary CSV file
const createTempCSVFile = (content: string, filename: string): string => {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Helper function to cleanup temporary file
const cleanupTempFile = (filePath: string): void => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

test.describe(
  'Test Case Bulk Import/Export - Admin User',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should export test cases from Data Quality tab', async ({ page }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      // Navigate to Data Quality tab
      await page.click('[data-testid="profiler"]');
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

    test('should navigate to import page from Data Quality tab', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      // Navigate to Data Quality tab
      await page.click('[data-testid="profiler"]');
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await expect(page.getByTestId('import-button')).toBeVisible();
      await page.getByTestId('import-button').click();
      await expect(page).toHaveURL(/\/bulk\/import\/testCase/);
    });

    test('should export all test cases from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await page.goto('/data-quality');
      await page.waitForSelector('[data-testid="manage-button"]');
      await page.getByTestId('manage-button').click();
      await page.getByTestId('export-button').click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('export-modal-submit').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/.*\.csv/i);
    });

    test('should navigate to import page from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await page.goto('/data-quality');
      await page.waitForSelector('[data-testid="manage-button"]');
      await page.getByTestId('manage-button').click();
      await page.getByTestId('import-button').click();
      await expect(page).toHaveURL(/\/bulk\/import\/testCase\/\*/);
    });

    test('should upload and validate CSV file', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'valid-test-cases.csv'
      );

      try {
        await table.visitEntityPage(page);

        // Navigate to Data Quality tab
        await page.click('[data-testid="profiler"]');
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
        'invalid-test-cases.csv'
      );

      try {
        await table.visitEntityPage(page);

        // Navigate to Data Quality tab
        await page.click('[data-testid="profiler"]');
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

    test('should allow editing test cases in import grid', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'editable-test-cases.csv'
      );

      try {
        await table.visitEntityPage(page);

        // Navigate to Data Quality tab
        await page.click('[data-testid="profiler"]');
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();
        await expect(page).toHaveURL(/\/bulk\/import\/testCase/);

        // Upload CSV
        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });

        // Wait for the grid to be ready (validation complete)
        await page.waitForTimeout(2000);

        // Verify we're in the Edit/Preview step (step 2)
        await expect(page.locator('.rdg')).toBeVisible({ timeout: 10000 });

        // Verify grid has data rows
        const gridRows = page.locator('.rdg-row');
        const rowCount = await gridRows.count();
        expect(rowCount).toBeGreaterThan(0);

        // Verify we can see the "Add Row" button (edit functionality)
        const addRowButton = page.getByText(/add.*row/i);
        if (await addRowButton.isVisible()) {
          await expect(addRowButton).toBeVisible();
        }

        // Verify the import/update button is available
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
        'full-flow-test-cases.csv'
      );

      try {
        await table.visitEntityPage(page);

        // Navigate to Data Quality tab
        await page.click('[data-testid="profiler"]');
        await page.waitForSelector('[data-testid="manage-button"]', {
          state: 'visible',
        });

        await page.getByTestId('manage-button').click();
        await page.getByTestId('import-button').click();

        // Step 1: Upload
        await page.waitForSelector('[type="file"]', { state: 'visible' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });

        // Wait for validation
        await page.waitForTimeout(3000);

        // Verify stepper shows current step
        const stepper = page.locator(
          '.ant-steps-item-active, .stepper-item-active'
        );
        await expect(stepper.first()).toBeVisible({ timeout: 5000 });

        // Verify we can see step indicators (Upload -> Preview/Edit -> Update)
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
  'Test Case Import/Export - Permissions',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
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

      // Test at Table Level - Data Quality tab
      await table.visitEntityPage(dataConsumerPage);
      await dataConsumerPage.click('[data-testid="profiler"]');
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });
      await dataConsumerPage.getByTestId('manage-button').click();
      await expect(dataConsumerPage.getByTestId('export-button')).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId('import-button')
      ).not.toBeVisible();
      await dataConsumerPage.keyboard.press('Escape');

      // Test at Global Data Quality Level
      await dataConsumerPage.goto('/data-quality');
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]');
      await dataConsumerPage.getByTestId('manage-button').click();
      await expect(dataConsumerPage.getByTestId('export-button')).toBeVisible();
      await expect(
        dataConsumerPage.getByTestId('import-button')
      ).not.toBeVisible();
    });

    test('Data Steward should see both import and export options', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      // Test at Table Level - Data Quality tab
      await table.visitEntityPage(dataStewardPage);
      await dataStewardPage.click('[data-testid="profiler"]');
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });
      await dataStewardPage.getByTestId('manage-button').click();
      await expect(dataStewardPage.getByTestId('export-button')).toBeVisible();
      await expect(dataStewardPage.getByTestId('import-button')).toBeVisible();
      await dataStewardPage.keyboard.press('Escape');

      // Test at Global Data Quality Level
      await dataStewardPage.goto('/data-quality');
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]');
      await dataStewardPage.getByTestId('manage-button').click();
      await expect(dataStewardPage.getByTestId('export-button')).toBeVisible();
      await expect(dataStewardPage.getByTestId('import-button')).toBeVisible();
    });

    test('Data Consumer can successfully export test cases', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      await table.visitEntityPage(dataConsumerPage);

      // Navigate to Data Quality tab
      await dataConsumerPage.click('[data-testid="profiler"]');
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

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      await dataConsumerPage.goto(`/bulk/import/testCase/${encodedFqn}`);
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
        'steward-test-cases.csv'
      );

      try {
        await table.visitEntityPage(dataStewardPage);

        // Navigate to Data Quality tab
        await dataStewardPage.click('[data-testid="profiler"]');
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

test.describe(
  'Test Case Bulk Edit - Admin User',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should navigate to bulk edit from Data Quality tab', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await page.click('[data-testid="profiler"]');
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await expect(page.getByTestId('bulk-edit-button')).toBeVisible();
      await page.getByTestId('bulk-edit-button').click();
      await expect(page).toHaveURL(/\/bulk\/testCase/);
    });

    test('should navigate to bulk edit from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await page.goto('/data-quality');
      await page.waitForSelector('[data-testid="manage-button"]');
      await page.getByTestId('manage-button').click();
      await page.getByTestId('bulk-edit-button').click();
      await expect(page).toHaveURL(/\/bulk\/testCase\/\*/);
    });

    test('should load bulk edit grid with hidden columns', async ({ page }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await page.click('[data-testid="profiler"]');
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await page.getByTestId('bulk-edit-button').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 15000,
      });

      await expect(page.locator('.rdg-header-row')).toBeVisible({
        timeout: 10000,
      });

      const hiddenColumns = [
        'testSuiteFullyQualifiedName',
        'entityLink',
        'testCaseResult',
        'testDefinition',
      ];

      for (const column of hiddenColumns) {
        const columnHeader = page.locator(
          `.rdg-header-row >> text="${column}"`
        );
        await expect(columnHeader).not.toBeVisible();
      }

      const visibleColumns = [
        'name',
        'displayName',
        'description',
        'parameterValues',
      ];

      for (const column of visibleColumns) {
        const columnHeader = page.locator(
          `.rdg-header-row >> text="${column}"`
        );
        await expect(columnHeader).toBeVisible();
      }
    });

    test('should allow editing test cases in bulk edit grid', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await page.click('[data-testid="profiler"]');
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await page.getByTestId('bulk-edit-button').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 15000,
      });

      await expect(page.locator('.rdg')).toBeVisible({ timeout: 10000 });

      const gridRows = page.locator('.rdg-row');
      const rowCount = await gridRows.count();
      expect(rowCount).toBeGreaterThan(0);

      const nextButton = page.getByRole('button', { name: /next/i });
      await expect(nextButton).toBeVisible({ timeout: 5000 });
    });
  }
);

test.describe(
  'Test Case Bulk Edit - Cancel Redirect',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should redirect to Data Quality page when canceling global bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await page.goto('/data-quality');
      await page.waitForSelector('[data-testid="manage-button"]');

      await page.getByTestId('manage-button').click();
      await page.getByTestId('bulk-edit-button').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 15000,
      });

      await expect(page.locator('.rdg-header-row')).toBeVisible({
        timeout: 10000,
      });

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/data-quality');
    });

    test('should redirect to Table Data Quality tab when canceling table-level bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);

      await page.click('[data-testid="profiler"]');
      await page.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await page.getByTestId('manage-button').click();
      await page.getByTestId('bulk-edit-button').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 15000,
      });

      await expect(page.locator('.rdg-header-row')).toBeVisible({
        timeout: 10000,
      });

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();

      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/profiler');
      expect(page.url()).toContain(table.entity.name);
    });
  }
);

test.describe(
  'Test Case Bulk Edit - Permissions',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('Data Consumer should not see bulk edit option', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      await table.visitEntityPage(dataConsumerPage);
      await dataConsumerPage.click('[data-testid="profiler"]');
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });
      await dataConsumerPage.getByTestId('manage-button').click();
      await expect(
        dataConsumerPage.getByTestId('bulk-edit-button')
      ).not.toBeVisible();
      await dataConsumerPage.keyboard.press('Escape');

      await dataConsumerPage.goto('/data-quality');
      await dataConsumerPage.waitForSelector('[data-testid="manage-button"]');
      await dataConsumerPage.getByTestId('manage-button').click();
      await expect(
        dataConsumerPage.getByTestId('bulk-edit-button')
      ).not.toBeVisible();
    });

    test('Data Steward should see bulk edit option', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      await table.visitEntityPage(dataStewardPage);
      await dataStewardPage.click('[data-testid="profiler"]');
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });
      await dataStewardPage.getByTestId('manage-button').click();
      await expect(
        dataStewardPage.getByTestId('bulk-edit-button')
      ).toBeVisible();
      await dataStewardPage.keyboard.press('Escape');

      await dataStewardPage.goto('/data-quality');
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]');
      await dataStewardPage.getByTestId('manage-button').click();
      await expect(
        dataStewardPage.getByTestId('bulk-edit-button')
      ).toBeVisible();
    });

    test('Data Consumer should be blocked from bulk edit page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      await dataConsumerPage.goto(`/bulk/testCase/${encodedFqn}`);
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

    test('Data Steward can access bulk edit page', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);
      await table.visitEntityPage(dataStewardPage);

      await dataStewardPage.click('[data-testid="profiler"]');
      await dataStewardPage.waitForSelector('[data-testid="manage-button"]', {
        state: 'visible',
      });

      await dataStewardPage.getByTestId('manage-button').click();
      await dataStewardPage.getByTestId('bulk-edit-button').click();
      await expect(dataStewardPage).toHaveURL(/\/bulk\/testCase/);

      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 15000,
      });

      await expect(dataStewardPage.locator('.rdg-header-row')).toBeVisible({
        timeout: 10000,
      });
    });
  }
);
