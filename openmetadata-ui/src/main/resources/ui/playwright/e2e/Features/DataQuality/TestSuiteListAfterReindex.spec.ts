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
 * Regression for the selective-reindex refactor:
 *
 * The DQ `/data-quality/test-suites/table-suites` list page queries
 * `/api/v1/dataQuality/testSuites/search/list` with
 * `includeEmptyTestSuites=false&testSuiteType=basic`. The backend turns
 * `includeEmptyTestSuites=false` into an `{"exists": {"field": "tests"}}`
 * filter (SearchListFilter.getTestSuiteCondition,
 * SearchListFilter.java:347), so only suites whose index doc carries a
 * `tests` field are returned.
 *
 * That `tests` field is only populated by a fetcher registered under the
 * field name `"tests"`, and the reindex path only runs fetchers whose field
 * is declared in `getRequiredReindexFields()`. Without `"tests"` declared
 * (TestSuiteIndex.java:40), a `recreate=true` reindex rebuilds every basic
 * suite without a `tests` field, the `exists` filter excludes them all, and
 * the table-suites list page comes back empty even though the suites still
 * have test cases.
 *
 * The test creates a basic suite with a test case, confirms it shows up on
 * the live-write path, forces a `recreate=true` reindex of the testSuite,
 * and asserts the suite is still returned by the exact endpoint the UI
 * calls. Before the fix the post-reindex list was empty.
 */

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const queryTableSuitesList = async (
  apiContext: Awaited<ReturnType<typeof createNewPage>>['apiContext'],
  suiteFqn: string
) => {
  const res = await apiContext.get(
    `/api/v1/dataQuality/testSuites/search/list?limit=50&offset=0&q=${encodeURIComponent(
      suiteFqn
    )}&includeEmptyTestSuites=false&testSuiteType=basic`
  );

  if (res.status() !== 200) {
    return [];
  }

  const body = await res.json();

  return (body?.data ?? []) as Array<{ fullyQualifiedName?: string }>;
};

test('Basic test suite stays listed on the table-suites page after a full reindex', async ({
  browser,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);

    await table.addTestCaseResult(apiContext, testCase.fullyQualifiedName, {
      result: 'Reindex regression check',
      testCaseStatus: 'Success',
      timestamp: Date.now(),
    });

    const suite = testCase.testSuite as {
      id: string;
      fullyQualifiedName: string;
    };

    await expect
      .poll(
        async () => {
          const suites = await queryTableSuitesList(
            apiContext,
            suite.fullyQualifiedName
          );

          return suites.some(
            (s) => s.fullyQualifiedName === suite.fullyQualifiedName
          );
        },
        {
          message:
            'pre-reindex: basic suite with a test case must appear in the table-suites list',
          timeout: 30_000,
        }
      )
      .toBe(true);

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

    expect(reindexRes.status()).toBe(200);

    // Before the fix, the recreated doc has no `tests` field because the
    // "tests" fetcher never ran, the `{"exists": {"field": "tests"}}` filter
    // drops it, and this list comes back empty. After the fix the suite is
    // still returned.
    await expect
      .poll(
        async () => {
          const suites = await queryTableSuitesList(
            apiContext,
            suite.fullyQualifiedName
          );

          return suites.some(
            (s) => s.fullyQualifiedName === suite.fullyQualifiedName
          );
        },
        {
          message:
            'post-reindex: basic suite must still appear in the table-suites list',
          timeout: 30_000,
        }
      )
      .toBe(true);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
