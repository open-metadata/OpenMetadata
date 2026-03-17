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
import { DOMAIN_TAGS } from '../../../constant/config';
import {
  CREATE_TEST_CASE_POLICY,
  DELETE_TEST_CASE_POLICY,
  EDIT_TESTS_ON_TEST_CASE_POLICY,
  EDIT_TEST_CASE_POLICY,
  TABLE_CREATE_TESTS_POLICY,
  TABLE_EDIT_TESTS_POLICY,
  TEST_CASE_VIEW_BASIC_POLICY,
  TEST_SUITE_EDIT_ONLY_POLICY,
  TEST_SUITE_POLICY,
  VIEW_ALL_TEST_CASE_POLICY,
} from '../../../constant/dataQualityPermissions';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { setupUserWithPolicy } from '../../../utils/permission';
import {
  visitTestSuiteDetailsPage,
  visitTestSuitesPage,
  waitForTestCaseDetailsResponse,
  waitForPermissionsResponse,
  waitForTableEntityPermissionsResponse,
  waitForTestCaseListResponse,
} from '../../../utils/testCases';

// --- Objects ---
const createPolicy = new PolicyClass();
const createRole = new RolesClass();
const createUser = new UserClass();

const deletePolicy = new PolicyClass();
const deleteRole = new RolesClass();
const deleteUser = new UserClass();

const suitePolicy = new PolicyClass();
const suiteRole = new RolesClass();
const suiteUser = new UserClass();

const viewBasicPolicy = new PolicyClass();
const viewBasicRole = new RolesClass();
const viewBasicUser = new UserClass();

const tableCreateTestsPolicy = new PolicyClass();
const tableCreateTestsRole = new RolesClass();
const tableCreateTestsUser = new UserClass();

const editTestCasePolicy = new PolicyClass();
const editTestCaseRole = new RolesClass();
const editTestCaseUser = new UserClass();

const tableEditTestsPolicy = new PolicyClass();
const tableEditTestsRole = new RolesClass();
const tableEditTestsUser = new UserClass();

const editTestsOnTcPolicy = new PolicyClass();
const editTestsOnTcRole = new RolesClass();
const editTestsOnTcUser = new UserClass();

const viewAllTcPolicy = new PolicyClass();
const viewAllTcRole = new RolesClass();
const viewAllTcUser = new UserClass();

const suiteEditOnlyPolicy = new PolicyClass();
const suiteEditOnlyRole = new RolesClass();
const suiteEditOnlyUser = new UserClass();

const dataConsumerUser = new UserClass();
const dataStewardUser = new UserClass();

const table = new TableClass();

