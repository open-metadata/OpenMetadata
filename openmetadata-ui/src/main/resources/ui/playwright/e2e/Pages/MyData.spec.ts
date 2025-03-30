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
import { redirectToHomePage, removeLandingBanner } from '../../utils/common';
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

test.describe.serial('My Data page', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    const tablePromises = TableEntities.map(async (table) => {
      await table.create(apiContext);
      await table.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: user.responseData.id,
              type: 'user',
              deleted: false,
              displayName: user.responseData.displayName,
              fullyQualifiedName: user.responseData.fullyQualifiedName,
              href: user.responseData['href'] ?? '',
              name: user.responseData.name,
            },
          },
        ],
      });
      await table.followTable(apiContext, user.responseData.id);
    });

    await Promise.all(tablePromises);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.delete(apiContext);

    await Promise.all(TableEntities.map((table) => table.delete(apiContext)));
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
    await removeLandingBanner(page);
  });

  test('Verify my data widget', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify total count
    await expect(
      page.locator('[data-testid="my-data-total-count"]')
    ).toContainText('(20)');

    await page
      .locator('[data-testid="my-data-widget"] [data-testid="view-all-link"]')
      .click();

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify entities
    await verifyEntities(
      page,
      '/api/v1/search/query?q=*&index=all&from=0&size=25*',
      TableEntities
    );
  });

  test('Verify following widget', async ({ page }) => {
    // Verify total count
    await expect(
      page.locator('[data-testid="following-data-total-count"]')
    ).toContainText('(20)');

    await page.locator('[data-testid="following-data"]').click();

    // Verify entities
    await verifyEntities(
      page,
      '/api/v1/search/query?q=*followers:*&index=all&from=0&size=25*',
      TableEntities
    );
  });
});
