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
    operations: ['ViewAll', 'ViewBasic', 'ViewTests'],
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

        // Perform Delete
        await redirectToHomePage(deletePage);
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
