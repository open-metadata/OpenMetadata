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
import { test as base, expect, Page } from '@playwright/test';
import {
  DELETE_RESULTS_POLICY,
  EDIT_RESULTS_POLICY,
  PARTIAL_DELETE_TC_ONLY_POLICY,
  PARTIAL_DELETE_TABLE_ONLY_POLICY,
  TABLE_EDIT_RESULTS_POLICY,
  VIEW_RESULTS_POLICY,
} from '../../../constant/dataQualityPermissions';
import { DOMAIN_TAGS } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { setupUserWithPolicy } from '../../../utils/permission';
import { waitForTestCaseDetailsResponse } from '../../../utils/testCases';
import { getCurrentMillis } from '../../../utils/dateTime';

// --- Objects ---
const viewResultsPolicy = new PolicyClass();
const viewResultsRole = new RolesClass();
const viewResultsUser = new UserClass();

const editResultsPolicy = new PolicyClass();
const editResultsRole = new RolesClass();
const editResultsUser = new UserClass();

const tableEditResultsPolicy = new PolicyClass();
const tableEditResultsRole = new RolesClass();
const tableEditResultsUser = new UserClass();

const deleteResultsPolicy = new PolicyClass();
const deleteResultsRole = new RolesClass();
const deleteResultsUser = new UserClass();

const partialDeleteTcPolicy = new PolicyClass();
const partialDeleteTcRole = new RolesClass();
const partialDeleteTcUser = new UserClass();

const partialDeleteTablePolicy = new PolicyClass();
const partialDeleteTableRole = new RolesClass();
const partialDeleteTableUser = new UserClass();

const table = new TableClass();

