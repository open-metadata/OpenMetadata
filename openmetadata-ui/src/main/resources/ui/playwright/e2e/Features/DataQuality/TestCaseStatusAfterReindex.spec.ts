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
 * Regression for the 1.12.7 selective-reindex bug
 * (https://github.com/open-metadata/OpenMetadata/pull/27723):
 * TestCaseIndex.getRequiredReindexFields() omitted `testCaseResult` and
 * `incidentId`, both of which are stripped from the storage JSON. On reindex,
 * TestCaseRepository.setFieldsInBulk skipped fetching them and the resulting
 * ES doc had no `testCaseStatus` — wiping status from search/UI until a
 * per-case write re-populated it.
 *
 * This test creates a test case, writes a result, forces an entity reindex
 * with `recreate=true` (delete + re-add), and asserts the status survives.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const TEST_CASE_STATUS = 'Failed' as const;

test('Test case status survives a full entity reindex', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();

  try {
    await table.create(apiContext);

    const testCase = await table.createTestCase(apiContext);
    const testCaseFqn = testCase.fullyQualifiedName as string;
    const testCaseId = testCase.id as string;

    await table.addTestCaseResult(apiContext, testCaseFqn, {
      result: 'Reindex regression check',
      testCaseStatus: TEST_CASE_STATUS,
      timestamp: Date.now(),
    });

    // Wait for the search doc to settle and assert the status is indexed.
    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
              testCaseFqn
            )}%22&index=test_case_search_index`
          );
          if (res.status() !== 200) {
            return undefined;
          }
          const body = await res.json();
          const hits = body?.hits?.hits ?? [];
          return hits[0]?._source?.testCaseResult?.testCaseStatus;
        },
        {
          message:
            'pre-reindex: test case search doc must include testCaseResult.testCaseStatus',
          timeout: 30_000,
        }
      )
      .toBe(TEST_CASE_STATUS);

    // Force a recreate-style reindex of the test case — this is the exact
    // path that drops the status before the fix.
    const reindexRes = await apiContext.post(
      '/api/v1/search/reindexEntities?recreate=true',
      {
        data: [
          {
            id: testCaseId,
            type: 'testCase',
            fullyQualifiedName: testCaseFqn,
          },
        ],
      }
    );

    expect(reindexRes.status()).toBeLessThan(400);

    // Assert the status is still there after reindex. Before the fix, the
    // recreated doc had no testCaseResult and this poll would time out.
    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
              testCaseFqn
            )}%22&index=test_case_search_index`
          );
          if (res.status() !== 200) {
            return undefined;
          }
          const body = await res.json();
          const hits = body?.hits?.hits ?? [];
          return hits[0]?._source?.testCaseResult?.testCaseStatus;
        },
        {
          message:
            'post-reindex: test case search doc must still include testCaseResult.testCaseStatus',
          timeout: 30_000,
        }
      )
      .toBe(TEST_CASE_STATUS);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
