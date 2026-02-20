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
import { expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DOMAIN_TAGS, PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
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
  verifyPageAccess,
  visitDataQualityTab,
  waitForImportAsyncResponse,
} from '../../../utils/testCases';
import { test as base } from '../../fixtures/pages';

// CSV test data as constants
const VALID_TEST_CASES_CSV = `name*,displayName,description,testDefinition*,entityFQN*,testSuite,parameterValues,computePassedFailedRowCount,useDynamicAssertion,inspectionQuery,tags,glossaryTerms
column_value_max_to_be_between,Column value max to be between,test the value of a column is between x and y,columnValueMaxToBeBetween,sample_data.ecommerce_db.shopify.dim_address.shop_id,sample_data.ecommerce_db.shopify.dim_address.testSuite,"{""name"":""minValueForMaxInCol"",""value"":""50""};{""name"":""maxValueForMaxInCol"",""value"":""100""}",false,false,,,
column_values_to_be_between,,test the number of column in table is between x and y,columnValuesToBeBetween,sample_data.ecommerce_db.shopify.dim_address.zip,sample_data.ecommerce_db.shopify.dim_address.testSuite,,false,true,,,
table_column_count_equals,,test the number of column in table,tableColumnCountToEqual,sample_data.ecommerce_db.shopify.dim_address,sample_data.ecommerce_db.shopify.dim_address.testSuite,"{""name"":""columnCount"",""value"":""10""}",false,false,,,`;

const INVALID_TEST_CASES_CSV = `name,displayName,testDefinition
incomplete_test,Incomplete Test,columnValuesToBeNotNull`;

