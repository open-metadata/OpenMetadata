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
