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
import test, { expect } from '@playwright/test';
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const topic = new TopicClass();

test.slow(true);

test.describe('Topic entity specific tests ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await topic.create(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Topic page should show schema tab with count', async ({ page }) => {
    await topic.visitEntityPage(page);

    await expect(page.getByRole('tab', { name: 'Schema' })).toContainText('2');
  });
});
