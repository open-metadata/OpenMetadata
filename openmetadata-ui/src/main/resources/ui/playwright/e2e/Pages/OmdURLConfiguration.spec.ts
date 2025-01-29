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
import { redirectToHomePage, toastNotification } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('OM URL configuration', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.OM_URL_CONFIG);
  });

  test('update om url configuration should work', async ({ page }) => {
    // Click the edit button
    await page.click('[data-testid="edit-button"]');

    // Update OM URL
    await page.fill(
      '[data-testid="open-metadata-url-input"]',
      'http://localhost:8080'
    );

    const res = page.waitForResponse('/api/v1/system/settings');
    await page.click('[data-testid="save-button"]');
    await res;

    await toastNotification(
      page,
      /OpenMetadata URL Configuration updated successfully./
    );

    await expect(page.locator('[data-testid="open-metadata-url"]')).toHaveText(
      'http://localhost:8080'
    );
  });
});
