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

import { expect, Page, test as base } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { settingClick, sidebarClick } from '../../utils/sidebar';

const adminUser = new UserClass();
const dataConsumerUser = new UserClass();

const test = base.extend<{
  page: Page;
  dataConsumerPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await dataConsumerUser.create(apiContext);

  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await dataConsumerUser.delete(apiContext);

  await afterAction();
});

test.describe('Online Users Feature', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should show online users under Settings > Members > Online Users for admins', async ({
    page,
  }) => {
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await page.waitForLoadState('networkidle');

    // Verify we're on the Online Users page
    await expect(
      page.getByRole('heading', { name: 'Online Users' })
    ).toBeVisible();

    // Verify the online users table is displayed
    await expect(page.getByTestId('online-users-table')).toBeVisible();

    // Verify table headers
    await expect(page.getByText('Username')).toBeVisible();
    await expect(page.getByText('Last Activity')).toBeVisible();
    await expect(page.getByText('Teams')).toBeVisible();
    await expect(page.getByText('Roles')).toBeVisible();

    // Check for time filter dropdown (labeled as "Time window:")
    const timeWindowText = page.getByText('Time window:');

    await expect(timeWindowText).toBeVisible();

    // The dropdown component should be visible (it's an Ant Design Select, not a native select)
    const timeFilterDropdown = page
      .locator('.ant-select')
      .filter({ hasText: /Last \d+ hours/ });

    await expect(timeFilterDropdown).toBeVisible();

    // Current selection should show "Last 24 hours" by default
    await expect(timeFilterDropdown).toContainText('Last 24 hours');
  });

  test('Should update user activity time when user navigates', async ({
    page,
  }) => {
    // First, navigate around to generate activity
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');

    await sidebarClick(page, SidebarItem.DATA_QUALITY);
    await page.waitForLoadState('networkidle');

    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await page.waitForLoadState('networkidle');

    // Admin user should appear in the online users list
    const adminLink = page.locator('a').filter({ hasText: 'admin' }).first();

    await expect(adminLink).toBeVisible();

    // Check that admin user shows as "Online now" since we just navigated
    const adminRow = page.locator('tr').filter({ has: adminLink });

    await expect(adminRow.getByText('Online now')).toBeVisible();
  });

  test('Should not show bots in online users list', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await page.waitForLoadState('networkidle');

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
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await page.waitForLoadState('networkidle');

    // Find the time filter dropdown by looking for the one that contains "Last"
    const timeFilterDropdown = page
      .getByTestId('time-window-select')
      .filter({ hasText: /Last \d+ hours|Last hour|Last \d+ days|All time/ });

    // Verify default filter is "Last 24 hours"
    await expect(timeFilterDropdown).toContainText('Last 24 hours');

    // Click on the time filter dropdown
    await timeFilterDropdown.click();

    // Verify dropdown options are visible
    const dropdownOptions = page.locator('.ant-select-dropdown:visible');

    await expect(dropdownOptions.getByText('Last 5 minutes')).toBeVisible();
    await expect(dropdownOptions.getByText('Last hour')).toBeVisible();
    await expect(dropdownOptions.getByText('Last 24 hours')).toBeVisible();

    const onlineRes = page.waitForResponse(
      '/api/v1/users/online?timeWindow=60&*'
    );

    // Select a different time window
    await dropdownOptions.getByText('Last hour').click();
    await onlineRes;

    // Verify the filter has changed
    await expect(timeFilterDropdown).toContainText('Last hour');

    // The table should exist (with or without data)
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('Non-admin users should not see Online Users page', async ({
    dataConsumerPage,
  }) => {
    // Use the existing dataConsumer auth
    await redirectToHomePage(dataConsumerPage);
    await sidebarClick(dataConsumerPage, SidebarItem.SETTINGS);

    await dataConsumerPage.getByTestId('members').click();
    await dataConsumerPage.waitForLoadState('networkidle');

    await expect(
      dataConsumerPage.getByTestId('members.online-users')
    ).not.toBeVisible();
  });

  test('Should show correct last activity format', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.ONLINE_USERS);
    await page.waitForLoadState('networkidle');
    // Check various time formats in the Last Activity column
    const activityCells = page.locator('tbody tr td:nth-child(2)');
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
});
