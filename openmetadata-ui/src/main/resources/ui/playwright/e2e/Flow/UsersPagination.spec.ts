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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const adminUser = new UserClass();
const users: UserClass[] = [];

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Soft Delete User Pagination', () => {
  test.beforeAll('Creating and Soft Deleting 30 users', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);

    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    // Create and soft delete users
    for (let i = 0; i < 30; i++) {
      const testUser = new UserClass();
      await testUser.create(apiContext);
      await testUser.delete(apiContext, false);
      users.push(testUser);
    }
    await afterAction();
  });

  test.beforeEach('Redirecting to user list', async ({ page }) => {
    await redirectToHomePage(page);
    const userResponsePromise = page.waitForResponse(
      '/api/v1/users?*include=non-deleted'
    );

    await settingClick(page, GlobalSettingOptions.USERS);
    await userResponsePromise;
  });

  test('Testing user API calls and pagination', async ({ page }) => {
    const expectedUrl =
      '**/api/v1/users?isBot=false&fields=profile%2Cteams%2Croles&limit=25&isAdmin=false&include=deleted';

    const deletedUserResponsePromise = page.waitForResponse(expectedUrl);

    await page.click('[data-testid="show-deleted"]');

    const response = await deletedUserResponsePromise;

    expect(response.ok()).toBeTruthy();

    const nextButton = page.locator('[data-testid="next"]');
    const expectedUrlPattern =
      /\/api\/v1\/users\?isBot=false&fields=profile%2Cteams%2Croles&limit=25&isAdmin=false&after=.*?&include=deleted/;

    const paginatedResponsePromise = page.waitForResponse((response) => {
      const url = response.url();

      return expectedUrlPattern.test(url);
    });
    await nextButton.click();
    const paginatedResponse = await paginatedResponsePromise;

    expect(paginatedResponse.ok()).toBeTruthy();
  });
});
