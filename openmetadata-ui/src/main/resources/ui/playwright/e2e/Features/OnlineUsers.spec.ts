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

test.describe('Online Users Feature', () => {
  // Use admin authentication for all tests
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test('Should show online users under Settings > Members > Online Users for admins', async ({
    page,
  }) => {
    // Navigate directly to Online Users page
    await page.goto('/settings/members/online-users');

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
  });

  test('Should show time filter dropdown for online users', async ({
    page,
  }) => {
    // Navigate to Online Users page
    await page.goto('/settings/members/online-users');

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
    await page.goto('/explore/tables');
    await page.waitForTimeout(500);

    await page.goto('/data-quality');
    await page.waitForTimeout(500);

    // Now check online users
    await page.goto('/settings/members/online-users');

    // Admin user should appear in the online users list
    const adminLink = page.locator('a').filter({ hasText: 'admin' }).first();

    await expect(adminLink).toBeVisible();

    // Check that admin user shows as "Online now" since we just navigated
    const adminRow = page.locator('tr').filter({ has: adminLink });

    await expect(adminRow.getByText('Online now')).toBeVisible();
  });

  test('Should not show bots in online users list', async ({ page }) => {
    // Navigate to Online Users page
    await page.goto('/settings/members/online-users');

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
    // Navigate to online users
    await page.goto('/settings/members/online-users');

    // Wait for initial data to load
    await page.waitForSelector('.ant-spin-container', { state: 'attached' });
    await page.waitForSelector('.ant-spin-spinning', {
      state: 'hidden',
      timeout: 10000,
    });

    // Find the time filter dropdown by looking for the one that contains "Last"
    const timeFilterDropdown = page
      .locator('.ant-select')
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

    // Select a different time window
    await dropdownOptions.getByText('Last hour').click();

    // Wait for filter to be applied
    await page.waitForSelector('.ant-spin-spinning', {
      state: 'hidden',
      timeout: 10000,
    });

    // Verify the filter has changed
    await expect(timeFilterDropdown).toContainText('Last hour');

    // The table should exist (with or without data)
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('Non-admin users should not see Online Users page', async ({
    browser,
  }) => {
    // Use the existing dataConsumer auth
    const userContext = await browser.newContext({
      storageState: 'playwright/.auth/dataConsumer.json',
    });
    const userPage = await userContext.newPage();

    try {
      // Try to navigate to Online Users page
      await userPage.goto('/settings/members/online-users');

      // Wait for page to load
      await userPage.waitForLoadState('domcontentloaded');

      // Should see the permission denied message
      await expect(
        userPage.getByText("You don't have necessary permissions.")
      ).toBeVisible();
      await expect(
        userPage.getByText('Please check with the admin to get the permission.')
      ).toBeVisible();
    } finally {
      await userContext.close();
    }
  });

  test('Should show correct last activity format', async ({ page }) => {
    // Navigate to online users
    await page.goto('/settings/members/online-users');

    // Wait for table to finish loading (wait for spinner to disappear)
    await page.waitForSelector('.ant-spin-spinning', {
      state: 'hidden',
      timeout: 10000,
    });

    // Wait for table rows to appear
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    // Give a bit more time for data to populate
    await page.waitForTimeout(500);

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

  test('Should navigate to Online Users from Members page', async ({
    page,
  }) => {
    // Navigate to Settings Members page directly
    await page.goto('/settings/members');

    // Look for and click the Online Users card
    const onlineUsersCard = page.locator('.ant-card').filter({
      hasText: 'Online Users',
    });

    await expect(onlineUsersCard).toBeVisible();

    await onlineUsersCard.click();

    // Verify we're on the Online Users page
    await expect(page).toHaveURL(/.*\/settings\/members\/online-users/);
    await expect(
      page.getByRole('heading', { name: 'Online Users' })
    ).toBeVisible();
  });
});
