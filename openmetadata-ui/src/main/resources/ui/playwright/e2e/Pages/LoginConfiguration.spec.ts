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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { redirectToHomePage, toastNotification } from '../../utils/common';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Login configuration', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.LOGIN_CONFIGURATION);
  });

  test('update login configuration should work', async ({ page }) => {
    // Click the edit button
    await page.click('[data-testid="edit-button"]');

    // Update JWT Token Expiry Time
    await page.fill('[data-testid="jwtTokenExpiryTime"]', '5000');

    // Update Access Block Time
    await page.fill('[data-testid="accessBlockTime"]', '500');

    // Update Max Login Fail Attempts
    await page.fill('[data-testid="maxLoginFailAttempts"]', '5');

    // Click the save button
    await page.click('[data-testid="save-button"]');

    // Assert the updated values
    await expect(
      page.locator('[data-testid="max-login-fail-attampts"]')
    ).toHaveText('5');
    await expect(page.locator('[data-testid="access-block-time"]')).toHaveText(
      '500'
    );
    await expect(
      page.locator('[data-testid="jwt-token-expiry-time"]')
    ).toHaveText('5000 Seconds');
  });

  test('reset login configuration should work', async ({ page }) => {
    // Click the edit button
    await page.click('[data-testid="edit-button"]');

    // Reset JWT Token Expiry Time
    await page.fill('[data-testid="jwtTokenExpiryTime"]', '3600');

    // Reset Access Block Time
    await page.fill('[data-testid="accessBlockTime"]', '600');

    // Reset Max Login Fail Attempts
    await page.fill('[data-testid="maxLoginFailAttempts"]', '3');

    // Click the save button
    await page.click('[data-testid="save-button"]');

    await toastNotification(
      page,
      'Login Configuration updated successfully.',
      'success'
    );

    // Assert the updated values
    await expect(
      page.locator('[data-testid="max-login-fail-attampts"]')
    ).toHaveText('3');
    await expect(page.locator('[data-testid="access-block-time"]')).toHaveText(
      '600'
    );
    await expect(
      page.locator('[data-testid="jwt-token-expiry-time"]')
    ).toHaveText('3600 Seconds');
  });
});
