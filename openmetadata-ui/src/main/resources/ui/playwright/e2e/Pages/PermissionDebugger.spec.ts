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

const testUser = new UserClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Permission Debugger', () => {
  test.beforeAll('Setup test user', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await testUser.create(apiContext);
    await afterAction();
  });

  test('should display user displayName with username in dropdown and selected value', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.PERMISSION_DEBUGGER);

    await expect(page.locator('[data-testid="loader"]')).not.toBeVisible();

    const searchInput = page.locator('.ant-select-auto-complete input');
    await expect(searchInput).toBeVisible();

    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=user_search_index')
    );
    await searchInput.fill(testUser.data.firstName);
    await searchResponse;

    const userDisplayName = testUser.getUserDisplayName();
    const userName = testUser.getUserName();

    // Verify dropdown shows displayName with username in format: "DisplayName (username)"
    const userOption = page.locator('.ant-select-item-option').filter({
      hasText: `${userDisplayName} (${userName})`,
    });
    await expect(userOption).toBeVisible();

    const permissionResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/permissions/debug/user/') &&
        response.status() === 200
    );
    await userOption.click();
    await permissionResponse;

    // Verify the input field shows the full format: "DisplayName (username)"
    await expect(searchInput).toHaveValue(`${userDisplayName} (${userName})`);

    // Verify selected user text shows only displayName (not the username)
    const selectedUserText = page.getByTestId('selected-user');
    await expect(selectedUserText).toBeVisible();
    await expect(selectedUserText).toContainText(userDisplayName);
    await expect(selectedUserText).not.toContainText(`(${userName})`);
  });
});
