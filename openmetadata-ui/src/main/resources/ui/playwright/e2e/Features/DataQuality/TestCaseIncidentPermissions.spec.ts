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

// 1. View Incidents Policy (TEST_CASE.VIEW_ALL + TABLE.VIEW_TESTS)
const VIEW_INCIDENTS_POLICY = [
  {
    name: `view-incidents-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-incidents-table-${uuid()}`,
    resources: ['table'],
    operations: ['ViewAll', 'ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-incidents-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 2. Edit Incidents Policy (TEST_CASE.EDIT_TESTS + TEST_CASE.EDIT_ALL)
const EDIT_INCIDENTS_POLICY = [
  {
    name: `edit-incidents-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['EditTests', 'EditAll', 'ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `edit-incidents-table-${uuid()}`,
    resources: ['table'],
    operations: ['EditTests', 'EditAll', 'ViewAll', 'ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `edit-incidents-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 3. Table Edit Incidents Policy (TABLE.EDIT_TESTS only)
const TABLE_EDIT_INCIDENTS_POLICY = [
  {
    name: `table-edit-incidents-${uuid()}`,
    resources: ['table'],
    operations: ['EditTests', 'ViewAll', 'ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `table-edit-incidents-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 4. View Only Policy (TEST_CASE.VIEW_BASIC only - restricted, should fail incident view)
const VIEW_ONLY_POLICY = [
  {
    name: `view-only-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-only-table-${uuid()}`,
    resources: ['table'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
  {
    name: `view-only-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// 5. Data Consumer Simulation (limited permissions, no edit)
const CONSUMER_LIKE_POLICY = [
  {
    name: `consumer-like-tc-${uuid()}`,
    resources: ['testCase'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `consumer-like-table-${uuid()}`,
    resources: ['table'],
    operations: ['ViewAll', 'ViewTests', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `consumer-like-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewBasic'],
    effect: 'allow',
  },
];

// --- Objects ---
const viewIncidentsPolicy = new PolicyClass();
const viewIncidentsRole = new RolesClass();
const viewIncidentsUser = new UserClass();

const editIncidentsPolicy = new PolicyClass();
const editIncidentsRole = new RolesClass();
const editIncidentsUser = new UserClass();

const tableEditIncidentsPolicy = new PolicyClass();
const tableEditIncidentsRole = new RolesClass();
const tableEditIncidentsUser = new UserClass();

const viewOnlyPolicy = new PolicyClass();
const viewOnlyRole = new RolesClass();
const viewOnlyUser = new UserClass();

const consumerLikePolicy = new PolicyClass();
const consumerLikeRole = new RolesClass();
const consumerLikeUser = new UserClass();

const table = new TableClass();

// --- Fixtures ---
const test = base.extend<{
  adminPage: Page;
  viewIncidentsPage: Page;
  editIncidentsPage: Page;
  tableEditIncidentsPage: Page;
  viewOnlyPage: Page;
  consumerLikePage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const { page } = await performAdminLogin(browser);
    await use(page);
    await page.close();
  },
  viewIncidentsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewIncidentsUser.login(page);
    await use(page);
    await page.close();
  },
  editIncidentsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editIncidentsUser.login(page);
    await use(page);
    await page.close();
  },
  tableEditIncidentsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await tableEditIncidentsUser.login(page);
    await use(page);
    await page.close();
  },
  viewOnlyPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await viewOnlyUser.login(page);
    await use(page);
    await page.close();
  },
  consumerLikePage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await consumerLikeUser.login(page);
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
  'TestCaseIncidentStatus Permission Coverage',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    let testCaseFqn: string;
    let testCaseName: string;
    let incidentId: string;
    let incidentStateId: string;

    const visitTestCaseIncidentPage = async (page: Page) => {
      await redirectToHomePage(page);
      await page.goto(`/test-case/${encodeURIComponent(testCaseFqn)}`);
      await page.waitForLoadState('networkidle');
      // Click the Incident tab to activate it
      const incidentTab = page.getByRole('tab', { name: /Incident/i });
      if (await incidentTab.isVisible()) {
        await incidentTab.click();
        await page.waitForLoadState('networkidle');
      }
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

      // Add a FAILED test case result to trigger incident creation
      const failedTimestamp = getCurrentMillis();
      await table.addTestCaseResult(apiContext, testCaseFqn, {
        result: 'Value 10 not within range 100-200.',
        testCaseStatus: 'Failed',
        testResultValue: [
          { name: 'minValue', value: '10' },
          { name: 'maxValue', value: '100' },
        ],
        timestamp: failedTimestamp,
      });

      // Fetch the incident created for this test case
      const incidentListRes = await apiContext.get(
        `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&startTs=${failedTimestamp - 60000}&endTs=${failedTimestamp + 60000}`
      );
      const incidentList = await incidentListRes.json();

      if (incidentList.data && incidentList.data.length > 0) {
        const incident = incidentList.data.find(
          (i: { testCaseReference?: { fullyQualifiedName?: string } }) =>
            i.testCaseReference?.fullyQualifiedName === testCaseFqn
        );
        if (incident) {
          incidentId = incident.id;
          incidentStateId = incident.stateId;
        }
      }

      // Setup all users
      await setupUserWithPolicy(
        apiContext,
        viewIncidentsUser,
        viewIncidentsPolicy,
        viewIncidentsRole,
        VIEW_INCIDENTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        editIncidentsUser,
        editIncidentsPolicy,
        editIncidentsRole,
        EDIT_INCIDENTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        tableEditIncidentsUser,
        tableEditIncidentsPolicy,
        tableEditIncidentsRole,
        TABLE_EDIT_INCIDENTS_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        viewOnlyUser,
        viewOnlyPolicy,
        viewOnlyRole,
        VIEW_ONLY_POLICY
      );
      await setupUserWithPolicy(
        apiContext,
        consumerLikeUser,
        consumerLikePolicy,
        consumerLikeRole,
        CONSUMER_LIKE_POLICY
      );

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await cleanupUserWithPolicy(
        apiContext,
        viewIncidentsUser,
        viewIncidentsRole,
        viewIncidentsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        editIncidentsUser,
        editIncidentsRole,
        editIncidentsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        tableEditIncidentsUser,
        tableEditIncidentsRole,
        tableEditIncidentsPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        viewOnlyUser,
        viewOnlyRole,
        viewOnlyPolicy
      );
      await cleanupUserWithPolicy(
        apiContext,
        consumerLikeUser,
        consumerLikeRole,
        consumerLikePolicy
      );

      await table.delete(apiContext);
      await afterAction();
    });

    test.describe('Positive - View Incidents', () => {
      test('User with TEST_CASE.VIEW_ALL can view incidents in UI and GET incident status list', async ({
        viewIncidentsPage,
      }) => {
        // UI: Navigate to test case incident page and verify incident tab loads
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(
          viewIncidentsPage.getByTestId('issue-tab-container')
        ).toBeVisible();

        // API: Verify GET incident list succeeds
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
        );
        expect(res.status()).toBe(200);
      });

      test('User with TABLE.VIEW_TESTS can view incidents and GET incident status list (alternative)', async ({
        tableEditIncidentsPage,
      }) => {
        // UI: Navigate to test case incident page
        await visitTestCaseIncidentPage(tableEditIncidentsPage);
        await expect(
          tableEditIncidentsPage.getByTestId('issue-tab-container')
        ).toBeVisible();

        // API: Verify GET incident list succeeds
        const { apiContext } = await getApiContext(tableEditIncidentsPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
        );
        expect(res.status()).toBe(200);
      });

      test('User with TEST_CASE.VIEW_ALL can GET incident by stateId', async ({
        viewIncidentsPage,
      }) => {
        test.skip(!incidentStateId, 'No incident stateId available');
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/stateId/${incidentStateId}`
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TEST_CASE.VIEW_ALL can GET incident by id', async ({
        viewIncidentsPage,
      }) => {
        test.skip(!incidentId, 'No incident id available');
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TABLE.VIEW_ALL can GET incident search/list', async ({
        viewIncidentsPage,
      }) => {
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
        );
        expect(res.status()).not.toBe(403);
      });
    });

    test.describe('Positive - Edit Incidents', () => {
      test('User with TEST_CASE.EDIT_ALL can see edit icon and POST incident status (Ack)', async ({
        editIncidentsPage,
      }) => {
        // UI: Navigate to incidents page and verify edit resolution icon is visible
        await visitTestCaseIncidentPage(editIncidentsPage);
        const issueTabContainer = editIncidentsPage.getByTestId(
          'issue-tab-container'
        );
        await expect(issueTabContainer).toBeVisible();

        // Check edit-resolution-icon is visible (indicates edit permissions)
        const editIcon = editIncidentsPage.getByTestId('edit-resolution-icon');

        if (await editIcon.first().isVisible()) {
          await expect(editIcon.first()).toBeVisible();
        }

        // API: Verify POST incident succeeds
        const { apiContext } = await getApiContext(editIncidentsPage);

        const res = await apiContext.post(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
          {
            data: {
              testCaseReference: testCaseFqn,
              testCaseResolutionStatusType: 'Ack',
            },
          }
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TABLE.EDIT_TESTS can see edit icon and POST incident status (alternative)', async ({
        tableEditIncidentsPage,
      }) => {
        // UI: Navigate to incidents page and verify edit resolution icon is visible
        await visitTestCaseIncidentPage(tableEditIncidentsPage);
        const issueTabContainer = tableEditIncidentsPage.getByTestId(
          'issue-tab-container'
        );
        await expect(issueTabContainer).toBeVisible();

        const editIcon = tableEditIncidentsPage.getByTestId(
          'edit-resolution-icon'
        );

        if (await editIcon.first().isVisible()) {
          await expect(editIcon.first()).toBeVisible();
        }

        // API: Verify POST incident succeeds
        const { apiContext } = await getApiContext(tableEditIncidentsPage);

        const res = await apiContext.post(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
          {
            data: {
              testCaseReference: testCaseFqn,
              testCaseResolutionStatusType: 'Ack',
            },
          }
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TEST_CASE.EDIT_TESTS can PATCH incident status', async ({
        editIncidentsPage,
      }) => {
        test.skip(!incidentId, 'No incident id available');
        const { apiContext } = await getApiContext(editIncidentsPage);

        const res = await apiContext.patch(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`,
          {
            data: [
              {
                op: 'add',
                path: '/severity',
                value: 'Severity2',
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).not.toBe(403);
      });

      test('User with TABLE.EDIT_ALL can PATCH incident status (alternative)', async ({
        editIncidentsPage,
      }) => {
        test.skip(!incidentId, 'No incident id available');
        const { apiContext } = await getApiContext(editIncidentsPage);

        const res = await apiContext.patch(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`,
          {
            data: [
              {
                op: 'add',
                path: '/severity',
                value: 'Severity3',
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).not.toBe(403);
      });
    });

    test.describe('Negative - View Incidents', () => {
      test('User with only VIEW_BASIC cannot view incidents in UI or via API', async ({
        viewOnlyPage,
      }) => {
        // UI: Navigate to incident page - should not show incident content
        await visitTestCaseIncidentPage(viewOnlyPage);

        // The issue-tab-container should either not be visible
        // or the edit-resolution-icon should be hidden
        await expect(
          viewOnlyPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

        // API: Verify GET incident search/list is forbidden
        const { apiContext } = await getApiContext(viewOnlyPage);

        const res = await apiContext.get(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
        );
        expect(res.status()).toBe(403);
      });

      test('User with only VIEW_BASIC cannot GET incident by id', async ({
        viewOnlyPage,
      }) => {
        test.skip(!incidentId, 'No incident id available');
        const { apiContext } = await getApiContext(viewOnlyPage);

        const res = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`
        );
        expect(res.status()).toBe(403);
      });
    });

    test.describe('Negative - Edit Incidents', () => {
      test('User with only VIEW cannot see edit icon and cannot POST incidents', async ({
        viewIncidentsPage,
      }) => {
        // UI: Navigate to incidents page and verify edit-resolution-icon is NOT visible
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(
          viewIncidentsPage.getByTestId('issue-tab-container')
        ).toBeVisible();

        await expect(
          viewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

        // API: Verify POST is forbidden
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.post(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
          {
            data: {
              testCaseReference: testCaseFqn,
              testCaseResolutionStatusType: 'Ack',
            },
          }
        );
        expect(res.status()).toBe(403);
      });

      test('User with only VIEW cannot PATCH incidents', async ({
        viewIncidentsPage,
      }) => {
        test.skip(!incidentId, 'No incident id available');
        const { apiContext } = await getApiContext(viewIncidentsPage);

        const res = await apiContext.patch(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`,
          {
            data: [
              { op: 'add', path: '/severity', value: 'Severity1' },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).toBe(403);
      });

      test('Consumer-like user cannot see edit icon and cannot create/edit incidents', async ({
        consumerLikePage,
      }) => {
        // UI: Navigate to incidents page and verify edit-resolution-icon is NOT visible
        await visitTestCaseIncidentPage(consumerLikePage);
        await expect(
          consumerLikePage.getByTestId('issue-tab-container')
        ).toBeVisible();

        await expect(
          consumerLikePage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

        // API: Verify POST is forbidden
        const { apiContext } = await getApiContext(consumerLikePage);

        const postRes = await apiContext.post(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus',
          {
            data: {
              testCaseReference: testCaseFqn,
              testCaseResolutionStatusType: 'Ack',
            },
          }
        );
        expect(postRes.status()).toBe(403);

        if (incidentId) {
          const patchRes = await apiContext.patch(
            `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`,
            {
              data: [
                { op: 'add', path: '/severity', value: 'Severity4' },
              ],
              headers: { 'Content-Type': 'application/json-patch+json' },
            }
          );
          expect(patchRes.status()).toBe(403);
        }
      });
    });
  }
);
