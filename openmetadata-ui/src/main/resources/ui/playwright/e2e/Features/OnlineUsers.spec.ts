/*
 *  Copyright 2025 Collate.
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

import { expect, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { getCellByName } from '../../utils/scopedLocators';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

let testUser: UserClass;

const ONLINE_USERS_PATH = '/settings/members/online-users';

const navigateToOnlineUsersPage = async (page: Page) => {
  const onlineUsersRes = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/users/online') &&
      response.request().method() === 'GET'
  );

  await page.goto(ONLINE_USERS_PATH, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(`**${ONLINE_USERS_PATH}**`, {
    waitUntil: 'domcontentloaded',
  });
  const onlineUsersResponse = await onlineUsersRes;

  expect(onlineUsersResponse.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('online-users-page')).toBeVisible();
  await expect(page.getByTestId('online-users-table')).toBeVisible();
};

test.describe('Online Users Feature', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    testUser = new UserClass();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testUser.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testUser.delete(apiContext);
    await afterAction();
  });

  test('Should update user activity time when user navigates', async ({
    browser,
    page,
  }) => {
    const userPage = await browser.newPage();
    try {
      await testUser.signIn(userPage);
      await redirectToHomePage(userPage);
      await sidebarClick(userPage, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(userPage);
    } finally {
      await userPage.close();
    }

    await navigateToOnlineUsersPage(page);

    const displayName = testUser.responseData.displayName;
    const searchResponse = page.waitForResponse(
      '/api/v1/search/query?q=*&index=user&from=0&size=*'
    );
    await page.getByTestId('searchbar').fill(displayName);
    await searchResponse;
    await waitForAllLoadersToDisappear(page);

    const userCell = getCellByName(page, displayName).first();
    await expect(userCell).toBeVisible();

    const userRow = page.locator('tr').filter({ has: userCell });
    const activityCell = userRow.locator('td:nth-child(3)');

    await expect(activityCell).toHaveText(
      /(Online now|\d+\s+(seconds?|minutes?)\s+ago)/
    );
  });

  test('Should show user displayName in online users table', async ({
    browser,
    page,
  }) => {
    test.slow(); // Mark this test as slow since it involves multiple logins and navigation
    await test.step('Visit Explore Page as New User', async () => {
      const userPage = await browser.newPage();
      await testUser.signIn(userPage);
      await redirectToHomePage(userPage);

      // 1 step - go to explore page using new user
      await sidebarClick(userPage, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(userPage);

      await userPage.close();
    });

    await test.step('Verify Online User as Admin', async () => {
      const displayName = testUser.responseData.displayName;

      // 2 step - go to online user page and check that user display name should present
      await navigateToOnlineUsersPage(page);

      // Search for the user to ensure it is visible in the list
      const searchResponse = page.waitForResponse(
        '/api/v1/search/query?q=*&index=user&from=0&size=*'
      );
      await page.getByTestId('searchbar').fill(displayName);
      await searchResponse;

      await waitForAllLoadersToDisappear(page);

      await expect(
        getCellByName(page, displayName).filter({ visible: true })
      ).not.toHaveCount(0);

      // Search by email should surface the same user
      const emailSearchResponse = page.waitForResponse(
        '/api/v1/search/query?q=*&index=user&from=0&size=*'
      );
      await page.getByTestId('searchbar').fill(testUser.data.email);
      await emailSearchResponse;

      await waitForAllLoadersToDisappear(page);

      await expect(
        getCellByName(page, displayName).filter({ visible: true })
      ).not.toHaveCount(0);
    });
  });
});
