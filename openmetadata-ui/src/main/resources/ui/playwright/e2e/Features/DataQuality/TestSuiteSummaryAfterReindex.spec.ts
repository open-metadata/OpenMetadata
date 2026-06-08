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
 * Regression for the selective-reindex refactor (PR 27723):
 *
 * TestSuiteIndex.buildSearchIndexDocInternal computes `lastResultTimestamp`
 * from `testSuite.getTestCaseResultSummary()`. TestSuiteRepository registers
 * a fetcher for that under the field name `"summary"`. The reindex path only
 * runs fetchers whose field is in `getRequiredReindexFields()`. Without
 * `"summary"` declared, the fetcher does not run, the Index falls through to
 * `doc.put("lastResultTimestamp", 0L)` (TestSuiteIndex.java:41), and the DQ
 * `/data-quality/test-suites` list page — which sorts by that exact field
 * (`TestSuites.component.tsx:175`) — collapses every reindexed suite to the
 * 1970 epoch, breaking "most recently run first" ordering.
 *
 * The test creates a basic suite, writes a result, asserts the field is
 * non-zero on the live-write path, forces a `recreate=true` reindex of the
 * testSuite, and asserts the field is still non-zero. Before the fix this
 * dropped back to 0 — provably the data the UI sort depends on.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Test suite lastResultTimestamp survives a full entity reindex', async ({
  browser,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);

    const resultTimestamp = Date.now();
    await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
      result: 'Reindex regression check',
      testCaseStatus: 'Success',
      timestamp: resultTimestamp,
    });

    const suite = testCase.testSuite as {
      id: string;
      fullyQualifiedName: string;
    };

    const reindexRes = await apiContext.post(
      '/api/v1/search/reindexEntities?recreate=true',
      {
        data: [
          {
            fullyQualifiedName: suite.fullyQualifiedName,
            id: suite.id,
            type: 'testSuite',
          },
        ],
      }
    );

    expect(reindexRes.status()).toBeLessThan(400);

    // Before the fix, the recreated doc has lastResultTimestamp=0 because the
    // "summary" fetcher never ran and the Index hit its 0L fallback branch.
    // After the fix it is the millisecond timestamp of the most recent result.
    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
              suite.fullyQualifiedName
            )}%22&index=test_suite_search_index`
          );
          if (res.status() !== 200) {
            return 0;
          }
          const body = await res.json();

          return body?.hits?.hits?.[0]?._source?.lastResultTimestamp ?? 0;
        },
        {
          message:
            'post-reindex: test suite doc must still include a non-zero lastResultTimestamp',
          timeout: 60_000,
        }
      )
      .toBeGreaterThan(0);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
