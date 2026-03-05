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
  CONSUMER_LIKE_POLICY,
  EDIT_INCIDENTS_POLICY,
  TABLE_EDIT_INCIDENTS_POLICY,
  TABLE_VIEW_INCIDENTS_POLICY,
  VIEW_INCIDENTS_POLICY,
} from '../../../constant/dataQualityPermissions';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext } from '../../../utils/common';
import { setupUserWithPolicy } from '../../../utils/permission';
import { getCurrentMillis } from '../../../utils/dateTime';

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

const tableViewIncidentsPolicy = new PolicyClass();
const tableViewIncidentsRole = new RolesClass();
const tableViewIncidentsUser = new UserClass();

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
  tableViewIncidentsPage: Page;
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
  tableViewIncidentsPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await tableViewIncidentsUser.login(page);
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

test.describe(
  'TestCaseIncidentStatus Permission Coverage',
  { tag: `${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality` },
  () => {
    let testCaseFqn: string;
    let incidentId: string;
    let incidentStateId: string;

    const visitTestCaseIncidentPage = async (page: Page) => {
      await page.goto(`/test-case/${encodeURIComponent(testCaseFqn)}`);
      await expect(page.getByTestId('entity-page-header')).toBeVisible();
      const incidentTab = page.getByRole('tab', { name: /Incident/i });
      await expect(incidentTab).toBeVisible();
      await incidentTab.click();
      await expect(page.getByTestId('issue-tab-container')).toBeVisible();
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

      const incidentUrl = `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&startTs=${
        failedTimestamp - 60000
      }&endTs=${failedTimestamp + 60000}`;

      const incidentListRes = await apiContext.get(incidentUrl);
      const incidentList = await incidentListRes.json();

      if (incidentList.data?.length > 0) {
        const incident = incidentList.data.find(
          (i: { testCaseReference?: { fullyQualifiedName?: string } }) =>
            i.testCaseReference?.fullyQualifiedName === testCaseFqn
        );
        if (incident) {
          incidentId = incident.id;
          incidentStateId = incident.stateId;
        }
      }

      expect(incidentId).toBeDefined();
      expect(incidentStateId).toBeDefined();

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
        tableViewIncidentsUser,
        tableViewIncidentsPolicy,
        tableViewIncidentsRole,
        TABLE_VIEW_INCIDENTS_POLICY
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

    test.describe('Positive - View Incidents', () => {
      test('User with TEST_CASE.VIEW_ALL can view incidents in UI', async ({
        viewIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(viewIncidentsPage.getByTestId('open-task')).toBeVisible();
        await expect(
          viewIncidentsPage.getByTestId('closed-task')
        ).toBeVisible();
        await expect(
          viewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();
      });

      test('User with TEST_CASE.VIEW_ALL can view incident CONTENT in UI', async ({
        viewIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(viewIncidentsPage.getByTestId('open-task')).toBeVisible();
        await expect(
          viewIncidentsPage.getByTestId('closed-task')
        ).toBeVisible();
        await expect(viewIncidentsPage.getByTestId('open-task')).toContainText(
          /open/i
        );
        await expect(
          viewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();
      });

      test('User with TABLE.VIEW_TESTS can view incidents in UI (alternative)', async ({
        tableViewIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(tableViewIncidentsPage);
        await expect(
          tableViewIncidentsPage.getByTestId('open-task')
        ).toBeVisible();
        await expect(
          tableViewIncidentsPage.getByTestId('closed-task')
        ).toBeVisible();
        await expect(
          tableViewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();
      });
    });

    test.describe('Positive - Edit Incidents', () => {
      test('User with TEST_CASE.EDIT_ALL can see edit icon on incidents', async ({
        editIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(editIncidentsPage);
        await expect(editIncidentsPage.getByTestId('open-task')).toBeVisible();
        const editIcon = editIncidentsPage.getByTestId('edit-resolution-icon');
        await expect(editIcon.first()).toBeVisible();
      });

      test('User with TABLE.EDIT_TESTS can see edit icon on incidents (alternative)', async ({
        tableEditIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(tableEditIncidentsPage);
        await expect(
          tableEditIncidentsPage.getByTestId('open-task')
        ).toBeVisible();
        const editIcon = tableEditIncidentsPage.getByTestId(
          'edit-resolution-icon'
        );
        await expect(editIcon.first()).toBeVisible();
      });
    });

    test.describe('Negative - Edit Incidents', () => {
      test('User with only VIEW cannot see edit icon and cannot POST incidents', async ({
        viewIncidentsPage,
      }) => {
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(viewIncidentsPage.getByTestId('open-task')).toBeVisible();
        await expect(
          viewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

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
        await visitTestCaseIncidentPage(viewIncidentsPage);
        await expect(
          viewIncidentsPage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

        const { apiContext } = await getApiContext(viewIncidentsPage);
        const res = await apiContext.patch(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incidentId}`,
          {
            data: [{ op: 'add', path: '/severity', value: 'Severity1' }],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
        expect(res.status()).toBe(403);
      });

      test('Consumer-like user cannot see edit icon and cannot create/edit incidents', async ({
        consumerLikePage,
      }) => {
        await visitTestCaseIncidentPage(consumerLikePage);
        await expect(consumerLikePage.getByTestId('open-task')).toBeVisible();
        await expect(
          consumerLikePage.getByTestId('edit-resolution-icon')
        ).toBeHidden();

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
              data: [{ op: 'add', path: '/severity', value: 'Severity4' }],
              headers: { 'Content-Type': 'application/json-patch+json' },
            }
          );
          expect(patchRes.status()).toBe(403);
        }
      });
    });
  }
);
