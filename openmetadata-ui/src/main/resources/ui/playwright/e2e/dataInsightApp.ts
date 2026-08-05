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
import { test as setup } from '@playwright/test';
import { TableClass } from '../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../utils/common';
import { runDataInsightApplication } from '../utils/dataInsight';

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

    await runDataInsightApplication(page, apiContext);

    await table.delete(apiContext);

    await afterAction();
  }
);
