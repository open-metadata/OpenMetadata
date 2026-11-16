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
import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { DatabaseServiceClass } from '../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../support/entity/TableClass';
import { UserClass } from '../support/user/UserClass';
import { getCurrentMillis } from './dateTime';

const INCIDENTS_ROUTE = '/observability/incident-manager';

export type IncidentRecord = {
  id?: string;
  testCaseResolutionStatusType?: string;
  severity?: string;
  testCaseResolutionStatusDetails?: { assignee?: { name?: string } };
};

// The checkbox input is visually hidden inside its styled box, which is what
// takes the click.
export const selectGroup = (row: Locator) =>
  row.getByTestId(/^group-select-/).click();

// Every bulk change asks first, naming how many incidents it reaches.
export const confirmBulkChange = async (page: Page) => {
  const modal = page.getByTestId('incident-groups-bulk-status-modal');

  await expect(modal.getByTestId('bulk-status-scope')).toBeVisible();
  await modal.getByRole('button', { name: 'Apply' }).click();
};

export const getLatestIncident = async (
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

export type IncidentSeed = {
  table: TableClass;
  assignee: UserClass;
  // The row count and column count incidents, both assigned to `assignee`.
  testCaseFqns: string[];
  rowCountName: string;
  // Left unassigned, so it is still New: the one incident here Ack can move.
  newIncidentFqn: string;
};

const openIncidents = async (
  apiContext: APIRequestContext,
  table: TableClass,
  assignee: UserClass,
  rowCountSeverity?: string
): Promise<IncidentSeed> => {
  const rowCount = await table.createTestCase(apiContext);
  const columnCount = await table.createTestCase(apiContext, {
    parameterValues: [
      { name: 'minColValue', value: 12 },
      { name: 'maxColValue', value: 24 },
    ],
    testDefinition: 'tableColumnCountToBeBetween',
  });
  const fresh = await table.createTestCase(apiContext);
  const testCaseFqns = [rowCount, columnCount].map(
    (testCase) => testCase['fullyQualifiedName']
  );

  for (const testCaseFqn of [...testCaseFqns, fresh['fullyQualifiedName']]) {
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

  if (rowCountSeverity) {
    // Patched on the latest record, the way a severity set in the UI lands.
    const incident = await getLatestIncident(apiContext, testCaseFqns[0]);
    const patched = await apiContext.patch(
      `/api/v1/dataQuality/testCases/testCaseIncidentStatus/${incident?.id}`,
      {
        data: [{ op: 'add', path: '/severity', value: rowCountSeverity }],
        headers: { 'Content-Type': 'application/json-patch+json' },
      }
    );

    expect(patched.ok(), await patched.text()).toBe(true);
  }

  return {
    table,
    assignee,
    testCaseFqns,
    rowCountName: rowCount['name'],
    newIncidentFqn: fresh['fullyQualifiedName'],
  };
};

/**
 * Seeds a table of its own with three open incidents, two of them assigned to
 * a user of its own. Every assertion is scoped to that user or to one seeded
 * test case, so the groups on screen are exactly the seeded ones however many
 * other incidents the instance holds — and no test sees another's changes.
 */
export const seedIncidents = async (
  apiContext: APIRequestContext,
  rowCountSeverity?: string
): Promise<IncidentSeed> => {
  const table = new TableClass({ service: new DatabaseServiceClass() });
  const assignee = new UserClass();

  try {
    await assignee.create(apiContext, false);

    return await openIncidents(apiContext, table, assignee, rowCountSeverity);
  } catch (error) {
    // A seed that failed part way is cleaned up here: the caller never gets it
    // to remove. Whatever was not created yet fails to delete, and is skipped.
    await table.delete(apiContext).catch(() => undefined);
    await assignee.delete(apiContext).catch(() => undefined);

    throw error;
  }
};

export const removeSeed = async (
  apiContext: APIRequestContext,
  seed: IncidentSeed
) => {
  await seed.table.delete(apiContext);
  await seed.assignee.delete(apiContext);
};

// Scoped to the seed's assignee unless a single test case scopes it.
export const openGroups = async (
  page: Page,
  seed: IncidentSeed,
  params: Record<string, string>
) => {
  const search = new URLSearchParams(
    params.testCaseFQN
      ? params
      : { assignee: seed.assignee.responseData.name, ...params }
  );
  await page.goto(`${INCIDENTS_ROUTE}?${search}`, {
    waitUntil: 'domcontentloaded',
  });

  return page.getByTestId('incident-groups-table');
};
