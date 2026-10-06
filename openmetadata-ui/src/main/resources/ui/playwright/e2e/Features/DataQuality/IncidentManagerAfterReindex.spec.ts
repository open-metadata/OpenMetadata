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

/**
 * Incident state lives in fields the test-case index has to fetch explicitly —
 * `testCaseResult` and `incidentId` are both stripped from the storage JSON, and omitting
 * either from getRequiredReindexFields() wipes the status from search on rebuild
 * (the 1.12.7 bug behind TestCaseStatusAfterReindex.spec.ts). IncidentManager.spec.ts drives
 * the lifecycle against live-written docs; this asserts the same surfaces after a rebuild.
 *
 * Ported from the deleted IncidentManager{Acknowledge,Resolve}ReindexUIIT and
 * IncidentTabOnEntityPageReindexUIIT.
 */

import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import {
  acknowledgeTask,
  seedFailedIncidents,
  verifyIncidentStatus,
  visitProfilerTab,
} from '../../../utils/incidentManager';
import { reindexEntities } from '../../../utils/reindex';
import { sidebarClick } from '../../../utils/sidebar';

const INCIDENT_LIST_URL =
  '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list';

// 22 incidents clears the default page size of 15, so Next/Previous have somewhere to go.
const PAGINATION_INCIDENT_COUNT = 22;

test.use({ storageState: 'playwright/.auth/admin.json' });

const FAILED_RESULT = {
  result: 'Reindex regression check',
  testCaseStatus: 'Failed',
} as const;

test('Acknowledged incident status survives a reindex', async ({ browser }) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);
    const testCaseName = testCase.name as string;

    await table.addTestCaseResult(
      apiContext,
      testCase.fullyQualifiedName as string,
      { ...FAILED_RESULT, timestamp: Date.now() }
    );

    await acknowledgeTask({ testCase: testCaseName, page, table });

    await reindexEntities(apiContext, [
      {
        id: testCase.id as string,
        type: 'testCase',
        fullyQualifiedName: testCase.fullyQualifiedName as string,
      },
    ]);

    // Before the fix this rendered as 'New' (or blank) because the rebuilt doc carried
    // no testCaseResult, so the acknowledgement looked lost to anyone reading search.
    await verifyIncidentStatus({
      testCase: testCaseName,
      page,
      table,
      status: 'Ack',
    });
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Incident rows on the entity Incidents tab survive a reindex', async ({
  browser,
}) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    await table.create(apiContext);

    const testCases = [];
    for (let index = 0; index < 3; index++) {
      const testCase = await table.createTestCase(apiContext);
      await table.addTestCaseResult(
        apiContext,
        testCase.fullyQualifiedName as string,
        { ...FAILED_RESULT, timestamp: Date.now() }
      );
      testCases.push(testCase);
    }

    await reindexEntities(
      apiContext,
      testCases.map((testCase) => ({
        id: testCase.id as string,
        type: 'testCase',
        fullyQualifiedName: testCase.fullyQualifiedName as string,
      }))
    );

    await visitProfilerTab(page, table);
    const incidentListResponse = page.waitForResponse((response) =>
      response
        .url()
        .includes(
          '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list'
        )
    );
    await page.getByRole('tab', { name: /Incidents/i }).click();
    await incidentListResponse;

    for (const testCase of testCases) {
      await expect(
        page.getByTestId(`test-case-${testCase.name}`),
        `${testCase.name} must still be listed on the Incidents tab after rebuild`
      ).toBeVisible();
    }
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});

test('Incident Manager list paginates after every incident is reindexed', async ({
  browser,
}) => {
  test.slow();

  const { page, apiContext, afterAction } = await createNewPage(browser, {
    navigate: true,
  });
  const table = new TableClass();

  try {
    const testCases = await seedFailedIncidents({
      apiContext,
      table,
      count: PAGINATION_INCIDENT_COUNT,
    });

    await reindexEntities(
      apiContext,
      testCases.map((testCase) => ({
        id: testCase['id'] as string,
        type: 'testCase',
        fullyQualifiedName: testCase['fullyQualifiedName'] as string,
      }))
    );

    const initialListResponse = page.waitForResponse((response) =>
      response.url().includes(INCIDENT_LIST_URL)
    );
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
    await initialListResponse;

    // A rebuild that drops incidentId leaves the list short, so the page count is the
    // assertion that actually notices — a visible-row check would still pass on page 1.
    await expect(
      page.getByTestId('test-case-incident-manager-table')
    ).toBeVisible();
    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('page-indicator')).toContainText('1');

    const nextListResponse = page.waitForResponse(
      (response) =>
        response.url().includes(INCIDENT_LIST_URL) &&
        response.url().includes('offset=15')
    );
    await page.getByTestId('next').click();
    await nextListResponse;

    await expect(page.getByTestId('page-indicator')).toContainText('2');
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
