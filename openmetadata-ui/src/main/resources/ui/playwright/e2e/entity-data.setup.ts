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
import { seedLineageAndSharedInfra } from './lineage-data.helper';

setup('create entity data prerequisites', async ({ browser }) => {
  // Doubled from the previous 600s: this now also runs the lineage +
  // SharedInfra seeding so the CI fixture cache contains
  // shared-infra.json/lineage-data.json (see the helper's file comment for
  // why this had to move here).
  setup.setTimeout(1200 * 1000);

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

    // Populate SharedInfra parents + LineageDataClass once here so that the
    // preseeded fixture (produced by the CI job that only invokes this
    // setup project) contains shared-infra.json and lineage-data.json.
    // Without this, every test worker under PW_PRESEEDED_STATE=true falls
    // back to POSTing fresh /services/* on first use — reintroducing the
    // "socket hang up" race SharedInfra was created to eliminate.
    await seedLineageAndSharedInfra(apiContext);
  } finally {
    await afterAction();
  }
});
