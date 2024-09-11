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
import { expect, Page, test as base } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { addMultiOwner, followEntity } from '../../utils/entity';
import { verifyEntities } from '../../utils/myData';

const user = new UserClass();
const TableEntities = Array(20)
  .fill(undefined)
  .map(() => new TableClass());

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const Page = await browser.newPage();
    await user.login(Page);
    await use(Page);
    await Page.close();
  },
});

test.describe('My Data pag', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    for (const table of TableEntities) {
      await table.create(apiContext);
    }
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.delete(apiContext);
    for (const table of TableEntities) {
      await table.delete(apiContext);
    }
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Verify MyData and Following widget', async ({ page }) => {
    test.slow(true);

    await test.step(
      'Set user as the Owner of the Table and also Follow it',
      async () => {
        for (const table of TableEntities) {
          await table.visitEntityPage(page);
          await addMultiOwner({
            page,
            ownerNames: [user.getUserName()],
            activatorBtnDataTestId: 'edit-owner',
            resultTestId: 'data-assets-header',
            endpoint: table.endpoint,
            type: 'Users',
          });
          await followEntity(page, table.endpoint);
        }
      }
    );

    await test.step('Verify my data widget', async () => {
      await redirectToHomePage(page);
      // Verify total count
      const totalCount = await page
        .locator('[data-testid="my-data-total-count"]')
        .innerText();

      expect(totalCount).toBe('(20)');

      await page
        .locator('[data-testid="my-data-widget"] [data-testid="view-all-link"]')
        .click();

      // Verify entities
      await verifyEntities(
        page,
        '/api/v1/search/query?q=*&index=all&from=0&size=25',
        TableEntities
      );
    });

    await test.step('Verify following widget', async () => {
      await redirectToHomePage(page);
      // Verify total count
      const totalCount = await page
        .locator('[data-testid="following-data-total-count"]')
        .innerText();

      expect(totalCount).toBe('(20)');

      await page.locator('[data-testid="following-data"]').click();

      // Verify entities
      await verifyEntities(
        page,
        '/api/v1/search/query?q=*followers:*&index=all&from=0&size=25',
        TableEntities
      );
    });
  });

  test('Verify user as owner feed widget', async ({ page }) => {
    //
  });

  test('Verify team as owner feed widget', async ({ page }) => {
    //
  });
});
