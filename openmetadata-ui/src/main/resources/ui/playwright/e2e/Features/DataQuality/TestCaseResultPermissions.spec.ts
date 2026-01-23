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
import { test as base, expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { getCurrentMillis } from '../../../utils/dateTime';

// --- Policies ---

// 1. View Results Policy (TEST_CASE.VIEW_ALL + TABLE.VIEW_TESTS)
const VIEW_RESULTS_POLICY = [
  {
    name: `view-results-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-results-table-${uuid()}`,
    resources: ['table'],
    operations: ['ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-results-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 2. Edit Results Policy (TEST_CASE.EDIT_ALL + TABLE.EDIT_TESTS)
const EDIT_RESULTS_POLICY = [
  {
    name: `edit-results-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['EditAll', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `edit-results-table-${uuid()}`,
    resources: ['table'],
    operations: ['EditTests', 'ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    name: `edit-results-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 3. Table Edit Results Only (TABLE.EDIT_TESTS, no testCase permissions beyond view)
const TABLE_EDIT_RESULTS_POLICY = [
  {
    name: `table-edit-results-${uuid()}`,
    resources: ['table'],
    operations: ['EditTests', 'ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    name: `table-edit-results-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 4. Delete Results Policy (both TEST_CASE.DELETE + TABLE.DELETE required - ALL logic)
const DELETE_RESULTS_POLICY = [
  {
    name: `delete-results-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['Delete', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `delete-results-table-${uuid()}`,
    resources: ['table'],
    operations: ['Delete', 'ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    name: `delete-results-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 5. Partial Delete - TEST_CASE.DELETE only (no TABLE.DELETE)
const PARTIAL_DELETE_TC_ONLY_POLICY = [
  {
    name: `partial-del-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['Delete', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `partial-del-tc-table-${uuid()}`,
    resources: ['table'],
    operations: ['ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    name: `partial-del-tc-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 6. Partial Delete - TABLE.DELETE only (no TEST_CASE.DELETE)
const PARTIAL_DELETE_TABLE_ONLY_POLICY = [
  {
    name: `partial-del-table-${uuid()}`,
    resources: ['table'],
    operations: ['Delete', 'ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    name: `partial-del-table-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

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

// Helper to create user with role
const setupUserWithPolicy = async (
  apiContext: Awaited<ReturnType<typeof getApiContext>>['apiContext'],
  user: UserClass,
  policy: PolicyClass,
  role: RolesClass,
  policyRules: Array<{
    name: string;
    resources: string[];
    operations: string[];
    effect: string;
  }>
) => {
  await user.create(apiContext, false);
  const pol = await policy.create(apiContext, policyRules);
  const rol = await role.create(apiContext, [pol.fullyQualifiedName]);
  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/roles/0',
        value: { id: rol.id, type: 'role', name: rol.name },
      },
    ],
  });
};

const cleanupUserWithPolicy = async (
  apiContext: Awaited<ReturnType<typeof getApiContext>>['apiContext'],
  user: UserClass,
  role: RolesClass,
  policy: PolicyClass
) => {
  await user.delete(apiContext);
  await role.delete(apiContext);
  await policy.delete(apiContext);
};

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
      await redirectToHomePage(page);
      await page.goto(`/test-case/${encodeURIComponent(testCaseFqn)}`);
      await page.waitForLoadState('networkidle');
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
      await table.addTestCaseResult(
        apiContext,
        testCaseFqn,
        {
          result: 'Found value 10 vs expected 100.',
          testCaseStatus: 'Failed',
          testResultValue: [
            { name: 'minValue', value: '10' },
            { name: 'maxValue', value: '100' },
          ],
          timestamp: resultTimestamp,
        }
      );

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

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await cleanupUserWithPolicy(
        apiContext,
        viewResultsUser,
        viewResultsRole,
        viewResultsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        editResultsUser,
        editResultsRole,
        editResultsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        tableEditResultsUser,
        tableEditResultsRole,
        tableEditResultsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        deleteResultsUser,
        deleteResultsRole,
        deleteResultsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        partialDeleteTcUser,
        partialDeleteTcRole,
        partialDeleteTcPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        partialDeleteTableUser,
        partialDeleteTableRole,
        partialDeleteTablePolicy
      );

      await table.delete(apiContext);
      await afterAction();
    });

    test.describe('Positive - View Results', () => {
      test('User with TEST_CASE.VIEW_ALL can view test case in UI and GET results by FQN', async ({
        viewResultsPage,
      }) => {
        // UI: Navigate to profiler page and verify test case is visible
        await visitProfilerPage(viewResultsPage);
        await expect(
          viewResultsPage.getByTestId(testCaseName)
        ).toBeVisible();

        // UI: Navigate to test case details to see results tab
        await visitTestCaseDetailsPage(viewResultsPage);
        await expect(
          viewResultsPage.getByTestId('test-case-result-tab-container')
        ).toBeVisible();

        // API: Verify GET results succeeds
        const { apiContext } = await getApiContext(viewResultsPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`
        );
        expect(res.status()).toBe(200);
      });

      test('User with TABLE.VIEW_TESTS can view test case and GET results by FQN (alternative)', async ({
        tableEditResultsPage,
      }) => {
        // UI: Navigate to profiler page and verify test case is visible
        await visitProfilerPage(tableEditResultsPage);
        await expect(
          tableEditResultsPage.getByTestId(testCaseName)
        ).toBeVisible();

        // API: Verify GET results succeeds
        const { apiContext } = await getApiContext(tableEditResultsPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`
        );
        expect(res.status()).toBe(200);
      });

      test('User with TEST_CASE.VIEW_ALL can GET results search/list', async ({
        viewResultsPage,
      }) => {
        const { apiContext } = await getApiContext(viewResultsPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseResults/search/list'
        );
        expect(res.status()).toBe(200);
      });

      test('User with TEST_CASE.VIEW_ALL can GET results search/latest', async ({
        viewResultsPage,
      }) => {
        const { apiContext } = await getApiContext(viewResultsPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseResults/search/latest'
        );
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Positive - Edit Results', () => {
      test('User with TEST_CASE.EDIT_ALL can see edit actions and POST test case results', async ({
        editResultsPage,
      }) => {
        // UI: Navigate to profiler, verify edit action is available
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

        // API: Verify POST results succeeds
        const { apiContext } = await getApiContext(editResultsPage);
        const newTimestamp = getCurrentMillis() + 1000;

        const res = await apiContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Posted by EDIT_ALL user.',
              testCaseStatus: 'Success',
              testResultValue: [
                { name: 'minValue', value: '50' },
                { name: 'maxValue', value: '100' },
              ],
              timestamp: newTimestamp,
            },
          }
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TABLE.EDIT_TESTS can see edit actions and POST test case results (alternative)', async ({
        tableEditResultsPage,
      }) => {
        // UI: Navigate to profiler, verify edit action is available
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

        // API: Verify POST results succeeds
        const { apiContext } = await getApiContext(tableEditResultsPage);
        const newTimestamp = getCurrentMillis() + 2000;

        const res = await apiContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Posted by TABLE.EDIT_TESTS user.',
              testCaseStatus: 'Success',
              testResultValue: [
                { name: 'minValue', value: '60' },
                { name: 'maxValue', value: '100' },
              ],
              timestamp: newTimestamp,
            },
          }
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TEST_CASE.EDIT_ALL can PATCH test case result', async ({
        editResultsPage,
      }) => {
        const { apiContext } = await getApiContext(editResultsPage);

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
        expect(res.status()).not.toBe(403);
      });

      test('User with TABLE.EDIT_TESTS can PATCH test case result (alternative)', async ({
        tableEditResultsPage,
      }) => {
        const { apiContext } = await getApiContext(tableEditResultsPage);

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
                  testCaseFailureReason: 'MissingData',
                },
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).not.toBe(403);
      });
    });

    test.describe('Positive - Delete Results', () => {
      test('User with TABLE.DELETE + TEST_CASE.DELETE can DELETE results', async ({
        deleteResultsPage,
        adminPage,
      }) => {
        // Create a result specifically to delete
        const { apiContext: adminContext } = await getApiContext(adminPage);
        const deleteTimestamp = getCurrentMillis() + 5000;
        await adminContext.post(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`,
          {
            data: {
              result: 'Result to delete.',
              testCaseStatus: 'Failed',
              testResultValue: [{ name: 'value', value: '0' }],
              timestamp: deleteTimestamp,
            },
          }
        );

        const { apiContext } = await getApiContext(deleteResultsPage);
        const res = await apiContext.delete(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${deleteTimestamp}`
        );
        expect(res.status()).not.toBe(403);
      });
    });

    test.describe('Negative - View Results', () => {
      test('User with only TABLE.EDIT_TESTS (no TEST_CASE.VIEW_ALL) can still view results via TABLE.VIEW_TESTS', async ({
        tableEditResultsPage,
      }) => {
        // TABLE_EDIT_RESULTS_POLICY includes ViewTests, so this should succeed
        const { apiContext } = await getApiContext(tableEditResultsPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}`
        );
        expect(res.status()).toBe(200);
      });
    });

    test.describe('Negative - Edit Results', () => {
      test('User with only VIEW cannot see edit action and cannot POST results', async ({
        viewResultsPage,
      }) => {
        // UI: Navigate to profiler, verify edit action is NOT available
        await visitProfilerPage(viewResultsPage);
        const actionDropdown = viewResultsPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        if (await actionDropdown.isVisible()) {
          await actionDropdown.click();
          await expect(
            viewResultsPage.getByTestId(`edit-${testCaseName}`)
          ).toBeHidden();
          await viewResultsPage.keyboard.press('Escape');
        }

        // API: Verify POST is forbidden
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
        // Create a result to attempt to delete
        const { apiContext: adminContext } = await getApiContext(adminPage);
        const ts = getCurrentMillis() + 10000;
        await adminContext.post(
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

        // Cleanup
        await adminContext.delete(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${ts}`
        );
      });

      test('User with only TABLE.DELETE (no TEST_CASE.DELETE) cannot DELETE results', async ({
        partialDeleteTablePage,
        adminPage,
      }) => {
        const { apiContext: adminContext } = await getApiContext(adminPage);
        const ts = getCurrentMillis() + 11000;
        await adminContext.post(
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

        // Cleanup
        await adminContext.delete(
          `/api/v1/dataQuality/testCases/testCaseResults/${encodeURIComponent(
            testCaseFqn
          )}/${ts}`
        );
      });
    });
  }
);
