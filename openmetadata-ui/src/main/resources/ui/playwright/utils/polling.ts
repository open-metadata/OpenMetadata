/*
 *  Copyright 2025 Collate.
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
import { APIRequestContext, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';

/**
 * Polls the search API until the given entity appears in Elasticsearch.
 * Use after creating/updating entities to wait for async ES indexing.
 */
export const waitForSearchIndexed = async (
  apiContext: APIRequestContext,
  entityFqn: string | undefined,
  index: string,
  options?: { timeout?: number; intervals?: number[] }
) => {
  // Fail fast on a missing FQN rather than querying with an empty phrase,
  // so a caller bug is debuggable at the source instead of surfacing as a
  // confusing timeout.
  if (!entityFqn) {
    throw new Error(
      `waitForSearchIndexed called with empty FQN for index "${index}"`
    );
  }

  const timeout = options?.timeout ?? 30_000;
  const intervals = options?.intervals ?? [500, 1_000, 2_000, 5_000];
  const start = Date.now();
  let intervalIdx = 0;

  while (Date.now() - start < timeout) {
    // Scope the query to the fullyQualifiedName field as an exact quoted
    // phrase (the same pattern used elsewhere in this suite, e.g.
    // TestCaseStatusAfterReindex.spec.ts) instead of a bare `q=` full-text
    // search. A bare query tokenizes a dotted FQN like "org.team.mysql.<uid>"
    // into "org"/"team"/"mysql"/"uid" and can match unrelated already-indexed
    // documents sharing a common token — and since that's a relevance-ranked
    // search, the real match can also rank outside any fixed page size once
    // enough noise accumulates, so checking hits client-side can't fix it.
    const response = await apiContext.get(
      `/api/v1/search/query?q=fullyQualifiedName:%22${encodeURIComponent(
        entityFqn
      )}%22&index=${index}&from=0&size=5`
    );

    if (response.ok()) {
      const data = await response.json();
      const hits: Array<{ _source?: { fullyQualifiedName?: string } }> =
        data?.hits?.hits ?? [];
      const isIndexed = hits.some(
        (hit) => hit._source?.fullyQualifiedName === entityFqn
      );

      if (isIndexed) {
        return;
      }
    }

    const delay = intervals[Math.min(intervalIdx, intervals.length - 1)];
    intervalIdx++;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(
    `Entity "${entityFqn}" not found in index "${index}" after ${timeout}ms`
  );
};

/**
 * Replacement for `page.waitForLoadState('networkidle')`.
 * Waits for DOM content to load and all loader spinners to disappear.
 */
export const waitForPageLoaded = async (page: Page) => {
  await page.waitForLoadState('domcontentloaded');
  await waitForAllLoadersToDisappear(page);
};
