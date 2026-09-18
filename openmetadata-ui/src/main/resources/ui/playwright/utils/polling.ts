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
import { getApiContext } from './common';
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
    queryFilter?: string;
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
  const queryFilter = options?.queryFilter
    ? `&query_filter=${encodeURIComponent(options.queryFilter)}`
    : '';
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
      )}&index=${index}&from=0&size=10${queryFilter}`
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

  if (!options?.queryFilter) {
    throw new Error(
      `Entity "${entityFqn}" not found in index "${index}" after ${timeout}ms`
    );
  }

  // A filtered wait that times out has two very different causes and the same
  // message for both: the entity never got indexed, or it is indexed and the
  // filter never matched (the write that was supposed to change the document
  // did not land). Re-ask once without the filter so the error says which --
  // otherwise every owner/tag indexing race reads as an unexplained 60s hang.
  const unfiltered = await apiContext
    .get(
      `/api/v1/search/query?q=${encodeURIComponent(
        query
      )}&index=${index}&from=0&size=10`
    )
    .then((res) => (res.ok() ? res.json() : undefined))
    .catch(() => undefined);
  const indexedDoc = unfiltered?.hits?.hits?.find(
    (hit: { _source?: { fullyQualifiedName?: string } }) =>
      hit._source?.fullyQualifiedName === entityFqn
  );
  const diagnosis = indexedDoc
    ? 'the document is indexed, so the filter did not match it -- check that the write landed'
    : 'the document is not in the index at all';

  throw new Error(
    `Entity "${entityFqn}" not found with the expected search metadata in index "${index}" after ${timeout}ms (${diagnosis}). Filter: ${options.queryFilter}`
  );
};

/**
 * Polls the search API until the entity's search document reflects the given
 * owner state — the document refreshes asynchronously after an owner PATCH,
 * so gate on this before any UI read. `owners` is a nested field, hence the
 * `nested` query (a plain term query silently matches nothing).
 */
export const waitForOwnerIndexed = async (
  page: Page,
  entityFqn: string | undefined,
  index: string,
  ownerId: string,
  present: boolean,
  options?: { timeout?: number; intervals?: number[] }
) => {
  const ownerQuery = {
    nested: {
      path: 'owners',
      query: { term: { 'owners.id': ownerId } },
    },
  };
  const { apiContext, afterAction } = await getApiContext(page);

  try {
    await waitForSearchIndexed(apiContext, entityFqn, index, {
      timeout: options?.timeout ?? 60_000,
      intervals: options?.intervals,
      queryFilter: JSON.stringify({
        query: present ? ownerQuery : { bool: { must_not: [ownerQuery] } },
      }),
    });
  } finally {
    await afterAction();
  }
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

/**
 * Polls the search API until an owner's asset count reaches `expectedCount`.
 *
 * Ownership PATCHes re-index asynchronously, and the team page reads its asset
 * count once on load without ever refreshing it, so opening the page before the
 * index catches up pins the badge at a stale value for the life of the page.
 */
export const waitForOwnedAssetCount = async (
  apiContext: APIRequestContext,
  ownerId: string | undefined,
  expectedCount: number,
  options?: { timeout?: number; intervals?: number[] }
) => {
  if (!ownerId) {
    throw new Error('waitForOwnedAssetCount called with empty owner id');
  }

  const timeout = options?.timeout ?? 30_000;
  const intervals = options?.intervals ?? [500, 1_000, 2_000, 5_000];
  const start = Date.now();
  let intervalIdx = 0;
  let lastTotal = -1;

  // Mirrors the query the team page issues for its assets count, down to the
  // nested wrapper `owners` requires, so a match here is the number the badge
  // will render rather than an approximation of it.
  const queryFilter = encodeURIComponent(
    JSON.stringify({
      query: {
        bool: {
          must: [
            {
              nested: {
                path: 'owners',
                query: { term: { 'owners.id': ownerId } },
              },
            },
          ],
          must_not: [
            { term: { entityType: 'tableColumn' } },
            { term: { entityType: 'dataProduct' } },
          ],
        },
      },
    })
  );

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      `/api/v1/search/query?q=&index=all&from=0&size=0&query_filter=${queryFilter}`
    );
    const data = await okJson<{ hits?: { total?: { value?: number } } }>(
      response,
      `Owned asset indexing readiness for ${ownerId}`
    );
    lastTotal = data.hits?.total?.value ?? 0;
    if (lastTotal >= expectedCount) {
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
    `Owner "${ownerId}" had ${lastTotal} indexed assets, expected at least ${expectedCount}, after ${timeout}ms`
  );
};