// --- Fixtures ---
const test = base.extend<{
  adminPage: Page;
  createPage: Page;
  deletePage: Page;
  suitePage: Page;
  viewBasicPage: Page;
  consumerPage: Page;
  stewardPage: Page;
  tableCreateTestsPage: Page;
  editPage: Page;
  tableEditPage: Page;
  editTestsPage: Page;
  viewAllPage: Page;
  suiteEditOnlyPage: Page;
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
  editPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editTestCaseUser.login(page);
    await use(page);
    await page.close();
  },
  tableEditPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await tableEditTestsUser.login(page);
    await use(page);
    await page.close();
  },
  editTestsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editTestsOnTcUser.login(page);
    await use(page);
    await page.close();
  },
  viewAllPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewAllTcUser.login(page);
    await use(page);
    await page.close();
  },
  suiteEditOnlyPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await suiteEditOnlyUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe(
  'Observability Permission Coverage',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    let logicalTestSuiteFqn: string;

    test.beforeAll(async ({ browser }) => {
      test.slow();
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

      // Create a logical test suite for logical test case tests
      const logicalSuiteRes = await apiContext.post(
        '/api/v1/dataQuality/testSuites',
        {
          data: {
            name: `logical_perm_suite_${uuid()}`,
            description: 'Logical suite for permission tests',
          },
        }
      );
      const logicalSuiteData = await logicalSuiteRes.json();
      logicalTestSuiteFqn =
        logicalSuiteData.fullyQualifiedName ?? logicalSuiteData.name;

      // 1. Setup Data Consumer
      await dataConsumerUser.create(apiContext, true);

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
      await setupUserWithPolicy(
        apiContext,
        createUser,
        createPolicy,
        createRole,
        CREATE_TEST_CASE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        deleteUser,
        deletePolicy,
        deleteRole,
        DELETE_TEST_CASE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        suiteUser,
        suitePolicy,
        suiteRole,
        TEST_SUITE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        viewBasicUser,
        viewBasicPolicy,
        viewBasicRole,
        TEST_CASE_VIEW_BASIC_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        tableCreateTestsUser,
        tableCreateTestsPolicy,
        tableCreateTestsRole,
        TABLE_CREATE_TESTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        editTestCaseUser,
        editTestCasePolicy,
        editTestCaseRole,
        EDIT_TEST_CASE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        tableEditTestsUser,
        tableEditTestsPolicy,
        tableEditTestsRole,
        TABLE_EDIT_TESTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        editTestsOnTcUser,
        editTestsOnTcPolicy,
        editTestsOnTcRole,
        EDIT_TESTS_ON_TEST_CASE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        viewAllTcUser,
        viewAllTcPolicy,
        viewAllTcRole,
        VIEW_ALL_TEST_CASE_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        suiteEditOnlyUser,
        suiteEditOnlyPolicy,
        suiteEditOnlyRole,
        TEST_SUITE_EDIT_ONLY_POLICY
      );

      await afterAction();
    });

    const visitProfilerPage = async (page: Page) => {
      const permissionsPromise = waitForPermissionsResponse(page);
      const tablePermissionsPromise =
        waitForTableEntityPermissionsResponse(page);
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await page.getByTestId('profiler').click();
      const testCaseListPromise = waitForTestCaseListResponse(page);
      await page.getByRole('tab', { name: 'Data Quality' }).click();
      await Promise.all([
        testCaseListPromise,
        permissionsPromise,
        tablePermissionsPromise,
      ]);
    };

    test.describe('Standard Roles (Negative Scenarios)', () => {
      test('Data Consumer cannot create or delete test cases', async ({
        consumerPage,
      }) => {
        await visitProfilerPage(consumerPage);

        await expect(
          consumerPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();

        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = consumerPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await consumerPage.keyboard.press('Escape');
      });

      test('Data Consumer can VIEW test cases but sees no edit controls in UI', async ({
        consumerPage,
      }) => {
        await visitProfilerPage(consumerPage);
        const testCaseName = table.testCasesResponseData[0].name;

        await expect(consumerPage.getByTestId(testCaseName)).toBeVisible();

        await expect(
          consumerPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();

        const actionDropdown = consumerPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
      });

      test('Data Steward cannot create or delete test cases (default)', async ({
        stewardPage,
      }) => {
        await visitProfilerPage(stewardPage);

        await expect(
          stewardPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();

        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = stewardPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await stewardPage.keyboard.press('Escape');
      });

      test('Data Consumer cannot create or delete test suites', async ({
        consumerPage,
      }) => {
        await visitTestSuitesPage(consumerPage);

        await expect(
          consumerPage.getByTestId('add-test-suite-btn')
        ).toBeHidden();
      });

      test('Data Consumer cannot edit test case', async ({ consumerPage }) => {
        await visitProfilerPage(consumerPage);
        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = consumerPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await consumerPage.keyboard.press('Escape');
      });
    });

    test.describe('Cross-Permission Negative Scenarios', () => {
      test('User with TEST_CASE.CREATE cannot delete test cases', async ({
        createPage,
      }) => {
        await visitProfilerPage(createPage);
        const testCaseName = table.testCasesResponseData[0].name;

        const actionDropdown = createPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();

        await actionDropdown.click();
        await expect(
          createPage.getByTestId(`delete-${testCaseName}`)
        ).toBeDisabled();
        await createPage.keyboard.press('Escape');
      });

      test('User with TEST_CASE.DELETE cannot create test cases', async ({
        deletePage,
      }) => {
        test.slow();
        await visitProfilerPage(deletePage);

        await expect(
          deletePage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();
      });

      test('User with TEST_CASE.VIEW_BASIC cannot edit test cases', async ({
        viewBasicPage,
      }) => {
        await visitProfilerPage(viewBasicPage);
        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = viewBasicPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );

        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
        await viewBasicPage.keyboard.press('Escape');
      });

      test('User without TEST_SUITE.CREATE cannot create test suites', async ({
        viewBasicPage,
      }) => {
        await visitTestSuitesPage(viewBasicPage);

        await expect(
          viewBasicPage.getByTestId('add-test-suite-btn')
        ).toBeHidden();
      });

      test('User without TEST_SUITE.DELETE cannot delete test suites', async ({
        suiteEditOnlyPage,
      }) => {
        await visitTestSuiteDetailsPage(suiteEditOnlyPage, logicalTestSuiteFqn);

        await suiteEditOnlyPage.getByTestId('manage-button').click();
        await expect(
          suiteEditOnlyPage.getByTestId('delete-button')
        ).not.toBeVisible();
      });

      test('User without TEST_SUITE.EDIT cannot add test case to logical suite', async ({
        viewBasicPage,
      }) => {
        await visitTestSuiteDetailsPage(viewBasicPage, logicalTestSuiteFqn);

        await expect(
          viewBasicPage.getByTestId('add-test-case-btn')
        ).toBeHidden();
      });
    });

    test.describe('Granular Permissions - TestCase CRUD', () => {
      test('User with TEST_CASE.CREATE can see Add button for test case', async ({
        createPage,
      }) => {
        await visitProfilerPage(createPage);

        const testCaseName = table.testCasesResponseData[0].name;
        await expect(createPage.getByTestId(testCaseName)).toBeVisible();

        await expect(
          createPage.getByTestId('profiler-add-table-test-btn')
        ).toBeVisible();
      });

      test('User with TEST_CASE.DELETE can see delete option for test case', async ({
        deletePage,
      }) => {
        await visitProfilerPage(deletePage);
        const testCaseName = table.testCasesResponseData[0].name;
        const actionDropdown = deletePage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          deletePage.getByTestId(`delete-${testCaseName}`)
        ).toBeVisible();
        await deletePage.keyboard.press('Escape');
      });

      test('User with TABLE.CREATE_TESTS can see Add button (Table Permission)', async ({
        tableCreateTestsPage,
      }) => {
        await visitProfilerPage(tableCreateTestsPage);

        const testCaseName = table.testCasesResponseData[0].name;
        await expect(
          tableCreateTestsPage.getByTestId(testCaseName)
        ).toBeVisible();

        await expect(
          tableCreateTestsPage.getByTestId('profiler-add-table-test-btn')
        ).toBeVisible();
      });
    });

    test.describe('Granular Permissions - TestCase Edit/PATCH', () => {
      test('User with TEST_CASE.EDIT_ALL can see edit action on test case', async ({
        editPage,
      }) => {
        await visitProfilerPage(editPage);
        const testCaseName = table.testCasesResponseData[0].name;

        const actionDropdown = editPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          editPage.getByTestId(`edit-${testCaseName}`)
        ).toBeVisible();
        await editPage.keyboard.press('Escape');
      });

      test('User with TABLE.EDIT_TESTS can see edit action on test case', async ({
        tableEditPage,
      }) => {
        await visitProfilerPage(tableEditPage);
        const testCaseName = table.testCasesResponseData[0].name;

        const actionDropdown = tableEditPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await actionDropdown.click();
        await expect(
          tableEditPage.getByTestId(`edit-${testCaseName}`)
        ).toBeVisible();
        await tableEditPage.keyboard.press('Escape');
      });

      test('User with VIEW_BASIC cannot see edit action in UI', async ({
        viewBasicPage,
      }) => {
        await visitProfilerPage(viewBasicPage);
        const testCaseName = table.testCasesResponseData[0].name;

        const actionDropdown = viewBasicPage.getByTestId(
          `action-dropdown-${testCaseName}`
        );
        await expect(actionDropdown).toBeVisible();
        await expect(actionDropdown).toBeDisabled();
      });
    });

    test.describe('Granular Permissions - TestCase GET Endpoints', () => {
      test('User with TEST_CASE.VIEW_BASIC can view test case in UI', async ({
        viewBasicPage,
      }) => {
        await visitProfilerPage(viewBasicPage);
        const testCaseName = table.testCasesResponseData[0].name;

        await expect(viewBasicPage.getByTestId(testCaseName)).toBeVisible();

        await expect(
          viewBasicPage.getByTestId('profiler-add-table-test-btn')
        ).toBeHidden();
      });

      test('User with TEST_CASE.VIEW_BASIC can view test case CONTENT details in UI', async ({
        viewBasicPage,
      }) => {
        test.slow();
        const testCaseName = table.testCasesResponseData[0].name;
        const testCaseFqn = table.testCasesResponseData[0].fullyQualifiedName;

        await visitProfilerPage(viewBasicPage);
        await expect(viewBasicPage.getByTestId(testCaseName)).toBeVisible();

        const testCaseDetailsPromise =
          waitForTestCaseDetailsResponse(viewBasicPage);
        await viewBasicPage.goto(
          `/test-case/${encodeURIComponent(testCaseFqn)}`
        );
        await testCaseDetailsPromise;

        await expect(
          viewBasicPage.getByTestId('entity-page-header')
        ).toBeVisible();

        await expect(
          viewBasicPage.getByText(/Table Row Count To Be Between/i)
        ).toBeVisible();
      });
    });

    test.describe('Granular Permissions - TestSuite', () => {
      test('User with TEST_SUITE.CREATE can see Add test suite button', async ({
        suitePage,
      }) => {
        await visitTestSuitesPage(suitePage);

        await expect(suitePage.getByTestId('add-test-suite-btn')).toBeVisible();
      });

      test('User with TEST_SUITE.VIEW_ALL can view test suites page and list suites', async ({
        suitePage,
      }) => {
        await visitTestSuitesPage(suitePage);

        await expect(suitePage.getByTestId('add-test-suite-btn')).toBeVisible();
        await expect(
          suitePage.getByTestId('table-suite-radio-btn')
        ).toBeAttached();
      });

      test('User with TEST_SUITE.VIEW_ALL can view test suite CONTENT but cannot add test case', async ({
        viewBasicPage,
      }) => {
        await visitTestSuiteDetailsPage(viewBasicPage, logicalTestSuiteFqn);
        await waitForAllLoadersToDisappear(viewBasicPage);

        await expect(
          viewBasicPage.getByTestId('add-test-case-btn')
        ).toBeHidden();
      });

      test('User with TEST_SUITE.EDIT_ALL can see add test case button on suite details', async ({
        suitePage,
      }) => {
        await visitTestSuiteDetailsPage(suitePage, logicalTestSuiteFqn);

        await expect(suitePage.getByTestId('add-test-case-btn')).toBeVisible();
      });

      test('User with TABLE.VIEW_TESTS can view test suites page (alternative permission)', async ({
        viewAllPage,
      }) => {
        await visitTestSuitesPage(viewAllPage);

        await expect(
          viewAllPage.getByTestId('add-test-suite-btn')
        ).toBeHidden();
        await expect(
          viewAllPage.getByTestId('table-suite-radio-btn')
        ).toBeAttached();
      });
    });

    test.describe('Admin Full Access', () => {
      test('Admin can see Data Quality UI controls (add test case, add test suite)', async ({
        adminPage,
      }) => {
        await visitProfilerPage(adminPage);
        await expect(
          adminPage.getByTestId('profiler-add-table-test-btn')
        ).toBeVisible();

        await visitTestSuitesPage(adminPage);

        await expect(adminPage.getByTestId('add-test-suite-btn')).toBeVisible();
      });
    });
  }
);
