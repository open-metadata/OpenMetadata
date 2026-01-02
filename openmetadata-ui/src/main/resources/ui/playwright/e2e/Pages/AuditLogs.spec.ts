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
import { expect, Page, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

const navigateToAuditLogsPage = async (page: Page) => {
  await settingClick(page, GlobalSettingOptions.AUDIT_LOGS);
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Audit Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await navigateToAuditLogsPage(page);
  });

  test('should display page header with correct title and subtitle', async ({
    page,
  }) => {
    await test.step('Verify page header', async () => {
      const header = page.getByTestId('heading');
      await expect(header).toBeVisible();
      await expect(header).toHaveText('Audit Logs');
    });

    await test.step('Verify page sub-header', async () => {
      const subHeader = page.getByTestId('sub-heading');
      await expect(subHeader).toBeVisible();
      await expect(subHeader).toContainText(
        'Review who changed what by browsing persisted metadata change events'
      );
    });
  });

  test('should display all filter buttons', async ({ page }) => {
    await test.step('Verify User filter is visible', async () => {
      const userFilter = page.getByTestId('user-filter');
      await expect(userFilter).toBeVisible();
      await expect(userFilter).toHaveText('User');
    });

    await test.step('Verify Bot filter is visible', async () => {
      const botFilter = page.getByTestId('bot-filter');
      await expect(botFilter).toBeVisible();
      await expect(botFilter).toHaveText('Bot');
    });

    await test.step('Verify Service filter is visible', async () => {
      const serviceFilter = page.getByTestId('service-filter');
      await expect(serviceFilter).toBeVisible();
      await expect(serviceFilter).toHaveText('Service');
    });

    await test.step('Verify Asset filter is visible', async () => {
      const assetFilter = page.getByTestId('asset-filter');
      await expect(assetFilter).toBeVisible();
      await expect(assetFilter).toHaveText('Asset');
    });
  });

  test('should display audit logs table with correct columns', async ({
    page,
  }) => {
    await test.step('Verify table is visible', async () => {
      const table = page.getByTestId('audit-logs-table');
      await expect(table).toBeVisible();
    });

    await test.step('Verify table has correct columns', async () => {
      const table = page.getByTestId('audit-logs-table');
      await expect(
        table.locator('th').filter({ hasText: 'Timestamp' })
      ).toBeVisible();
      await expect(
        table.locator('th').filter({ hasText: 'User' })
      ).toBeVisible();
      await expect(
        table.locator('th').filter({ hasText: 'Event' })
      ).toBeVisible();
      await expect(
        table.locator('th').filter({ hasText: 'Entity' })
      ).toBeVisible();
      await expect(
        table.locator('th').filter({ hasText: 'Details' })
      ).toBeVisible();
    });
  });

  test('should open and close User filter popover', async ({ page }) => {
    const userFilter = page.getByTestId('user-filter');
    await userFilter.click();

    await test.step('Verify filter popover opens with search input', async () => {
      const popover = page.locator('.user-select-popover');
      await expect(popover).toBeVisible();

      const searchInput = popover.getByTestId('searchbar');
      await expect(searchInput).toBeVisible();
    });

    await test.step('Close popover by clicking filter button again', async () => {
      await userFilter.click();
      const popover = page.locator('.user-select-popover');
      await expect(popover).not.toBeVisible();
    });
  });

  test('should open and close Bot filter popover', async ({ page }) => {
    const botFilter = page.getByTestId('bot-filter');
    await botFilter.click();

    await test.step('Verify filter popover opens', async () => {
      const popover = page.locator('.user-select-popover');
      await expect(popover).toBeVisible();
    });

    await test.step('Close popover by clicking filter button again', async () => {
      await botFilter.click();
      const popover = page.locator('.user-select-popover');
      await expect(popover).not.toBeVisible();
    });
  });

  test('should open and close Service filter popover', async ({ page }) => {
    const serviceFilter = page.getByTestId('service-filter');
    await serviceFilter.click();

    await test.step('Verify filter popover opens', async () => {
      const popover = page.locator('.user-select-popover');
      await expect(popover).toBeVisible();
    });

    await test.step('Close popover by clicking filter button again', async () => {
      await serviceFilter.click();
      const popover = page.locator('.user-select-popover');
      await expect(popover).not.toBeVisible();
    });
  });

  test('should open and close Asset filter popover', async ({ page }) => {
    const assetFilter = page.getByTestId('asset-filter');
    await assetFilter.click();

    await test.step('Verify filter popover opens', async () => {
      const popover = page.locator('.user-select-popover');
      await expect(popover).toBeVisible();
    });

    await test.step('Close popover by clicking filter button again', async () => {
      await assetFilter.click();
      const popover = page.locator('.user-select-popover');
      await expect(popover).not.toBeVisible();
    });
  });

  test('should show Clear button when filter is active and clear filters', async ({
    page,
  }) => {
    await test.step('Clear button should not be visible initially', async () => {
      const clearButton = page.getByTestId('clear-filters');
      await expect(clearButton).not.toBeVisible();
    });

    await test.step('Select a user from filter', async () => {
      const userFilter = page.getByTestId('user-filter');
      await userFilter.click();

      const popover = page.locator('.user-select-popover');
      await expect(popover).toBeVisible();

      const searchInput = popover.getByTestId('searchbar');
      await searchInput.fill('admin');

      const firstItem = popover
        .getByTestId('selectable-list')
        .locator('.ant-list-item')
        .first();

      await firstItem.waitFor({ state: 'visible', timeout: 10000 });

      const auditLogResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/audit') && response.status() === 200
      );

      await firstItem.click();
      await auditLogResponse;
    });

    await test.step('Verify Clear button appears and works', async () => {
      const clearButton = page.getByTestId('clear-filters');
      await expect(clearButton).toBeVisible();

      const auditLogResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/audit') && response.status() === 200
      );
      await clearButton.click();
      await auditLogResponse;

      const userFilter = page.getByTestId('user-filter');
      await expect(userFilter).toHaveText('User');

      await expect(clearButton).not.toBeVisible();
    });
  });
});
