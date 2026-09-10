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
import { okJson } from './apiResponse';
import { waitForAllLoadersToDisappear, waitForWidgetsToRender } from './entity';

/**
 * Polls the search API until the given entity appears in Elasticsearch.
 * Use after creating/updating entities to wait for async ES indexing.
 */
export const waitForSearchIndexed = async (
  apiContext: APIRequestContext,
  entityFqn: string | undefined,
  index: string,
  options?: {
    timeout?: number;
    intervals?: number[];
    minVersion?: number;
    matchBy?: 'fullyQualifiedName' | 'nameOrDisplayName';
  }
) => {
  if (!index || index === 'undefined') {
    throw new Error('waitForSearchIndexed called with empty search index');
  }
  // An empty q= becomes a match-all query in the search API: hits.total>0
  // would resolve on the first poll against any non-empty index, silently
  // bypassing the very race this helper exists to close. Fail fast with a
  // clear message so a missing FQN is debuggable at the source.
  if (!entityFqn) {
    throw new Error(
      `waitForSearchIndexed called with empty FQN for index "${index}"`
    );
  }

  const timeout = options?.timeout ?? 30_000;
  const intervals = options?.intervals ?? [500, 1_000, 2_000, 5_000];
  const start = Date.now();
  let intervalIdx = 0;
  const query =
    options?.matchBy === 'nameOrDisplayName'
      ? `name:${JSON.stringify(entityFqn)} OR displayName:${JSON.stringify(
          entityFqn
        )}`
      : `fullyQualifiedName:${JSON.stringify(entityFqn)}`;

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      `/api/v1/search/query?q=${encodeURIComponent(
        query
      )}&index=${index}&from=0&size=10`
    );
    const data = await okJson<{
      hits?: {
        hits?: Array<{
          _source?: {
            fullyQualifiedName?: string;
            name?: string;
            displayName?: string;
            version?: number;
          };
        }>;
      };
    }>(response, `Search indexing readiness for ${entityFqn}`);
    if (!Array.isArray(data.hits?.hits)) {
      throw new Error(
        `Search indexing readiness for ${entityFqn}: invalid hits`
      );
    }
    if (
      data.hits.hits.some(
        (hit) =>
          (options?.matchBy === 'nameOrDisplayName'
            ? hit._source?.name === entityFqn ||
              hit._source?.displayName === entityFqn
            : hit._source?.fullyQualifiedName === entityFqn) &&
          (options?.minVersion === undefined ||
            (typeof hit._source?.version === 'number' &&
              hit._source.version >= options.minVersion))
      )
    ) {
      return;
    }

    const delay = intervals[Math.min(intervalIdx, intervals.length - 1)];
    intervalIdx++;
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(delay, Math.max(0, timeout - (Date.now() - start)))
      )
    );
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
  await waitForWidgetsToRender(page);
};
