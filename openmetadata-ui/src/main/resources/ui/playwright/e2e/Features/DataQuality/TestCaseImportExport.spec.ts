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
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { validateImportStatus } from '../../../utils/importUtils';
import {
  cancelBulkEditAndVerifyRedirect,
  clickManageButton,
  navigateToBulkEditPage,
  navigateToGlobalDataQuality,
  navigateToImportPage,
  performTestCaseExport,
  uploadCSVFile,
  validateImportGrid,
  verifyButtonVisibility,
  verifyPageAccessDenied,
  visitDataQualityTab,
  waitForImportAsyncResponse
} from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

// CSV test data as constants
const VALID_TEST_CASES_CSV = `name*,displayName,description,testDefinition*,entityFQN*,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms
column_value_max_to_be_between,Column value max to be between,test the value of a column is between x and y,columnValueMaxToBeBetween,sample_data.ecommerce_db.shopify.dim_address.shop_id,sample_data.ecommerce_db.shopify.dim_address.testSuite,"{""name"":""minValueForMaxInCol"",""value"":""50""};{""name"":""maxValueForMaxInCol"",""value"":""100""}",false,false,,,
column_values_to_be_between,,test the number of column in table is between x and y,columnValuesToBeBetween,sample_data.ecommerce_db.shopify.dim_address.zip,sample_data.ecommerce_db.shopify.dim_address.testSuite,,false,true,,,
table_column_count_equals,,test the number of column in table,tableColumnCountToEqual,sample_data.ecommerce_db.shopify.dim_address,sample_data.ecommerce_db.shopify.dim_address.testSuite,"{""name"":""columnCount"",""value"":""10""}",false,false,,,`;

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
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should export test cases from Data Quality tab', async ({ page }) => {
      await redirectToHomePage(page);

      // Navigate to Data Quality tab
      await visitDataQualityTab(page, table);

      await clickManageButton(page, 'table');
      const download = await performTestCaseExport(page);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('should navigate to import page from Data Quality tab', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      // Navigate to Data Quality tab
      await visitDataQualityTab(page, table);

      await clickManageButton(page, 'table');
      await navigateToImportPage(page);
    });

    test('should export all test cases from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      const download = await performTestCaseExport(page);
      expect(download.suggestedFilename()).toMatch(/.*\.csv/i);
    });

    test('should navigate to import page from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      await navigateToImportPage(page, /\/bulk\/import\/testCase\/\*/);
    });

    test('should upload and validate CSV file', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'valid-test-cases.csv'
      );

      try {
        // Navigate to Data Quality tab
        await visitDataQualityTab(page, table);

        await clickManageButton(page, 'table');
        await navigateToImportPage(page);
        await uploadCSVFile(page, csvFilePath);
        await validateImportGrid(page);
        await waitForImportAsyncResponse(page);

        await validateImportStatus(page, {
          passed: '4',
          processed: '4',
          failed: '0',
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
        // Navigate to Data Quality tab
        await visitDataQualityTab(page, table);

        await page
          .getByTestId('table-profiler-container')
          .getByTestId('manage-button')
          .click();

        await page.getByTestId('import-button').click();
        await expect(page).toHaveURL(/\/bulk\/import\/testCase/);

        await page.waitForSelector('[type="file"]', { state: 'attached' });
        await page.setInputFiles('[type="file"]', csvFilePath);
        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden',
          timeout: 10000,
        });
        await expect(
          page.getByText(/INVALID_HEADER/i).first()
        ).toBeVisible({ timeout: 15000 });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });
  }
);

test.describe(
  'Test Case Import/Export/Edits - Permissions',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('Data Consumer should see export but not import & edit options', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      // Navigate to Data Quality tab
      await visitDataQualityTab(dataConsumerPage, table);

      await clickManageButton(dataConsumerPage, 'table');
      await verifyButtonVisibility(dataConsumerPage, {
        export: true,
        import: false,
        bulkEdit: false,
      });
      await dataConsumerPage.keyboard.press('Escape');

      await navigateToGlobalDataQuality(dataConsumerPage);
      await clickManageButton(dataConsumerPage, 'global');
      await verifyButtonVisibility(dataConsumerPage, {
        export: true,
        import: false,
        bulkEdit: false,
      });
    });

    test('Data Steward should see export but not import & edit options', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      // Navigate to Data Quality tab
      await visitDataQualityTab(dataStewardPage, table);

      await clickManageButton(dataStewardPage, 'table');
      await verifyButtonVisibility(dataStewardPage, {
        export: true,
        import: false,
        bulkEdit: false,
      });
      await dataStewardPage.keyboard.press('Escape');

      await navigateToGlobalDataQuality(dataStewardPage);
      await clickManageButton(dataStewardPage, 'global');
      await verifyButtonVisibility(dataStewardPage, {
        export: true,
        import: false,
        bulkEdit: false,
      });
    });

    test('Data Consumer can successfully export test cases', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      // Navigate to Data Quality tab
      await visitDataQualityTab(dataConsumerPage, table);

      await clickManageButton(dataConsumerPage, 'table');
      const download = await performTestCaseExport(dataConsumerPage);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('Data Steward can successfully export test cases', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      // Navigate to Data Quality tab
      await visitDataQualityTab(dataStewardPage, table);

      await clickManageButton(dataStewardPage, 'table');
      const download = await performTestCaseExport(dataStewardPage);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('Data Consumer should be blocked from import page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      const url = `/bulk/import/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccessDenied(dataConsumerPage, url);
    });

    test('Data Steward should be blocked from import page', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      const url = `/bulk/import/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccessDenied(dataStewardPage, url);
    });

    test('Data Consumer should be blocked from bulk edit page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      const url = `/bulk/edit/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccessDenied(dataConsumerPage, url);
    });

    test('Data Steward should be blocked from bulk edit page', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      const encodedFqn = encodeURIComponent(
        table.entityResponseData.fullyQualifiedName
      );
      const url = `/bulk/edit/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccessDenied(dataStewardPage, url);
    });

  }
);

test.describe(
  'Test Case Bulk Edit - Cancel Redirect',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    base.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await afterAction();
    });

    base.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should redirect to Data Quality page when canceling global bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      await navigateToBulkEditPage(page);
      await cancelBulkEditAndVerifyRedirect(page, '/data-quality/test-cases');
    });

    test('should redirect to Table Data Quality tab when canceling table-level bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await visitDataQualityTab(page, table);
      await clickManageButton(page, 'table');
      await navigateToBulkEditPage(page);
      await cancelBulkEditAndVerifyRedirect(page, '/profiler');
      expect(page.url()).toContain(table.entity.name);
    });
  }
);