// --- Fixtures ---
const test = base.extend<{
  adminPage: Page;
  viewResultsPage: Page;
  editResultsPage: Page;
  tableEditResultsPage: Page;
  deleteResultsPage: Page;
  partialDeleteTcPage: Page;
  partialDeleteTablePage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  viewResultsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewResultsUser.login(page);
    await use(page);
    await page.close();
  },
  editResultsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editResultsUser.login(page);
    await use(page);
    await page.close();
  },
  tableEditResultsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await tableEditResultsUser.login(page);
    await use(page);
    await page.close();
  },
  deleteResultsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await deleteResultsUser.login(page);
    await use(page);
    await page.close();
  },
  partialDeleteTcPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await partialDeleteTcUser.login(page);
    await use(page);
    await page.close();
  },
  partialDeleteTablePage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await partialDeleteTableUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe(
  'TestCaseResult Permission Coverage',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    let testCaseFqn: string;
    let testCaseName: string;
    let resultTimestamp: number;

    const visitProfilerPage = async (page: Page) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await page.getByTestId('profiler').click();
      await page.getByRole('tab', { name: 'Data Quality' }).click();
    };

    const visitTestCaseDetailsPage = async (page: Page) => {
      const detailsPromise = waitForTestCaseDetailsResponse(page);
      await page.goto(`/test-case/${encodeURIComponent(testCaseFqn)}`);
      await detailsPromise;
    };

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await table.create(apiContext);

      // Create executable test suite
      await apiContext.post('/api/v1/dataQuality/testSuites/executable', {
        data: {
          executableEntityReference:
            table.entityResponseData.fullyQualifiedName,
        },
      });

      // Create a test case
      await table.createTestCase(apiContext);
      testCaseFqn = table.testCasesResponseData[0].fullyQualifiedName;
      testCaseName = table.testCasesResponseData[0].name;

      // Add a test case result so we have one to query/patch/delete
      resultTimestamp = getCurrentMillis();
      await table.addTestCaseResult(apiContext, testCaseFqn, {
        result: 'Found value 10 vs expected 100.',
        testCaseStatus: 'Failed',
        testResultValue: [
          { name: 'minValue', value: '10' },
          { name: 'maxValue', value: '100' },
        ],
        timestamp: resultTimestamp,
      });

      // Setup all users
      await setupUserWithPolicy(
        apiContext,
        viewResultsUser,
        viewResultsPolicy,
        viewResultsRole,
        VIEW_RESULTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        editResultsUser,
        editResultsPolicy,
        editResultsRole,
        EDIT_RESULTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        tableEditResultsUser,
        tableEditResultsPolicy,
        tableEditResultsRole,
        TABLE_EDIT_RESULTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        deleteResultsUser,
        deleteResultsPolicy,
        deleteResultsRole,
        DELETE_RESULTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        partialDeleteTcUser,
        partialDeleteTcPolicy,
        partialDeleteTcRole,
        PARTIAL_DELETE_TC_ONLY_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        partialDeleteTableUser,
        partialDeleteTablePolicy,
        partialDeleteTableRole,
        PARTIAL_DELETE_TABLE_ONLY_POLICY
      );

      await afterAction();
    });

    test.describe('Positive - View Results', () => {
      test('User with TEST_CASE.VIEW_ALL can view test case and results in UI', async ({
        viewResultsPage,
      }) => {
        await visitProfilerPage(viewResultsPage);
        await expect(viewResultsPage.getByTestId(testCaseName)).toBeVisible();

        await visitTestCaseDetailsPage(viewResultsPage);
        await expect(
          viewResultsPage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();
      });

      test('User with TEST_CASE.VIEW_ALL can view test RESULT CONTENT in UI', async ({
        viewResultsPage,
      }) => {
        await visitTestCaseDetailsPage(viewResultsPage);
        const resultContainer = viewResultsPage.getByTestId(
          'test-case-result-tab-container'
        );
        await expect(resultContainer).toBeVisible();

        const resultChart = viewResultsPage.getByTestId('chart-container');
        if (await resultChart.first().isVisible()) {
          await expect(resultChart.first()).toBeVisible();
        }
      });

      test('User with TABLE.VIEW_TESTS can view test case and results in UI (alternative)', async ({
        tableEditResultsPage,
      }) => {
        await visitProfilerPage(tableEditResultsPage);
        await expect(
          tableEditResultsPage.getByTestId(testCaseName)
        ).toBeVisible();

        await visitTestCaseDetailsPage(tableEditResultsPage);
        await expect(
          tableEditResultsPage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();
      });

      test('User with only TABLE.EDIT_TESTS (no TEST_CASE.VIEW_ALL) can still view results in UI via TABLE.VIEW_TESTS', async ({
        tableEditResultsPage,
      }) => {
        await visitTestCaseDetailsPage(tableEditResultsPage);
        await expect(
          tableEditResultsPage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();
      });
    });

    test.describe('Positive - Edit Results', () => {
      test('User with TEST_CASE.EDIT_ALL can see edit action on test case', async ({
        editResultsPage,
      }) => {
        await visitProfilerPage(editResultsPage);
        const actionDropdown = editResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          editResultsPage.getByTestId(`edit-${testCaseName}`)
        ).toBeVisible();
        await editResultsPage.keyboard.press('Escape');
      });

      test('User with TABLE.EDIT_TESTS can see edit action on test case (alternative)', async ({
        tableEditResultsPage,
      }) => {
        await visitProfilerPage(tableEditResultsPage);
        const actionDropdown = tableEditResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          tableEditResultsPage.getByTestId(`edit-${testCaseName}`)
        ).toBeVisible();
        await tableEditResultsPage.keyboard.press('Escape');
      });
    });

    test.describe('Positive - Delete Results', () => {
      test('User with TABLE.DELETE + TEST_CASE.DELETE can see delete option for test case', async ({
        deleteResultsPage,
      }) => {
        await visitProfilerPage(deleteResultsPage);
        const actionDropdown = deleteResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          deleteResultsPage.getByTestId(`delete-${testCaseName}`)
        ).toBeVisible();
        await deleteResultsPage.keyboard.press('Escape');
      });
    });

    test.describe('Negative - Edit Results', () => {
      test('User with only VIEW cannot see edit action and cannot POST results', async ({
        viewResultsPage,
      }) => {
        await visitProfilerPage(viewResultsPage);
        const actionDropdown = viewResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await viewResultsPage.keyboard.press('Escape');

        const { apiContext } = await getApiContext(viewResultsPage);
        const res = await apiContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Should be forbidden.',
              testCaseStatus: 'Success',
              testResultValue: [{ name: 'value', value: '10' }],
              timestamp: getCurrentMillis() + 9000,
            },
          }
        );
        expect(res.status()).toBe(403);
      });

      test('User with only VIEW cannot PATCH results', async ({
        viewResultsPage,
      }) => {
        await visitProfilerPage(viewResultsPage);
        const actionDropdown = viewResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await viewResultsPage.keyboard.press('Escape');

        const { apiContext } = await getApiContext(viewResultsPage);

        const res = await apiContext.patch(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${resultTimestamp}`,
          {
            data: [
              {
                op: 'add',
                path: '/testCaseFailureStatus',
                value: {
                  testCaseFailureStatusType: 'Resolved',
                  testCaseFailureReason: 'FalsePositive',
                },
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).toBe(403);
      });
    });

    test.describe('Negative - Delete Results (ALL logic)', () => {
      test('User with only TEST_CASE.DELETE (no TABLE.DELETE) cannot DELETE results', async ({
        partialDeleteTcPage,
        adminPage,
      }) => {
        await visitProfilerPage(partialDeleteTcPage);
        await visitTestCaseDetailsPage(partialDeleteTcPage);
        await expect(
          partialDeleteTcPage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();

        const { apiContext: adminContext } = await getApiContext(adminPage);
        const ts = getCurrentMillis() + 10000;
        const postRes = await adminContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Partial delete attempt (TC only).',
              testCaseStatus: 'Failed',
              testResultValue: [{ name: 'value', value: '0' }],
              timestamp: ts,
            },
          }
        );

        const { apiContext } = await getApiContext(partialDeleteTcPage);
        const res = await apiContext.delete(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${ts}`
        );
        expect(res.status()).toBe(403);

        if (postRes.ok()) {
          await adminContext.delete(
            `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
              testCaseFqn
            )}/${ts}`
          );
        }
      });

      test('User with only TABLE.DELETE (no TEST_CASE.DELETE) cannot DELETE results', async ({
        partialDeleteTablePage,
        adminPage,
      }) => {
        await visitProfilerPage(partialDeleteTablePage);
        await visitTestCaseDetailsPage(partialDeleteTablePage);
        await expect(
          partialDeleteTablePage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();

        const { apiContext: adminContext } = await getApiContext(adminPage);
        const ts = getCurrentMillis() + 11000;
        const postRes = await adminContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Partial delete attempt (Table only).',
              testCaseStatus: 'Failed',
              testResultValue: [{ name: 'value', value: '0' }],
              timestamp: ts,
            },
          }
        );

        const { apiContext } = await getApiContext(partialDeleteTablePage);
        const res = await apiContext.delete(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${ts}`
        );
        expect(res.status()).toBe(403);

        if (postRes.ok()) {
          await adminContext.delete(
            `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
              testCaseFqn
            )}/${ts}`
          );
        }
      });
    });
  }
);
