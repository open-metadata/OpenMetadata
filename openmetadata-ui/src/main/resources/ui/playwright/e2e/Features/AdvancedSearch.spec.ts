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
import test from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { FIELDS, verifyAllConditions } from '../../utils/advancedSearch';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { addMultiOwner, assignTag, assignTier } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.describe('Advanced Search', { tag: '@advanced-search' }, () => {
  // use the admin user to login
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const user = new UserClass();
  const table = new TableClass();
  const topic = new TopicClass();

  let searchCriteria = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.setTimeout(150000);

    const { page, apiContext, afterAction } = await createNewPage(browser);
    await Promise.all([
      user.create(apiContext),
      table.create(apiContext),
      topic.create(apiContext),
    ]);

    // Add Owner & Tag to the table
    await table.visitEntityPage(page);
    await addMultiOwner({
      page,
      ownerNames: [user.getUserName()],
      activatorBtnDataTestId: 'edit-owner',
      resultTestId: 'data-assets-header',
      endpoint: table.endpoint,
      type: 'Users',
    });

    await assignTag(page, 'PersonalData.Personal');

    // Add Tier To the topic
    await topic.visitEntityPage(page);
    await assignTier(page, 'Tier1', topic.endpoint);

    // Update Search Criteria here
    searchCriteria = {
      'owners.displayName.keyword': user.getUserName(),
      'tags.tagFQN': 'PersonalData.Personal',
      'tier.tagFQN': 'Tier.Tier1',
      'service.displayName.keyword': table.service.name,
      'database.displayName.keyword': table.database.name,
      'databaseSchema.displayName.keyword': table.schema.name,
      'columns.name.keyword': 'email',
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.delete(apiContext);
    await table.delete(apiContext);
    await topic.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  FIELDS.forEach((field) => {
    test(`Verify All conditions for ${field.id} field`, async ({ page }) => {
      test.slow(true);

      await verifyAllConditions(page, field, searchCriteria[field.name]);
    });
  });
});
