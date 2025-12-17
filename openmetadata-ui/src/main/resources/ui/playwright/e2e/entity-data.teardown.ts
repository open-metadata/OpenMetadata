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
import { test as teardown } from './base';
import * as fs from 'fs';
import * as path from 'path';
import { EntityDataClass } from '../support/entity/EntityDataClass';
import { performAdminLogin } from '../utils/admin';

teardown('cleanup entity data prerequisites', async ({ browser }) => {
  teardown.setTimeout(300 * 1000);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await EntityDataClass.postRequisitesForTests(apiContext);

    const filePath = path.join(
      __dirname,
      '..',
      'output',
      'entity-response-data.json'
    );

    // Remove file if it exists using synchronous deletion with force option
    try {
      fs.rmSync(filePath, { force: true });
    } catch (err) {
      // Ignore any errors during file deletion
    }
  } finally {
    await afterAction();
  }
});
