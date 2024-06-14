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
import { GlobalSettingOptions } from '../../constant/settings';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import {
  hardDeleteUserProfilePage,
  restoreUserProfilePage,
  softDeleteUserProfilePage,
} from '../../utils/user';

const user = new UserClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('User with different Roles', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user.create(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit user list page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Admin soft & hard delete and restore user from profile page', async ({
    page,
  }) => {
    await settingClick(page, GlobalSettingOptions.USERS);
    await softDeleteUserProfilePage(
      page,
      user.responseData.name,
      user.responseData.displayName
    );

    await restoreUserProfilePage(page, user.responseData.fullyQualifiedName);
    await hardDeleteUserProfilePage(page, user.responseData.displayName);
  });
});
