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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { toastNotification } from '../../../utils/common';
import { getCurrentMillis } from '../../../utils/dateTime';
import { enableAiAppMode } from '../../Utils/appMode';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const INCIDENTS_ROUTE = '/observability/incident-manager';
const ROW_COUNT_TYPE = 'Table Row Count To Be Between';
const COLUMN_COUNT_TYPE = 'Table Column Count To Be Between';

// The grouped listing reads incidents straight from the database, so these
// bounds only cover a cold page and its first fetch.
const GROUPS_TIMEOUT = 30_000;

type IncidentRecord = {
  testCaseResolutionStatusType?: string;
  severity?: string;
  testCaseResolutionStatusDetails?: { assignee?: { name?: string } };
};

const getLatestIncident = async (
  apiContext: APIRequestContext,
  testCaseFqn: string
): Promise<IncidentRecord | undefined> => {
  const response = await apiContext.get(
    `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true&testCaseFQN=${encodeURIComponent(
      testCaseFqn
    )}&startTs=0&endTs=${getCurrentMillis() + 60_000}`
  );
  const body = await response.json();

  return body.data?.[0];
};

/**
 * Every assertion is scoped to incidents assigned to a user created for this
 * file, or to one seeded test case, so the groups on screen are exactly the
 * ones seeded here however many other incidents the instance holds.
 */
