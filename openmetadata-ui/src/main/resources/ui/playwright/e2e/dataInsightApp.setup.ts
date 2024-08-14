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
});

const table = new TableClass();

setup(
  'Run Data Insight application and wait until success',
  async ({ page }) => {
    await redirectToHomePage(page);

    const { apiContext, afterAction } = await getApiContext(page);

    await table.create(apiContext);

    apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id ?? ''}`, {
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
    });

    await apiContext.post('/api/v1/apps/trigger/DataInsightsApplication');

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
          timeout: 3600_000,
          intervals: [300_000],
        }
      )
      .toBe('success');

    await table.delete(apiContext);

    await afterAction();
  }
);
