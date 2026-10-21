/*
 *  Copyright 2026 Collate.
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

import { expect, test } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

// A conversation started on a column is stored as
// <#E::table::<fqn>::columns::<column>::description>. The table's Activity
// Feeds tab must name the column and field after the table: table › column ›
// Description.
test.describe(
  'Activity feed — conversation on a column',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    const table = new TableClass();
    const message = `column thread ${uuid()}`;
    let columnName = '';

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      const tableFqn = table.entityResponseData.fullyQualifiedName;
      columnName = table.entityResponseData.columns[0].name;

      const response = await apiContext.post('/api/v1/feed', {
        data: {
          message,
          about: `<#E::table::${tableFqn}::columns::${columnName}::description>`,
          type: 'Conversation',
        },
      });
      expect(response.ok()).toBeTruthy();
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('lists it on the table Activity Feeds tab with its column and field', async ({
      page,
    }) => {
      await table.visitEntityPage(page);
      await page.getByTestId('activity_feed').click();
      await waitForAllLoadersToDisappear(page);

      const card = page
        .locator('#feedData .activity-feed-card-new')
        .filter({ hasText: message });

      await expect(card.getByTestId('feed-field-path-column')).toHaveText(
        columnName
      );
      await expect(card.getByTestId('feed-field-path-field')).toHaveText(
        'Description'
      );
    });
  }
);