test.describe('AI mode Incident Manager — grouped incidents', () => {
  test.describe.configure({ mode: 'serial' });

  const table = new TableClass({ service: new DatabaseServiceClass() });
  const assignee = new UserClass();
  let testCaseFqns: string[] = [];
  // Left unassigned, so it is still New: the one incident here Ack can move.
  let newIncidentFqn = '';

  // Scoped to the file's assignee unless a single test case scopes it.
  const openGroups = async (page: Page, params: Record<string, string>) => {
    const search = new URLSearchParams(
      params.testCaseFQN
        ? params
        : { assignee: assignee.responseData.name, ...params }
    );
    await page.goto(`${INCIDENTS_ROUTE}?${search}`, {
      waitUntil: 'domcontentloaded',
    });

    return page.getByTestId('incident-groups-table');
  };

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60 * 1000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await assignee.create(apiContext, false);

    const rowCount = await table.createTestCase(apiContext);
    const columnCount = await table.createTestCase(apiContext, {
      parameterValues: [
        { name: 'minColValue', value: 12 },
        { name: 'maxColValue', value: 24 },
      ],
      testDefinition: 'tableColumnCountToBeBetween',
    });

    const fresh = await table.createTestCase(apiContext);

    testCaseFqns = [rowCount, columnCount].map(
      (testCase) => testCase['fullyQualifiedName']
    );
    newIncidentFqn = fresh['fullyQualifiedName'];

    for (const testCaseFqn of [...testCaseFqns, newIncidentFqn]) {
      await table.addTestCaseResult(apiContext, testCaseFqn, {
        result: 'Seeded failing result to open an incident.',
        testResultValue: [{ name: 'seeded', value: '0' }],
        testCaseStatus: 'Failed',
        timestamp: getCurrentMillis(),
      });
    }

    const assigned = await apiContext.put(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus/bulk',
      {
        data: testCaseFqns.map((testCaseReference) => ({
          testCaseReference,
          testCaseResolutionStatusType: 'Assigned',
          testCaseResolutionStatusDetails: {
            assignee: { id: assignee.responseData.id, type: 'user' },
          },
        })),
      }
    );

    expect(assigned.ok(), await assigned.text()).toBe(true);
    expect((await assigned.json()).numberOfRowsPassed).toBe(2);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await assignee.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await enableAiAppMode(page);
  });

  test('groups the incidents by test case type', async ({ page }) => {
    const groups = await openGroups(page, {});

    await expect(groups).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(page.getByTestId('incident-groups-count')).toHaveText(
      '2 groups'
    );
    await expect(
      groups.getByRole('rowheader', { name: ROW_COUNT_TYPE })
    ).toBeVisible();
    await expect(
      groups.getByRole('rowheader', { name: COLUMN_COUNT_TYPE })
    ).toBeVisible();
  });

  test('hides the groups a status filter rules out', async ({ page }) => {
    await openGroups(page, { status: 'New' });

    await expect(page.getByTestId('incident-groups-empty')).toBeVisible({
      timeout: GROUPS_TIMEOUT,
    });
  });

  test('previews a table group in the drawer and drills into it', async ({
    page,
  }) => {
    const groups = await openGroups(page, { groupBy: 'table' });
    const tableGroup = groups.getByRole('rowheader', {
      name: table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });
    await expect(page.getByTestId('incident-groups-count')).toHaveText(
      '1 group'
    );

    await tableGroup.click();

    const drawer = page.getByRole('dialog', { name: 'Incident group' });

    await expect(drawer.getByTestId('incident-group-drawer-name')).toHaveText(
      table.entity.displayName
    );
    // The drawer counts and lists the same incidents the group row counts.
    await expect(drawer.getByTestId('incident-group-stat-count')).toHaveText(
      '2'
    );
    await expect(drawer.getByTestId(/^incident-row-/)).toHaveCount(2);

    await drawer.getByTestId('incident-group-view-all').click();

    await expect(drawer).toBeHidden();
    await expect(page.getByTestId('incident-group-detail-heading')).toHaveText(
      table.entity.displayName
    );
    await expect(page.getByTestId(/^incident-row-/)).toHaveCount(2);

    await page.getByTestId('incident-group-back').click();

    await expect(tableGroup).toBeVisible();
  });

  test('sets the severity of every incident in the selected groups', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, { groupBy: 'table' });
    const tableGroup = groups.getByRole('row', {
      name: table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    // The selection checkbox is visually hidden behind its styled box, so it
    // is toggled from the keyboard rather than clicked.
    await tableGroup.getByRole('checkbox').focus();
    await page.keyboard.press('Space');

    await expect(page.getByTestId('incident-groups-selected-count')).toHaveText(
      '1 group selected'
    );

    await page.getByTestId('incident-groups-set-severity').click();
    await page.getByTestId('incident-groups-severity-Severity2').click();

    await toastNotification(page, 'Incidents updated: 2');
    await expect(
      page.getByTestId('incident-groups-selection-bar')
    ).toBeHidden();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const testCaseFqn of testCaseFqns) {
      const incident = await getLatestIncident(apiContext, testCaseFqn);

      expect(incident?.severity).toBe('Severity2');
      // A severity change keeps the status and its assignee.
      expect(incident?.testCaseResolutionStatusType).toBe('Assigned');
      expect(incident?.testCaseResolutionStatusDetails?.assignee?.name).toBe(
        assignee.responseData.name
      );
    }

    await afterAction();
  });

  test('acknowledges the new incidents of the selected groups', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, {
      testCaseFQN: newIncidentFqn,
      groupBy: 'table',
    });
    const tableGroup = groups.getByRole('row', {
      name: table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await tableGroup.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await page.getByTestId('incident-groups-set-status').click();
    await page.getByTestId('incident-groups-status-Ack').click();

    await toastNotification(page, 'Incidents updated: 1');

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const incident = await getLatestIncident(apiContext, newIncidentFqn);

    expect(incident?.testCaseResolutionStatusType).toBe('Ack');

    await afterAction();
  });

  test('leaves assigned incidents as they are when acknowledging', async ({
    page,
    browser,
  }) => {
    const groups = await openGroups(page, { groupBy: 'table' });
    const tableGroup = groups.getByRole('row', {
      name: table.entity.displayName,
    });

    await expect(tableGroup).toBeVisible({ timeout: GROUPS_TIMEOUT });

    await tableGroup.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await page.getByTestId('incident-groups-set-status').click();
    await page.getByTestId('incident-groups-status-Ack').click();

    // The workflow has no way back from Assigned to Ack, so nothing is sent.
    await toastNotification(
      page,
      'No incident in the selected groups can take that change'
    );

    const { apiContext, afterAction } = await performAdminLogin(browser);

    for (const testCaseFqn of testCaseFqns) {
      const incident = await getLatestIncident(apiContext, testCaseFqn);

      expect(incident?.testCaseResolutionStatusType).toBe('Assigned');
    }

    await afterAction();
  });
});
