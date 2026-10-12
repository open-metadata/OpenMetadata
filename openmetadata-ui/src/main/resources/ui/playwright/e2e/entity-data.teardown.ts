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
import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { EntityDataClass } from '../support/entity/EntityDataClass';
import { LineageDataClass } from '../support/entity/LineageDataClass';
import { SharedInfra } from '../support/entity/SharedInfra';
import { performAdminLogin } from '../utils/admin';

teardown('cleanup entity data prerequisites', async ({ browser }) => {
  teardown.setTimeout(300 * 1000);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    // Delete order matters:
    //   1) Lineage leaves — free their references to SharedInfra parents.
    //   2) SharedInfra.reset() — hard-delete the shared parent services
    //      (databaseService, messagingService, dashboardService, …) and
    //      remove the shared-infra JSON.
    //   3) EntityDataClass — remove tag / domain / user prerequisites.
    // Each layer uses Promise.allSettled internally so a missing entity
    // does not raise.
    await LineageDataClass.delete(apiContext);
    await SharedInfra.reset(apiContext);
    await EntityDataClass.postRequisitesForTests(apiContext);

    const entityFilePath = path.join(
      __dirname,
      '..',
      'output',
      'entity-response-data.json'
    );
    const lineageFilePath = path.join(
      __dirname,
      '..',
      'output',
      'lineage-data.json'
    );

    // Remove response-data files if they exist. Ignore missing files.
    // (shared-infra.json is removed inside SharedInfra.reset above.)
    for (const filePath of [entityFilePath, lineageFilePath]) {
      try {
        fs.rmSync(filePath, { force: true });
      } catch (err) {
        // Ignore any errors during file deletion
      }
    }
  } finally {
    await afterAction();
  }
});
