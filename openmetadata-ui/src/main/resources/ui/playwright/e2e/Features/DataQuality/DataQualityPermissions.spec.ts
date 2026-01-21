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

// --- Policies ---

// 1. Create Only Policy
const CREATE_TEST_CASE_POLICY = [
  {
    name: `create-test-case-policy-${uuid()}`,
    resources: ['testCase'],
    operations: ['Create', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    // Need to be able to view the table to create a test on it
    name: `view-table-policy-${uuid()}`,
    resources: ['table'],
    operations: [
      'ViewAll',
      'ViewBasic',
      'ViewTests',
      'CreateTests',
      'EditTests',
    ],
    effect: 'allow',
  },
  {
    name: `view-all-policy-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 2. Delete Only Policy
const DELETE_TEST_CASE_POLICY = [
  {
    name: `delete-test-case-policy-${uuid()}`,
    resources: ['testCase'],
    operations: ['Delete', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-table-policy-${uuid()}`,
    resources: ['table'],
    operations: ['ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
];

// 3. Failed Rows Policy
const FAILED_ROWS_POLICY = [
  {
    name: `failed-rows-policy-${uuid()}`,
    resources: ['testCase'],
    operations: [
      'ViewTestCaseFailedRowsSample',
      'DeleteTestCaseFailedRowsSample',
    ],
    effect: 'allow',
  },
  {
    name: `view-basic-policy-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

// 4. Test Suite Policy
const TEST_SUITE_POLICY = [
  {
    name: `test-suite-policy-${uuid()}`,
    resources: ['testSuite'],
    operations: ['Create', 'Delete', 'EditAll', 'ViewAll'],
    effect: 'allow',
  },
];

// 5. Test Case Basic View (Restricted)
const TEST_CASE_VIEW_BASIC_POLICY = [
  {
    name: `test-case-view-basic-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
  {
    name: `table-view-test-${uuid()}`,
    resources: ['table'],
    operations: ['ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
];

// 6. Table Create Tests Policy (Specific Fix Coverage)
const TABLE_CREATE_TESTS_POLICY = [
  {
    name: `table-create-tests-policy-${uuid()}`,
    resources: ['table'],
    operations: ['CreateTests', 'ViewAll', 'ViewBasic', 'ViewTests'],
    effect: 'allow',
  },
  {
    // Needs basic access to see the page
    name: `view-all-basic-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 7. Delete Failed Rows Policy
const DELETE_FAILED_ROWS_POLICY = [
  {
    name: `delete-failed-rows-policy-${uuid()}`,
    resources: ['testCase'],
    operations: ['DeleteTestCaseFailedRowsSample', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    // Needs basic access to see the page
    name: `view-all-basic-del-rows-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// --- Objects ---
const createPolicy = new PolicyClass();
const createRole = new RolesClass();
const createUser = new UserClass();

const deletePolicy = new PolicyClass();
const deleteRole = new RolesClass();
const deleteUser = new UserClass();

const failedRowsPolicy = new PolicyClass();
const failedRowsRole = new RolesClass();
const failedRowsUser = new UserClass();

const suitePolicy = new PolicyClass();
const suiteRole = new RolesClass();
const suiteUser = new UserClass();

const viewBasicPolicy = new PolicyClass();
const viewBasicRole = new RolesClass();
const viewBasicUser = new UserClass();

const tableCreateTestsPolicy = new PolicyClass();
const tableCreateTestsRole = new RolesClass();
const tableCreateTestsUser = new UserClass();

const deleteFailedRowsPolicy = new PolicyClass();
const deleteFailedRowsRole = new RolesClass();
const deleteFailedRowsUser = new UserClass();

const dataConsumerUser = new UserClass();
const dataStewardUser = new UserClass();

const table = new TableClass();

// --- Fixtures ---
const test = base.extend<{
  adminPage: Page;
  createPage: Page;
  deletePage: Page;
  failedRowsPage: Page;
  suitePage: Page;
  viewBasicPage: Page;
  consumerPage: Page;
  stewardPage: Page;
  tableCreateTestsPage: Page;
  deleteFailedRowsPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  createPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await createUser.login(page);
    await use(page);
    await page.close();
  },
  deletePage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await deleteUser.login(page);
    await use(page);
    await page.close();
  },
  failedRowsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await failedRowsUser.login(page);
    await use(page);
    await page.close();
  },
  suitePage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await suiteUser.login(page);
    await use(page);
    await page.close();
  },
  viewBasicPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewBasicUser.login(page);
    await use(page);
    await page.close();
  },
  consumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
  stewardPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataStewardUser.login(page);
    await use(page);
    await page.close();
  },
  tableCreateTestsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await tableCreateTestsUser.login(page);
    await use(page);
    await page.close();
  },
  deleteFailedRowsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await deleteFailedRowsUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe(
  'Observability Permission Coverage',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await table.create(apiContext);

      // Create executable test suite for the table explicitly
      const suiteRes = await apiContext.post(
        '/api/v1/dataQuality/testSuites/executable',
        {
          data: {
            executableEntityReference:
              table.entityResponseData.fullyQualifiedName,
          },
        }
      );
      await suiteRes.json();

      // Create a sample test case so we have one to view/delete
      await table.createTestCase(apiContext);

      // 1. Setup Data Consumer
      await dataConsumerUser.create(apiContext, true); // Assigns DataConsumer by default

      // 2. Setup Data Steward
      await dataStewardUser.create(apiContext, false);
      const dsRoleRes = await apiContext.get('/api/v1/roles/name/DataSteward');
      const dsRole = await dsRoleRes.json();
      await dataStewardUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: { id: dsRole.id, type: 'role', name: 'DataSteward' },
          },
        ],
      });

      // 3. Setup Custom Roles
      // Create Role/User
      await createUser.create(apiContext, false);
      const createPol = await createPolicy.create(
        apiContext,
        CREATE_TEST_CASE_POLICY
      );
      const createRol = await createRole.create(apiContext, [
        createPol.fullyQualifiedName,
      ]);
      await createUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: { id: createRol.id, type: 'role', name: createRol.name },
          },
        ],
      });

      // Delete Role/User
      await deleteUser.create(apiContext, false);
      const deletePol = await deletePolicy.create(
        apiContext,
        DELETE_TEST_CASE_POLICY
      );
      const deleteRol = await deleteRole.create(apiContext, [
        deletePol.fullyQualifiedName,
      ]);
      await deleteUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: { id: deleteRol.id, type: 'role', name: deleteRol.name },
          },
        ],
      });

      // Failed Rows User
      await failedRowsUser.create(apiContext, false);
      const failedPol = await failedRowsPolicy.create(
        apiContext,
        FAILED_ROWS_POLICY
      );
      const failedRol = await failedRowsRole.create(apiContext, [
        failedPol.fullyQualifiedName,
      ]);
      await failedRowsUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: { id: failedRol.id, type: 'role', name: failedRol.name },
          },
        ],
      });

      // Suite User
      await suiteUser.create(apiContext, false);
      const suitePol = await suitePolicy.create(apiContext, TEST_SUITE_POLICY);
      const suiteRol = await suiteRole.create(apiContext, [
        suitePol.fullyQualifiedName,
      ]);
      await suiteUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: { id: suiteRol.id, type: 'role', name: suiteRol.name },
          },
        ],
      });

      // View Basic User
      await viewBasicUser.create(apiContext, false);
      const viewBasicPol = await viewBasicPolicy.create(
        apiContext,
        TEST_CASE_VIEW_BASIC_POLICY
      );
      const viewBasicRol = await viewBasicRole.create(apiContext, [
        viewBasicPol.fullyQualifiedName,
      ]);
      await viewBasicUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: viewBasicRol.id,
              type: 'role',
              name: viewBasicRol.name,
            },
          },
        ],
      });

      // Table Create Tests User
      await tableCreateTestsUser.create(apiContext, false);
      const tableCreatePol = await tableCreateTestsPolicy.create(
        apiContext,
        TABLE_CREATE_TESTS_POLICY
      );
      const tableCreateRol = await tableCreateTestsRole.create(apiContext, [
        tableCreatePol.fullyQualifiedName,
      ]);
      await tableCreateTestsUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: tableCreateRol.id,
              type: 'role',
              name: tableCreateRol.name,
            },
          },
        ],
      });

      // Delete Failed Rows User
      await deleteFailedRowsUser.create(apiContext, false);
      const delFailedRowsPol = await deleteFailedRowsPolicy.create(
        apiContext,
        DELETE_FAILED_ROWS_POLICY
      );
      const delFailedRowsRol = await deleteFailedRowsRole.create(apiContext, [
        delFailedRowsPol.fullyQualifiedName,
      ]);
      await deleteFailedRowsUser.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/roles/0',
            value: {
              id: delFailedRowsRol.id,
              type: 'role',
              name: delFailedRowsRol.name,
            },
          },
        ],
      });

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await dataConsumerUser.delete(apiContext);
      await dataStewardUser.delete(apiContext);

      await createUser.delete(apiContext);
      await createRole.delete(apiContext);
      await createPolicy.delete(apiContext);

      await deleteUser.delete(apiContext);
      await deleteRole.delete(apiContext);
      await deletePolicy.delete(apiContext);

      await failedRowsUser.delete(apiContext);
      await failedRowsRole.delete(apiContext);
      await failedRowsPolicy.delete(apiContext);

      await suiteUser.delete(apiContext);
      await suiteRole.delete(apiContext);
      await suitePolicy.delete(apiContext);

      await viewBasicUser.delete(apiContext);
      await viewBasicRole.delete(apiContext);
      await viewBasicPolicy.delete(apiContext);

      await tableCreateTestsUser.delete(apiContext);
      await tableCreateTestsRole.delete(apiContext);
      await tableCreateTestsPolicy.delete(apiContext);

      await deleteFailedRowsUser.delete(apiContext);
      await deleteFailedRowsRole.delete(apiContext);
      await deleteFailedRowsPolicy.delete(apiContext);

      await table.delete(apiContext);
      await afterAction();
    });

    const visitProfilerPage = async (page: Page) => {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await page.getByTestId('profiler').click();
      await page.getByRole('tab', { name: 'Data Quality' }).click();
    };

    test.describe('Standard Roles (Negative Scenarios)', () => {
      test('Data Consumer cannot create or delete test cases', async ({
        consumerPage,
      }) => {
        await visitProfilerPage(consumerPage);
        const { apiContext } = await getApiContext(consumerPage);

        // UI Validation: Add Button should be hidden
        await expect(
          consumerPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();

        // UI Validation: Delete Button should be hidden
        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = consumerPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        // If dropdown is visible, check that delete is not an option
        if (await actionDropdown.isVisible()) {
          await actionDropdown.click();
          await expect(
            consumerPage.getByTestId(`delete-${testCaseName}`)
          ).toBeHidden();
          // Close dropdown to avoid obscuring other elements if any
          await consumerPage.keyboard.press('Escape');
        }
        // If dropdown is hidden, that's also valid for no-edit access

        // Try API Checks
        const createRes = await apiContext.post(
          '/api/v1/dataQuality/testCases',
          {
            data: {
              name: `consumer_test_${uuid()}`,
              entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
              testDefinition: 'tableRowCountToEqual',
              parameterValues: [{ name: 'value', value: 10 }],
            },
          }
        );

        expect(createRes.status()).toBe(403);

        const deleteRes = await apiContext.delete(
          `/api/v1/dataQuality/testCases/name/${encodeURIComponent(
            table.testCasesResponseData[0].fullyQualifiedName
          )}`
        );

        expect(deleteRes.status()).toBe(403);
      });

      test('Data Steward cannot create or delete test cases (default)', async ({
        stewardPage,
      }) => {
        await visitProfilerPage(stewardPage);
        const { apiContext } = await getApiContext(stewardPage);

        // UI Validation: Add Button should be hidden
        await expect(
          stewardPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();

        // UI Validation: Delete Button should be hidden
        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = stewardPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        if (await actionDropdown.isVisible()) {
          await actionDropdown.click();
          await expect(
            stewardPage.getByTestId(`delete-${testCaseName}`)
          ).toBeHidden();
          await stewardPage.keyboard.press('Escape');
        }

        // API Validation
        const createRes = await apiContext.post(
          '/api/v1/dataQuality/testCases',
          {
            data: {
              name: `steward_test_${uuid()}`,
              entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
              testDefinition: 'tableRowCountToEqual',
              parameterValues: [{ name: 'value', value: 10 }],
            },
          }
        );
        expect(createRes.status()).toBe(403);

        const deleteRes = await apiContext.delete(
          `/api/v1/dataQuality/testCases/name/${encodeURIComponent(
            table.testCasesResponseData[0].fullyQualifiedName
          )}`
        );
        expect(deleteRes.status()).toBe(403);
      });
    });

    test.describe('Granular Permissions', () => {
      test('User with TEST_CASE.CREATE can see Add button and create test case', async ({
        createPage,
        adminPage,
      }) => {
        await visitProfilerPage(createPage);
        const { apiContext } = await getApiContext(createPage);

        // UI Validation: Add Button should be visible
        await expect(
          createPage.getByTestId('profiler-add-table-test-btn')
        ).toBeVisible();

        // Functional/API Validation
        const testName = `create_perm_test_${uuid()}`;
        const createRes = await apiContext.post(
          '/api/v1/dataQuality/testCases',
          {
            data: {
              name: testName,
              entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
              testDefinition: 'tableRowCountToEqual',
              parameterValues: [{ name: 'value', value: 10 }],
            },
          }
        );
        expect(createRes.status()).toBe(201);

        // Cleanup
        const data = await createRes.json();
        const { apiContext: adminContext } = await getApiContext(adminPage);
        await adminContext.delete(`/api/v1/dataQuality/testCases/${data.id}`);
      });

      test('User with TEST_CASE.DELETE can delete test case', async ({
        deletePage,
        adminPage,
      }) => {
        // Setup specific test case to delete
        const { apiContext: adminContext } = await getApiContext(adminPage);
        const testToDelName = `delete_perm_test_${uuid()}`;
        const createRes = await adminContext.post(
          '/api/v1/dataQuality/testCases',
          {
            data: {
              name: testToDelName,
              entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
              testDefinition: 'tableRowCountToEqual',
              parameterValues: [{ name: 'value', value: 10 }],
            },
          }
        );
        expect(createRes.status()).toBe(201);
        const testData = await createRes.json();

        // Refresh deletePage to see the new test case
        await visitProfilerPage(deletePage);

        // UI Validation: Delete Button should be visible
        const actionDropdown = deletePage.getByTestId(
          `action-dropdown-${testToDelName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          deletePage.getByTestId(`delete-${testToDelName}`)
        ).toBeVisible();
        // Close dropdown
        await deletePage.keyboard.press('Escape');

        // Perform Delete via API (or UI, but API is sufficient for perm validation)
        const { apiContext: delContext } = await getApiContext(deletePage);
        const delRes = await delContext.delete(
          `/api/v1/dataQuality/testCases/${testData.id}`
        );
        expect(delRes.status()).toBe(200);
      });

      test('User with TEST_SUITE.CREATE can create Logical Test Suites', async ({
        suitePage,
      }) => {
        await redirectToHomePage(suitePage);
        const { apiContext } = await getApiContext(suitePage);

        const suiteName = `logical_suite_${uuid()}`;
        const createRes = await apiContext.post(
          '/api/v1/dataQuality/testSuites',
          {
            data: {
              name: suiteName,
              description: 'Custom permission suite',
            },
          }
        );
        expect(createRes.status()).toBe(201);
        const data = await createRes.json();

        // Can also delete
        const delRes = await apiContext.delete(
          `/api/v1/dataQuality/testSuites/${data.id}?hardDelete=true&recursive=true`
        );
        expect(delRes.status()).toBe(200);
      });

      test('User with VIEW_TEST_CASE_FAILED_ROWS_SAMPLE can view failed rows', async ({
        failedRowsPage,
      }) => {
        await visitProfilerPage(failedRowsPage);
        // Note: We are verifying the permission exists.
        // Full verification of sample data requires actual failed rows which is heavy setup.
        // We verify that the user can access the API endpoint for sample data if it exists,
        // or effectively that they don't get a 403 on the test case view that usually loads it.

        // For now, check basic access + API check
        const { apiContext } = await getApiContext(failedRowsPage);
        const testCaseFqn = table.testCasesResponseData[0].fullyQualifiedName;

        // Try to access sample data endpoint
        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/${testCaseFqn}/testCaseFailedRowsSample`
        );
        // Should be 200 (OK) or 404 (Not Found) if no sample, but NOT 403 (Forbidden)
        expect(res.status()).not.toBe(403);
      });

      test('User with TEST_CASE.VIEW_BASIC can view test case details', async ({
        viewBasicPage,
      }) => {
        await visitProfilerPage(viewBasicPage);
        const testCaseName = table.testCasesResponseData[0].name;

        // Should see the test case in list
        await expect(viewBasicPage.getByTestId(testCaseName)).toBeVisible();

        // Should NOT see Add button
        await expect(
          viewBasicPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();
      });

      test('User with TABLE.CREATE_TESTS can see Add button (Table Permission)', async ({
        tableCreateTestsPage,
        adminPage,
      }) => {
        await visitProfilerPage(tableCreateTestsPage);
        const { apiContext } = await getApiContext(tableCreateTestsPage);

        // UI Validation: Add Button should be visible
        await expect(
          tableCreateTestsPage.getByTestId('profiler-add-table-test-btn')
        ).toBeVisible();

        // API Check
        const testName = `table_create_perm_${uuid()}`;
        const res = await apiContext.post('/api/v1/dataQuality/testCases', {
          data: {
            name: testName,
            entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
            testDefinition: 'tableRowCountToEqual',
            parameterValues: [{ name: 'value', value: 10 }],
          },
        });
        expect(res.status()).toBe(201);

        // Cleanup
        const data = await res.json();
        const { apiContext: adminContext } = await getApiContext(adminPage);
        await adminContext.delete(`/api/v1/dataQuality/testCases/${data.id}`);
      });

      test('User with DELETE_TEST_CASE_FAILED_ROWS_SAMPLE can delete failed rows', async ({
        deleteFailedRowsPage,
      }) => {
        // We verify the API endpoint is accessible (not 403) similar to the view test.
        const { apiContext } = await getApiContext(deleteFailedRowsPage);
        const testCaseFqn = table.testCasesResponseData[0].fullyQualifiedName;
        // The API returns 200 if success or sometimes 404 if data missing, but definitely NOT 403.
        const res = await apiContext.delete(
          `/api/v1/dataQuality/testCases/${testCaseFqn}/testCaseFailedRowsSample`
        );
        expect(res.status()).not.toBe(403);
      });
    });

    test.describe('Admin Full Access', () => {
      test('Admin can perform all Data Quality operations', async ({
        adminPage,
      }) => {
        await redirectToHomePage(adminPage);
        const { apiContext } = await getApiContext(adminPage);

        // 1. Create Suite
        const suiteName = `admin_suite_${uuid()}`;
        const suiteRes = await apiContext.post(
          '/api/v1/dataQuality/testSuites',
          {
            data: { name: suiteName, description: 'admin suite' },
          }
        );
        expect(suiteRes.status()).toBe(201);
        const suiteData = await suiteRes.json();

        // 2. Create Test Case
        const testName = `admin_test_${uuid()}`;
        const testRes = await apiContext.post('/api/v1/dataQuality/testCases', {
          data: {
            name: testName,
            entityLink: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
            testDefinition: 'tableRowCountToEqual',
            parameterValues: [{ name: 'value', value: 10 }],
          },
        });
        expect(testRes.status()).toBe(201);
        const testData = await testRes.json();

        // 3. Delete Test Case
        const delTestRes = await apiContext.delete(
          `/api/v1/dataQuality/testCases/${testData.id}`
        );
        expect(delTestRes.status()).toBe(200);

        // 4. Delete Suite
        const delSuiteRes = await apiContext.delete(
          `/api/v1/dataQuality/testSuites/${suiteData.id}?hardDelete=true&recursive=true`
        );
        expect(delSuiteRes.status()).toBe(200);
      });
    });
  }
);
