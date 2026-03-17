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
  entityFqn: string,
  index: string,
  options?: { timeout?: number; intervals?: number[] }
) => {
  const timeout = options?.timeout ?? 30_000;
  const intervals = options?.intervals ?? [500, 1_000, 2_000, 5_000];
  const start = Date.now();
  let intervalIdx = 0;

  while (Date.now() - start < timeout) {
    const response = await apiContext.get(
      `/api/v1/search/query?q=${encodeURIComponent(
        entityFqn
      )}&index=${index}&from=0&size=1`
    );

    if (response.ok()) {
      const data = await response.json();
      const totalHits =
        data?.hits?.total?.value ?? data?.hits?.total ?? 0;

      if (totalHits > 0) {
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
