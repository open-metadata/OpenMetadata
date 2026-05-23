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

import { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const testUser = new UserClass();

test.describe('Online Users Feature', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testUser.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await testUser.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should show online users under Settings > Members > Online Users for admins', async ({
    page,
  }) => {
    const onlineUsersRes = page.waitForResponse('/api/v1/users/online?*');
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await onlineUsersRes;

    await waitForAllLoadersToDisappear(page);

    // Verify we're on the Online Users page
    await expect(
      page.getByRole('heading', { name: 'Online Users' })
    ).toBeVisible();

    // Verify the online users table is displayed
    await expect(page.getByTestId('online-users-table')).toBeVisible();

    // Verify table headers
    await expect(
      page.getByRole('columnheader', { name: 'Username' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Last Activity' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Teams' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Roles' })
    ).toBeVisible();

    // Check for time filter dropdown (labeled as "Time window:")
    await expect(page.getByText('Time window:')).toBeVisible();

    // Current selection should show "Last 24 hours" by default
    const timeFilterDropdown = page.getByTestId('time-window-select');

    await expect(timeFilterDropdown).toContainText('Last 24 hours');
  });

  test('Should update user activity time when user navigates', async ({
    page,
  }) => {
    // First, navigate around to generate activity
    await sidebarClick(page, SidebarItem.EXPLORE);
    await waitForAllLoadersToDisappear(page);

    await sidebarClick(page, SidebarItem.DATA_QUALITY);
    await waitForAllLoadersToDisappear(page);

    const onlineUsersRes = page.waitForResponse('/api/v1/users/online?*');
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await onlineUsersRes;

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('online-users-table')).toBeVisible();

    // Admin user should appear in the online users list with recent activity
    const adminLink = page.locator('a').filter({ hasText: 'admin' }).first();

    await expect(adminLink).toBeVisible();

    // Check that admin user shows recent activity since we just navigated
    const adminRow = page.locator('tr').filter({ has: adminLink });
    const activityCell = adminRow.locator('td:nth-child(3)');

    await expect(activityCell).toHaveText(
      /(Online now|\d+\s+(seconds?|minutes?)\s+ago)/
    );
  });

  test('Should not show bots in online users list', async ({ page }) => {
    const onlineUsersRes = page.waitForResponse('/api/v1/users/online?*');
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await onlineUsersRes;

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('online-users-table')).toBeVisible();

    // Verify bot users are not shown (ingestion-bot should not be visible)
    const tableRows = page.locator('tbody tr');
    const rowCount = await tableRows.count();

    // Check each row doesn't contain bot users
    for (let i = 0; i < rowCount; i++) {
      const rowText = await tableRows.nth(i).textContent();

      expect(rowText).not.toContain('ingestion-bot');
    }
  });

  test('Should filter users by time window', async ({ page }) => {
    const onlineUsersRes = page.waitForResponse('/api/v1/users/online?*');
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await onlineUsersRes;

    await waitForAllLoadersToDisappear(page);

    const timeFilterDropdown = page.getByTestId('time-window-select');

    // Verify default filter is "Last 24 hours"
    await expect(timeFilterDropdown).toContainText('Last 24 hours');

    // Click on the time filter dropdown
    await timeFilterDropdown.click();

    // Wait for dropdown to fully render
    await page.locator('.ant-select-dropdown:visible').waitFor({
      state: 'visible',
    });

    await expect(
      page.locator('.ant-select-dropdown:visible [title="Last 5 minutes"]')
    ).toBeVisible();
    await expect(
      page.locator('.ant-select-dropdown:visible [title="Last hour"]')
    ).toBeVisible();
    await expect(
      page.locator('.ant-select-dropdown:visible [title="Last 24 hours"]')
    ).toBeVisible();

    const onlineRes = page.waitForResponse(
      '/api/v1/users/online?timeWindow=60&*'
    );

    // Select a different time window
    await page
      .locator('.ant-select-dropdown:visible [title="Last hour"]')
      .click();
    await onlineRes;

    // Verify the filter has changed
    await expect(timeFilterDropdown).toContainText('Last hour');

    // The table should exist (with or without data)
    await expect(page.getByTestId('online-users-table')).toBeVisible();
  });

  test('Non-admin users should not see Online Users page', async ({
    dataConsumerPage,
  }) => {
    await redirectToHomePage(dataConsumerPage);
    await sidebarClick(dataConsumerPage, SidebarItem.SETTINGS);

    await dataConsumerPage.getByTestId('members').click();
    await waitForAllLoadersToDisappear(dataConsumerPage);

    await expect(
      dataConsumerPage.getByTestId('members.online-users')
    ).toBeHidden();
  });

  test('Should show correct last activity format', async ({ page }) => {
    const onlineUsersRes = page.waitForResponse('/api/v1/users/online?*');
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await onlineUsersRes;

    await waitForAllLoadersToDisappear(page);
    // Check various time formats in the Last Activity column
    const activityCells = page.locator('tbody tr td:nth-child(3)');
    const count = await activityCells.count();

    // If no users are online within the time window, that's ok - just skip
    if (count === 0) {
      // Check that "No data" message is shown
      await expect(page.getByText('No data')).toBeVisible();

      return;
    }

    // Check first few activity times
    for (let i = 0; i < Math.min(count, 3); i++) {
      const text = await activityCells.nth(i).textContent();

      // Should contain either "Online now" or time format like "51 minutes ago"
      expect(text).toMatch(/(Online now|\d+\s+(minutes?|hours?|days?)\s+ago)/);
    }
  });

  test('Should show user displayName in online users table', async ({
    browser,
    page,
  }) => {
    await test.step('Visit Explore Page as New User', async () => {
      const userPage = await browser.newPage();
      await testUser.login(userPage);
      await redirectToHomePage(userPage);

      // 1 step - go to explore page using new user
      await sidebarClick(userPage, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(userPage);

      await userPage.close();
    });

    await test.step('Verify Online User as Admin', async () => {
      const displayName = testUser.responseData.displayName;

      // 2 step - go to online user page and check that user display name should present
      await settingClick(page, GlobalSettingOptions.ONLINE_USERS);

      await waitForAllLoadersToDisappear(page);

      // Search for the user to ensure it is visible in the list
      const searchResponse = page.waitForResponse(
        '/api/v1/search/query?q=*&index=user&from=0&size=*'
      );
      await page.getByTestId('searchbar').fill(displayName);
      await searchResponse;

      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByRole('cell', { name: displayName }).first()
      ).toBeVisible();
    });
  });
});