const TEST_CASE_EDIT_RULES = [
  {
    name: `test-case-edit-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewAll', 'ViewBasic', 'EditAll'],
    effect: 'allow',
  },
  {
    name: `test-case-edit-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

const testCaseEditPolicy = new PolicyClass();
const testCaseEditRole = new RolesClass();
const testCaseEditUser = new UserClass();

const test = base.extend<{
  testCaseEditPage: Page;
}>({
  testCaseEditPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await testCaseEditUser.login(page);
    await use(page);
    await page.close();
  },
});

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

// Helper function to get FQN with error check
const getFqn = (table: TableClass): string => {
  const fqn = table.entityResponseData.fullyQualifiedName;
  if (!fqn) {
    throw new Error(
      `Table fullyQualifiedName is missing for ${table.entity.name}`
    );
  }

  return fqn;
};

test.describe(
  'Test Case Bulk Import/Export - Admin User',
  { tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`, PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ.tag] },
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * Verify that test cases can be exported from the Data Quality tab on the Table details page.
     * The export should trigger a download of a CSV file.
     */
    test('should export test cases from Data Quality tab', async ({ page }) => {
      await redirectToHomePage(page);

      // Navigate to Data Quality tab
      await visitDataQualityTab(page, table);

      await clickManageButton(page, 'table');
      const download = await performTestCaseExport(page);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    /**
     * @description Test Case Description:
     * Verify navigation to the Import page from the Data Quality tab on the Table details page.
     */
    test('should navigate to import page from Data Quality tab', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      // Navigate to Data Quality tab
      await visitDataQualityTab(page, table);

      await clickManageButton(page, 'table');
      await navigateToImportPage(page);
    });

    /**
     * @description Test Case Description:
     * Verify that all test cases can be exported from the Global Data Quality page.
     * The export should trigger a download of a CSV file.
     */
    test('should export all test cases from global data quality page', async ({
      page,
    }) => {
      if (!process.env.PLAYWRIGHT_IS_OSS) {
        test.slow();
      }

      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      const download = await performTestCaseExport(page);
      expect(download.suggestedFilename()).toMatch(/.*\.csv/i);
    });

    /**
     * @description Test Case Description:
     * Verify navigation to the Import page from the Global Data Quality page.
     */
    test('should navigate to import page from global data quality page', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      await navigateToImportPage(page, /\/bulk\/import\/testCase\/\*/);
    });

    /**
     * @description Test Case Description:
     * Verify that a valid CSV file can be uploaded and validated successfully.
     * 1. Create a temporary valid CSV file
     * 2. Upload the file
     * 3. Validate the grid and import status
     */
    test('should upload and validate CSV file', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        VALID_TEST_CASES_CSV,
        'valid-test-cases.csv'
      );

      try {
        await test.step('Navigate to Import Page', async () => {
          // Navigate to Data Quality tab
          await visitDataQualityTab(page, table);
          await clickManageButton(page, 'table');
          await navigateToImportPage(page);
        });

        await test.step('Upload CSV and Validate Grid', async () => {
          await uploadCSVFile(page, csvFilePath);
          await validateImportGrid(page);
        });

        await test.step('Verify Import Status', async () => {
          await waitForImportAsyncResponse(page);
          await validateImportStatus(page, {
            passed: '4',
            processed: '4',
            failed: '0',
          });
        });
      } finally {
        cleanupTempFile(csvFilePath);
      }
    });

    /**
     * @description Test Case Description:
     * Verify that an invalid CSV file triggers appropriate validation errors.
     * 1. Create a temporary invalid CSV file (e.g. missing headers)
     * 2. Upload the file
     * 3. Verify error messages are displayed
     */
    test('should show validation errors for invalid CSV', async ({ page }) => {
      await redirectToHomePage(page);
      const csvFilePath = createTempCSVFile(
        INVALID_TEST_CASES_CSV,
        'invalid-test-cases.csv'
      );

      try {
        await test.step('Navigate to Import Page', async () => {
          // Navigate to Data Quality tab
          await visitDataQualityTab(page, table);

          await page
            .getByTestId('table-profiler-container')
            .getByTestId('manage-button')
            .click();

          await page.getByTestId('import-button').click();
          await expect(page).toHaveURL(/\/bulk\/import\/testCase/);
        });

        await test.step('Upload Invalid CSV and Verify Errors', async () => {
          await page.waitForSelector('[type="file"]', { state: 'attached' });
          await page.setInputFiles('[type="file"]', csvFilePath);
          await page.waitForSelector('[data-testid="upload-file-widget"]', {
            state: 'hidden',
            timeout: 10000,
          });
          await expect(page.getByText(/INVALID_HEADER/i).first()).toBeVisible({
            timeout: 15000,
          });
        });
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

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      // Create user with editAll for testCase as role
      await testCaseEditUser.create(apiContext, false);
      const viewOnlyPolicyResponse = await testCaseEditPolicy.create(
        apiContext,
        TEST_CASE_EDIT_RULES
      );
      const viewOnlyRoleResponse = await testCaseEditRole.create(apiContext, [
        viewOnlyPolicyResponse.fullyQualifiedName,
      ]);
      await testCaseEditUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: viewOnlyRoleResponse.id,
              type: 'role',
              name: viewOnlyRoleResponse.name,
            },
          },
        ],
      });
      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await testCaseEditUser.delete(apiContext);
      await testCaseEditRole.delete(apiContext);
      await testCaseEditPolicy.delete(apiContext);
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * Verify that Data Consumer role has restricted access.
     * Should only see Export option, but not Import or Bulk Edit.
     */
    test('Data Consumer should see export but not import & edit options', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      await test.step('Verify Table Level Access', async () => {
        // Navigate to Data Quality tab
        await visitDataQualityTab(dataConsumerPage, table);

        await clickManageButton(dataConsumerPage, 'table');
        await verifyButtonVisibility(dataConsumerPage, {
          export: true,
          import: false,
          bulkEdit: false,
        });
        await dataConsumerPage.keyboard.press('Escape');
      });

      await test.step('Verify Global Level Access', async () => {
        await navigateToGlobalDataQuality(dataConsumerPage);
        await clickManageButton(dataConsumerPage, 'global');
        await verifyButtonVisibility(dataConsumerPage, {
          export: true,
          import: false,
          bulkEdit: false,
        });
      });
    });

    /**
     * @description Test Case Description:
     * Verify that Data Consumer can successfully export test cases.
     */
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

    /**
     * @description Test Case Description:
     * Verify that Data Consumer is blocked from accessing the Import page directly via URL.
     */
    test('Data Consumer should be blocked from import page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/import/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(dataConsumerPage, url, false);
    });

    /**
     * @description Test Case Description:
     * Verify that Data Consumer is blocked from accessing the Bulk Edit page directly via URL.
     */
    test('Data Consumer should be blocked from bulk edit page', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/edit/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(dataConsumerPage, url, false);
    });

    /**
     * @description Test Case Description:
     * Verify that Data Steward role has restricted access.
     * Should only see Export option, but not Import or Bulk Edit.
     */
    test('Data Steward should see export but not import & edit options', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      await test.step('Verify Table Level Access', async () => {
        // Navigate to Data Quality tab
        await visitDataQualityTab(dataStewardPage, table);

        await clickManageButton(dataStewardPage, 'table');
        await verifyButtonVisibility(dataStewardPage, {
          export: true,
          import: false,
          bulkEdit: false,
        });
        await dataStewardPage.keyboard.press('Escape');
      });

      await test.step('Verify Global Level Access', async () => {
        await navigateToGlobalDataQuality(dataStewardPage);
        await clickManageButton(dataStewardPage, 'global');
        await verifyButtonVisibility(dataStewardPage, {
          export: true,
          import: false,
          bulkEdit: false,
        });
      });
    });

    /**
     * @description Test Case Description:
     * Verify that Data Steward can successfully export test cases.
     */
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

    /**
     * @description Test Case Description:
     * Verify that Data Steward is blocked from accessing the Import page directly via URL.
     */
    test('Data Steward should be blocked from import page', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/import/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(dataStewardPage, url, false);
    });

    /**
     * @description Test Case Description:
     * Verify that Data Steward is blocked from accessing the Bulk Edit page directly via URL.
     */
    test('Data Steward should be blocked from bulk edit page', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/edit/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(dataStewardPage, url, false);
    });

    /**
     * @description Test Case Description:
     * Verify that a User with specific EditAll and ViewAll permissions on TestCase resource
     * can see all options: Export, Import, and Bulk Edit.
     */
    test('User with EditAll & ViewAll on TEST_CASE resource should see import, export & edit options', async ({
      testCaseEditPage,
    }) => {
      await redirectToHomePage(testCaseEditPage);

      await test.step('Verify Table Level Access', async () => {
        // Navigate to Data Quality tab
        await visitDataQualityTab(testCaseEditPage, table);

        await clickManageButton(testCaseEditPage, 'table');
        await verifyButtonVisibility(testCaseEditPage, {
          export: true,
          import: true,
          bulkEdit: true,
        });
        await testCaseEditPage.keyboard.press('Escape');
      });

      await test.step('Verify Global Level Access', async () => {
        await navigateToGlobalDataQuality(testCaseEditPage);
        await clickManageButton(testCaseEditPage, 'global');
        await verifyButtonVisibility(testCaseEditPage, {
          export: true,
          import: true,
          bulkEdit: true,
        });
      });
    });

    /**
     * @description Test Case Description:
     * Verify that a User with ViewAll on TEST_CASE resource can successfully export test cases.
     */
    test('User with ViewAll on TEST_CASE resource can successfully export test cases', async ({
      testCaseEditPage,
    }) => {
      await redirectToHomePage(testCaseEditPage);

      // Navigate to Data Quality tab
      await visitDataQualityTab(testCaseEditPage, table);

      await clickManageButton(testCaseEditPage, 'table');
      const download = await performTestCaseExport(testCaseEditPage);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    /**
     * @description Test Case Description:
     * Verify that a User with EditAll on TEST_CASE resource is ALLOWED to access the Import page.
     */
    test('User with EditAll on TEST_CASE resource should not be blocked from import page', async ({
      testCaseEditPage,
    }) => {
      await redirectToHomePage(testCaseEditPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/import/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(testCaseEditPage, url, true);
    });

    /**
     * @description Test Case Description:
     * Verify that a User with EditAll on TEST_CASE resource is ALLOWED from the Bulk Edit page.
     * (Bulk Edit requires specific bulk edit permissions or higher level access, not just EditAll on resource)
     */
    test('User with EditAll on TEST_CASE resource should not be blocked from bulk edit page', async ({
      testCaseEditPage,
    }) => {
      await redirectToHomePage(testCaseEditPage);

      const encodedFqn = encodeURIComponent(getFqn(table));
      const url = `/bulk/edit/testCase/${encodedFqn}?sourceEntityType=table`;
      await verifyPageAccess(testCaseEditPage, url, true);
    });
  }
);

test.describe(
  'Test Case Bulk Edit - Cancel Redirect',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const table = new TableClass();

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * Verify that canceling a global bulk edit action redirects the user back to the global Data Quality page.
     */
    test('should redirect to Data Quality page when canceling global bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToGlobalDataQuality(page);
      await clickManageButton(page, 'global');
      await navigateToBulkEditPage(page);
      await cancelBulkEditAndVerifyRedirect(page, '/data-quality/test-cases');
    });

    /**
     * @description Test Case Description:
     * Verify that canceling a table-level bulk edit action redirects the user back to the Table's Data Quality tab.
     */
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

test.describe(
  'Logical Test Suite - Bulk Import/Export/Edit Operations',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    const testSuiteName = `pw-logical-suite-${uuid()}`;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Create logical test suite via API
      await apiContext.post('/api/v1/dataQuality/testSuites', {
        data: {
          name: testSuiteName,
          description: 'Playwright logical test suite for bulk operations',
        },
      });

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      // Delete logical test suite
      await apiContext.delete(
        `/api/v1/dataQuality/testSuites/name/${testSuiteName}?hardDelete=true&recursive=true`
      );
      await afterAction();
    });

    /**
     * @description Test Case Description:
     * Verify that test cases can be exported from a Logical Test Suite details page.
     */
    test('should export test cases from Logical Test Suite page', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const testCaseListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.goto(`/test-suites/${testSuiteName}`);
      await testCaseListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await clickManageButton(page, 'testSuite');
      const download = await performTestCaseExport(page);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    /**
     * @description Test Case Description:
     * Verify navigation to Import page from Logical Test Suite details page.
     */
    test('should navigate to import page from Logical Test Suite page', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const testCaseListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.goto(`/test-suites/${testSuiteName}`);
      await testCaseListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await clickManageButton(page, 'testSuite');
      await navigateToImportPage(page, /\/bulk\/import\/testCase/);
    });

    /**
     * @description Test Case Description:
     * Verify navigation to Bulk Edit page from Logical Test Suite details page.
     */
    test('should navigate to bulk edit page from Logical Test Suite page', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const testCaseListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.goto(`/test-suites/${testSuiteName}`);
      await testCaseListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await clickManageButton(page, 'testSuite');
      await navigateToBulkEditPage(page);

      // Verify we're on the bulk edit page
      expect(page.url()).toContain('/bulk/edit/testCase');
    });

    /**
     * @description Test Case Description:
     * Verify that canceling bulk edit from Logical Test Suite redirects back to Test Suite page.
     */
    test('should redirect to Test Suite page when canceling bulk edit', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      const testCaseListResponse = page.waitForResponse(
        '/api/v1/dataQuality/testCases/search/list*'
      );
      await page.goto(`/test-suites/${testSuiteName}`);
      await testCaseListResponse;
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await clickManageButton(page, 'testSuite');
      await navigateToBulkEditPage(page);
      await cancelBulkEditAndVerifyRedirect(page, '/test-suites');
      expect(page.url()).toContain(testSuiteName);
    });
  }
);
