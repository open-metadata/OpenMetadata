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

import { DOMAIN_TAGS } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { switchActivityFeed, visitInbox } from '../../utils/inbox';
import { expect, test } from '../fixtures/pages';

// A conversation started on a column is stored as
// <#E::table::<fqn>::columns::<column>::description>. Both feeds must list it
// under the table and name the column and field: table › column › Description.
test.describe(
  'Activity feed — conversation on a column',
  { tag: ['@Features', DOMAIN_TAGS.DISCOVERY] },
  () => {
    const table = new TableClass();
    const message = `column thread ${uuid()}`;
    let conversationId = '';
    let columnName = '';

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);
      const tableFqn = table.entityResponseData.fullyQualifiedName;
      columnName = table.entityResponseData.columns[0].name;

      const response = await apiContext.post('/api/v1/conversations', {
        data: {
          message,
          about: `<#E::table::${tableFqn}::columns::${columnName}::description>`,
        },
      });
      expect(response.ok()).toBeTruthy();
      conversationId = (await response.json()).id;
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('lists it on the table Activity Feeds tab with its column and field', async ({
      page,
    }) => {
      await table.visitEntityPage(page);
      await page.getByTestId('activity_feed').click();
      await waitForAllLoadersToDisappear(page);

      const card = page.locator(
        `#feedData [data-conversation-id="${conversationId}"]`
      );

      await expect(card).toContainText(message);
      await expect(card.getByTestId('feed-field-path-column')).toHaveText(
        columnName
      );
      await expect(card.getByTestId('feed-field-path-field')).toHaveText(
        'Description'
      );
    });

    test('names its column and field on the Inbox card', async ({ page }) => {
      await visitInbox(page);
      await switchActivityFeed(page, 'All');

      const card = page
        .getByTestId('activity-feed-item')
        .filter({ hasText: message });

      await expect(
        card.getByRole('link', { name: columnName, exact: true })
      ).toBeVisible();
      await expect(card.getByTestId('feed-field-path-field')).toHaveText(
        'Description'
      );
    });
  }
);
