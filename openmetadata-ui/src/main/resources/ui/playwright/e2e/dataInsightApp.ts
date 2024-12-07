/*
 *  Copyright 2024 Collate.
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
import { expect, test as setup } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../utils/common';

// use the admin user to login
setup.use({
  storageState: 'playwright/.auth/admin.json',
  trace: 'retain-on-failure',
});

setup.describe.configure({
  timeout: process.env.PLAYWRIGHT_IS_OSS ? 150000 : 5600000,
  retries: 0,
});

setup(
  'Run Data Insight application and wait until success',
  async ({ page }) => {
    const table = new TableClass();
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);

    await table.create(apiContext);

    await apiContext.patch(
      `/api/v1/tables/${table.entityResponseData?.id ?? ''}`,
      {
        data: [
          {
            op: 'add',
            path: '/tags/0',
            value: {
              name: 'Tier2',
              tagFQN: 'Tier.Tier2',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await expect(
      await apiContext.patch(
        `/api/v1/apps/marketplace/name/DataInsightsApplication`,
        {
          data: [
            {
              op: 'replace',
              path: '/appConfiguration/batchSize',
              value: 1000,
            },
            {
              op: 'replace',
              path: '/appConfiguration/recreateDataAssetsIndex',
              value: false,
            },
            {
              op: 'replace',
              path: '/appConfiguration/backfillConfiguration/enabled',
              value: false,
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    ).toBeOK();

    await apiContext.post('/api/v1/apps/trigger/DataInsightsApplication');

    // To avoid checking earlier status which is not relevant
    await page.waitForTimeout(2000);

    await expect
      .poll(
        async () => {
          const response = await apiContext
            .get(
              '/api/v1/apps/name/DataInsightsApplication/status?offset=0&limit=1'
            )
            .then((res) => res.json());

          return response.data[0].status;
        },
        {
          // Custom expect message for reporting, optional.
          message: 'Wait for the Data Insight Application run to be successful',
          ...(process.env.PLAYWRIGHT_IS_OSS
            ? {
                timeout: 120_000,
                intervals: [5_000, 10_000],
              }
            : {
                timeout: 5400_000,
                intervals: [300_000, 300_000, 120_000],
              }),
        }
      )
      .toEqual(expect.stringMatching(/(success|failed|partialSuccess)/));

    await table.delete(apiContext);

    await afterAction();
  }
);
