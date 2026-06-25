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
 * Regression for issue #29484. Updating a TestCase owner used to propagate
 * inherited parent fields into time-series incident docs, adding top-level
 * `owners` to TestCaseResolutionStatus search documents. The next latest
 * Incident Manager search then failed Jackson deserialization with
 * "Unrecognized field \"owners\"".
 */

import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { sidebarClick } from '../../../utils/sidebar';

type IncidentListResponse = {
  data?: Array<{ testCaseReference?: { fullyQualifiedName?: string } }>;
};

type TestCaseSearchResponse = {
  hits?: {
    hits?: Array<{
      _source?: {
        owners?: Array<{ id?: string }>;
      };
    }>;
  };
};

const INCIDENT_LIST_PATH =
  '/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Incident Manager renders after a test case owner change', async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);

  const { apiContext, afterAction } = await createNewPage(browser);
  const table = new TableClass();
  const owner = new UserClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);
    const testCaseFqn = testCase.fullyQualifiedName as string;
    const testCaseId = testCase.id as string;

    await table.addTestCaseResult(apiContext, testCaseFqn, {
      result: 'owner propagation regression',
      testCaseStatus: 'Failed',
      timestamp: Date.now(),
    });

    await expect
      .poll(
        async () => {
          const res = await apiContext.get(INCIDENT_LIST_PATH, {
            params: {
              latest: 'true',
              include: 'non-deleted',
              limit: '15',
              offset: '0',
              testCaseFQN: testCaseFqn,
            },
          });

          if (res.status() !== 200) {
            return false;
          }

          const body = (await res.json()) as IncidentListResponse;

          return (
            body.data?.some(
              (incident) =>
                incident.testCaseReference?.fullyQualifiedName === testCaseFqn
            ) ?? false
          );
        },
        {
          message: 'incident status endpoint must index the failed test case',
          timeout: 120_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);

    await owner.create(apiContext);

    const patchRes = await apiContext.patch(
      `/api/v1/dataQuality/testCases/${testCaseId}`,
      {
        data: [
          {
            op: 'add',
            path: '/owners',
            value: [{ id: owner.responseData.id, type: 'user' }],
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    expect(patchRes.status()).toBeLessThan(400);

    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
              testCaseFqn
            )}%22&index=test_case_search_index`
          );

          if (res.status() !== 200) {
            return false;
          }

          const body = (await res.json()) as TestCaseSearchResponse;
          const owners = body.hits?.hits?.[0]?._source?.owners ?? [];

          return owners.some(
            (ownerRef) => ownerRef.id === owner.responseData.id
          );
        },
        {
          message: 'test case search doc must reflect the patched owner',
          timeout: 60_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);

    const exactIncidentListResponse = await apiContext.get(INCIDENT_LIST_PATH, {
      params: {
        latest: 'true',
        include: 'non-deleted',
        limit: '15',
        offset: '0',
      },
    });

    expect(exactIncidentListResponse.status()).toBe(200);

    const pageIncidentListResponse = page.waitForResponse(
      (response) =>
        response.url().includes(INCIDENT_LIST_PATH) &&
        response.request().method() === 'GET'
    );

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);

    const response = await pageIncidentListResponse;
    expect(response.status()).toBe(200);

    const errorToast = page
      .locator('[data-testid="alert-bar"]')
      .filter({ hasText: /Unrecognized field|owners/i });
    await expect(errorToast).toHaveCount(0);
  } finally {
    await table.delete(apiContext).catch(() => undefined);
    if (owner.responseData.id) {
      await owner.delete(apiContext).catch(() => undefined);
    }
    await afterAction();
  }
});
