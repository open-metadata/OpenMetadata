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
import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Search Insights Page', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should display search insights page with cluster stats', async ({
    page,
  }) => {
    const statsAPI = page.waitForResponse('/api/v1/search/stats');

    await settingClick(page, GlobalSettingOptions.SEARCH_INSIGHTS);

    const statsResponse = await statsAPI;

    expect(statsResponse.status()).toBe(200);

    const statsData = await statsResponse.json();

    // Verify cluster health card is displayed
    await expect(page.getByText('Cluster Health')).toBeVisible();

    // Verify total indexes card is displayed
    await expect(page.getByText('Total Indexes')).toBeVisible();
    await expect(
      page.getByText(statsData.totalIndexes.toString())
    ).toBeVisible();

    // Verify total documents card is displayed
    await expect(page.getByText('Total Documents')).toBeVisible();

    // Verify total size card is displayed
    await expect(page.getByText('Total Size')).toBeVisible();

    // Verify total shards card is displayed
    await expect(page.getByText('Total Shards')).toBeVisible();

    // Verify index details table is displayed
    await expect(page.getByText('Index Details')).toBeVisible();

    // Verify the table has expected columns
    await expect(page.getByText('Index Name')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Size' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Health' })
    ).toBeVisible();
  });

  test('should display orphan indexes section', async ({ page }) => {
    const statsAPI = page.waitForResponse('/api/v1/search/stats');

    await settingClick(page, GlobalSettingOptions.SEARCH_INSIGHTS);

    await statsAPI;

    // Verify orphan indexes section is displayed
    await expect(page.getByText('Orphan Indexes')).toBeVisible();
  });

  test('should refresh stats when clicking refresh button', async ({
    page,
  }) => {
    await settingClick(page, GlobalSettingOptions.SEARCH_INSIGHTS);

    // Wait for initial load
    await page.waitForResponse('/api/v1/search/stats');

    // Click refresh button and verify API is called
    const refreshAPI = page.waitForResponse('/api/v1/search/stats');
    await page.getByRole('button', { name: 'Refresh' }).click();

    const refreshResponse = await refreshAPI;

    expect(refreshResponse.status()).toBe(200);
  });

  test('should verify isSearchIndexingRunning field in stats response', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);

    // Call the stats API directly
    const response = await apiContext.get('/api/v1/search/stats');

    expect(response.status()).toBe(200);

    const statsData = await response.json();

    // Verify isSearchIndexingRunning field exists in response
    expect(statsData).toHaveProperty('isSearchIndexingRunning');
    expect(typeof statsData.isSearchIndexingRunning).toBe('boolean');
  });

  test('should return 409 when trying to clean orphans while indexing is running', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);

    // First check if indexing is running
    const statsResponse = await apiContext.get('/api/v1/search/stats');
    const statsData = await statsResponse.json();

    if (statsData.isSearchIndexingRunning) {
      // If indexing is running, verify cleanup returns 409
      const cleanupResponse = await apiContext.delete(
        '/api/v1/search/stats/orphan'
      );

      expect(cleanupResponse.status()).toBe(409);
    } else {
      // If indexing is not running and there are orphan indexes, cleanup should succeed
      if (statsData.orphanIndexes && statsData.orphanIndexes.length > 0) {
        const cleanupResponse = await apiContext.delete(
          '/api/v1/search/stats/orphan'
        );

        expect(cleanupResponse.status()).toBe(200);

        const cleanupData = await cleanupResponse.json();

        expect(cleanupData).toHaveProperty('deletedCount');
        expect(cleanupData).toHaveProperty('deletedIndexes');
      }
    }
  });

  test('should show clean orphan indexes button when orphans exist', async ({
    page,
  }) => {
    const statsAPI = page.waitForResponse('/api/v1/search/stats');

    await settingClick(page, GlobalSettingOptions.SEARCH_INSIGHTS);

    const statsResponse = await statsAPI;
    const statsData = await statsResponse.json();

    if (statsData.orphanIndexes && statsData.orphanIndexes.length > 0) {
      // If orphan indexes exist, the clean button should be visible
      await expect(
        page.getByRole('button', { name: 'Clean Orphan Indexes' })
      ).toBeVisible();
    } else {
      // If no orphan indexes, should show "no orphan indexes" message
      await expect(page.getByText('No orphan indexes found')).toBeVisible();
    }
  });

  test('should open confirmation modal when clicking clean orphan indexes', async ({
    page,
  }) => {
    const statsAPI = page.waitForResponse('/api/v1/search/stats');

    await settingClick(page, GlobalSettingOptions.SEARCH_INSIGHTS);

    const statsResponse = await statsAPI;
    const statsData = await statsResponse.json();

    if (statsData.orphanIndexes && statsData.orphanIndexes.length > 0) {
      // Click clean orphan indexes button
      await page.getByRole('button', { name: 'Clean Orphan Indexes' }).click();

      // Verify confirmation modal is displayed
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByText('Clean Orphan Indexes', { exact: true })
      ).toBeVisible();

      // Verify cancel and delete buttons are in the modal
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

      // Close modal by clicking cancel
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    }
  });
});
