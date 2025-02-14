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
import { GlobalSettingOptions } from '../../constant/settings';
import { USER_DESCRIPTION } from '../../constant/user';
import { TeamClass } from '../../support/team/TeamClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { descriptionBox, redirectToHomePage, uuid } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import { redirectToUserPage } from '../../utils/userDetails';

const user1 = new UserClass();
const user2 = new UserClass();
const admin = new AdminClass();
const team = new TeamClass({
  name: `a-new-team-${uuid()}`,
  displayName: `A New Team ${uuid()}`,
  description: 'playwright team description',
  teamType: 'Group',
});

// Create 2 page and authenticate 1 with admin and another with normal user
const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user1.login(page);
    await use(page);
    await page.close();
  },
});

test.describe('User with different Roles', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await user1.create(apiContext);
    await user2.create(apiContext);

    await team.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await user1.delete(apiContext);
    await user2.delete(apiContext);

    await team.delete(apiContext);

    await afterAction();
  });

  test('Admin user can get all the teams hierarchy which editing teams', async ({
    adminPage,
  }) => {
    await redirectToUserPage(adminPage);

    // Check if the avatar is visible
    await expect(
      adminPage
        .getByTestId('user-profile-details')
        .getByTestId('profile-avatar')
    ).toBeVisible();

    await adminPage
      .locator('.user-profile-container [data-icon="right"]')
      .click();

    await expect(
      adminPage.getByTestId('user-team-card-container')
    ).toBeVisible();

    const teamListResponse = adminPage.waitForResponse(
      '/api/v1/teams/hierarchy?isJoinable=false'
    );

    await adminPage.getByTestId('edit-teams-button').click();

    await teamListResponse;

    await expect(adminPage.getByTestId('team-select')).toBeVisible();

    await adminPage.getByTestId('team-select').click();

    await adminPage.waitForSelector('.ant-tree-select-dropdown', {
      state: 'visible',
    });

    // Check if newly added team is there or not
    await expect(adminPage.locator('.ant-tree-select-dropdown')).toContainText(
      team.responseData.displayName
    );
  });

  test('Non admin user should be able to edit display name and description on own profile', async ({
    userPage,
  }) => {
    await redirectToUserPage(userPage);

    // Check if the display name is present
    await expect(
      userPage.getByTestId('user-profile-details').getByTestId('user-name')
    ).toHaveText(user1.responseData.displayName);

    // Remove the display name
    await userPage.getByTestId('edit-displayName').click();

    await userPage
      .getByTestId('inline-edit-container')
      .getByTestId('displayName')
      .clear();

    const removeDisplayName = userPage.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await userPage
      .getByTestId('inline-edit-container')
      .getByTestId('inline-save-btn')
      .click();

    await removeDisplayName;

    // Check if the display name is removed
    await expect(
      userPage.getByTestId('user-profile-details').getByTestId('user-name')
    ).not.toBeVisible();

    // Description edit checks
    await userPage
      .locator('.user-profile-container [data-icon="right"]')
      .click();

    // Check if the description is not present
    await expect(
      userPage.getByTestId('asset-description-container')
    ).toContainText('No description');

    await userPage
      .getByTestId('asset-description-container')
      .getByTestId('edit-description')
      .click();

    await userPage.waitForSelector('[role="dialog"].ant-modal', {
      state: 'visible',
    });

    // Add description content
    await userPage.locator(descriptionBox).fill(USER_DESCRIPTION);

    const addUserDescription = userPage.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await userPage
      .locator('.description-markdown-editor')
      .getByTestId('save')
      .click();

    await addUserDescription;

    // Check if the description is added
    await expect(
      userPage.getByTestId('asset-description-container')
    ).not.toContainText('No description');

    // Remove the description
    await userPage
      .getByTestId('asset-description-container')
      .getByTestId('edit-description')
      .click();

    await userPage.waitForSelector('[role="dialog"].ant-modal', {
      state: 'visible',
    });

    await userPage.click(descriptionBox);
    await userPage.keyboard.press('ControlOrMeta+A');
    await userPage.keyboard.press('Backspace');

    await expect(userPage.locator(descriptionBox)).not.toContainText(
      'Name of the User'
    );

    const removeUserDescription = userPage.waitForResponse(
      (response) => response.request().method() === 'PATCH'
    );

    await userPage
      .locator('.description-markdown-editor')
      .getByTestId('save')
      .click();

    await removeUserDescription;

    // Check if the description is removed
    await expect(
      userPage.getByTestId('asset-description-container')
    ).toContainText('No description');
  });

  test('Non admin user should not be able to edit the persona or roles', async ({
    userPage,
  }) => {
    await redirectToUserPage(userPage);

    // Check if the display name is present
    await expect(
      userPage.getByTestId('user-profile-details').getByTestId('user-name')
    ).toHaveText(user1.responseData.displayName);

    await userPage
      .locator('.user-profile-container [data-icon="right"]')
      .click();

    // Check for Roles field visibility
    await expect(userPage.getByTestId('user-profile-roles')).toBeVisible();

    // Edit Persona icon shouldn't be visible
    await expect(
      userPage.getByTestId('persona-list').getByTestId('edit-persona')
    ).not.toBeVisible();

    // Edit Roles icon shouldn't be visible
    await expect(userPage.getByTestId('edit-roles-button')).not.toBeVisible();
  });

  test('Non logged in user should not be able to edit display name and description on other users', async ({
    userPage,
    adminPage,
  }) => {
    // Checks for the admins
    await redirectToHomePage(adminPage);

    const fetchUserResponse = adminPage.waitForResponse('/api/v1/users?**');

    await settingClick(adminPage, GlobalSettingOptions.USERS);

    await fetchUserResponse;

    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const userSearchResponse = adminPage.waitForResponse(
      '/api/v1/search/query?q=**&from=0&size=*&index=*'
    );
    await adminPage.getByTestId('searchbar').fill(user2.responseData.name);
    await userSearchResponse;

    await adminPage.getByTestId(user2.responseData.name).click();

    await expect(
      adminPage
        .getByTestId('user-profile-details')
        .getByTestId('edit-displayName')
    ).not.toBeAttached();

    // Description edit checks
    await adminPage
      .locator('.user-profile-container [data-icon="right"]')
      .click();

    await expect(
      adminPage
        .getByTestId('asset-description-container')
        .getByTestId('edit-description')
    ).not.toBeAttached();

    // Checks for the normal user
    await redirectToHomePage(userPage);

    const fetchUserResponse2 = userPage.waitForResponse('/api/v1/users?**');

    await settingClick(userPage, GlobalSettingOptions.USERS);

    await fetchUserResponse2;

    await userPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const userResponse = userPage.waitForResponse(
      '/api/v1/search/query?q=**&from=0&size=*&index=*'
    );
    await userPage.getByTestId('searchbar').fill(user2.responseData.name);
    await userResponse;
    await userPage.getByTestId(user2.responseData.name).click();

    await expect(
      userPage
        .getByTestId('user-profile-details')
        .getByTestId('edit-displayName')
    ).not.toBeAttached();

    // Description edit checks
    await userPage
      .locator('.user-profile-container [data-icon="right"]')
      .click();

    await expect(
      userPage
        .getByTestId('asset-description-container')
        .getByTestId('edit-description')
    ).not.toBeAttached();
  });
});
