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
import { EntityDataClass } from '../support/entity/EntityDataClass';
import { performAdminLogin } from '../utils/admin';

setup('create entity data prerequisites', async ({ browser }) => {
  setup.setTimeout(600 * 1000);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    // A weekly rebuild can otherwise change shared search results halfway through a CI shard.
    const response = await apiContext.patch(
      '/api/v1/apps/name/SearchIndexingApplication',
      {
        headers: { 'Content-Type': 'application/json-patch+json' },
        data: [
          {
            op: 'replace',
            path: '/appSchedule',
            value: { scheduleTimeline: 'None' },
          },
        ],
      }
    );
    expect(response.ok()).toBe(true);
    expect((await response.json()).appSchedule.scheduleTimeline).toBe('None');
    await EntityDataClass.preRequisitesForTests(apiContext);
    EntityDataClass.saveResponseData();
  } finally {
    await afterAction();
  }
});
