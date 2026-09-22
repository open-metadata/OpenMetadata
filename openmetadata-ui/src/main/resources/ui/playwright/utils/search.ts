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
import { expect, type Page } from '@playwright/test';
import { performAdminLogin } from './admin';

export const waitForEntitySearchable = async (
  page: Page,
  index: string,
  query: string,
  expectedId: string
) => {
  const browser = page.context().browser();
  if (!browser) {
    throw new Error('Browser instance is not available for admin API search');
  }

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            `/api/v1/search/query?q=${encodeURIComponent(query)}`,
            {
              params: {
                deleted: false,
                from: 0,
                index,
                size: 10,
              },
            }
          );

          if (!response.ok()) {
            return false;
          }

          const payload = await response.json();

          return (
            payload?.hits?.hits?.some(
              (hit: { _source?: { id?: string } }) =>
                hit._source?.id === expectedId
            ) ?? false
          );
        },
        {
          intervals: [1_000, 2_000, 5_000],
          timeout: 60_000,
        }
      )
      .toBe(true);
  } finally {
    await afterAction();
  }
};

/**
 * Wait until Elasticsearch reflects a domain's asset count via the same
 * `/api/v1/domains/assets/counts` aggregation the Domains landing-page widget
 * and the domain detail assets tab read.
 *
 * Asset add/remove mutations return before the search index is refreshed, and
 * every UI surface that shows the count fetches it exactly once per page load
 * with no background refetch — so a `page.reload()`/navigation issued too soon
 * snapshots the stale count and the subsequent DOM poll can never recover.
 * Gating on this API poll guarantees the index has propagated before any UI
 * read, making the count assertions deterministic.
 */
export const waitForDomainAssetCount = async (
  page: Page,
  domainFqn: string,
  expectedCount: number
) => {
  const browser = page.context().browser();
  if (!browser) {
    throw new Error('Browser instance is not available for admin API search');
  }

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            '/api/v1/domains/assets/counts'
          );

          if (!response.ok()) {
            return null;
          }

          const payload = (await response.json()) as Record<string, number>;

          return payload[domainFqn] ?? null;
        },
        {
          intervals: [1_000, 2_000, 5_000],
          timeout: 60_000,
        }
      )
      .toBe(expectedCount);
  } finally {
    await afterAction();
  }
};
