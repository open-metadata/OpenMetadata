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

import { APIRequestContext, expect } from '@playwright/test';

/**
 * Rebuilds an entity's search document and waits for it to come back.
 *
 * Reindex rewrites the doc from `getRequiredReindexFields()` rather than the full entity,
 * so a field the UI reads through search but nobody declared silently disappears on rebuild
 * while the live-write path keeps working. That class of bug shipped repeatedly
 * (see TestCaseStatusAfterReindex / TestSuiteListAfterReindex / TestSuiteSummaryAfterReindex),
 * which is why the `*AfterReindex` specs drive a real rebuild instead of trusting live writes.
 *
 * `POST /v1/search/reindexEntities` is async — it answers 202 and runs on the executor — so the
 * caller has to wait for the doc to reappear or the next assertion races the rebuild.
 */

const REINDEX_SETTLE_TIMEOUT = 60_000;

export type ReindexTarget = {
  id: string;
  type: string;
  fullyQualifiedName: string;
};

/** Search alias per entity type. Only the types the AfterReindex specs touch. */
const SEARCH_INDEX_BY_TYPE: Record<string, string> = {
  testCase: 'test_case_search_index',
  testSuite: 'test_suite_search_index',
  table: 'table_search_index',
  tag: 'tag_search_index',
  glossaryTerm: 'glossary_term_search_index',
  domain: 'domain_search_index',
};

/**
 * Triggers the rebuild and blocks until every target is searchable again.
 *
 * Note there is deliberately no `?recreate=true`: the endpoint declares no such query param
 * (SearchResource.reindexEntities), so passing it was always a no-op — it just read as though
 * the harder delete-then-add path were being exercised when it was not.
 */
export const reindexEntities = async (
  apiContext: APIRequestContext,
  targets: ReindexTarget[]
): Promise<void> => {
  const response = await apiContext.post('/api/v1/search/reindexEntities', {
    data: targets,
  });

  expect(
    response.status(),
    `reindexEntities must be accepted for ${targets.length} entities`
  ).toBeLessThan(400);

  await Promise.all(
    targets.map((target) => waitForIndexed(apiContext, target))
  );
};

/** Polls the entity's alias until its id matches exactly one doc. */
const waitForIndexed = async (
  apiContext: APIRequestContext,
  target: ReindexTarget
): Promise<void> => {
  const index = SEARCH_INDEX_BY_TYPE[target.type];

  if (!index) {
    throw new Error(
      `No search index mapped for entity type '${target.type}' — add it to SEARCH_INDEX_BY_TYPE`
    );
  }

  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=id:%22${target.id}%22&index=${index}&from=0&size=1`
        );

        if (response.status() !== 200) {
          return 0;
        }

        const body = await response.json();

        return body?.hits?.hits?.length ?? 0;
      },
      {
        message: `${target.type} ${target.fullyQualifiedName} must be searchable again after reindex`,
        timeout: REINDEX_SETTLE_TIMEOUT,
      }
    )
    .toBe(1);
};
