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
import { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Table & Data Model columns table pagination', () => {
  test('Page size should persist independently for Global and Asset lists', async ({
    dataConsumerPage: page,
  }) => {
    // 1. Visit Table Page (Asset List)
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Change Asset page size to 25
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '25 / Page', exact: true }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify 25 is selected
    // Note: If default logic changes, this ensures we explicitly set it to 25 for the test.
    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText('25 / Page');

    // 2. Go to Explore Page (Global List)
    await sidebarClick(page, SidebarItem.EXPLORE);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Global Page Size is 15 (default)
    await expect(page.getByTestId('search-error-placeholder')).toBeHidden(); // Ensure no errors
    // Search table might take a moment to appear if previously empty or loading
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('page-size-selection-dropdown')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
      '15 / Page'
    );

    // 3. Go to Users Page (Global List)
    await settingClick(page, GlobalSettingOptions.USERS);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Global Page Size is 15 here too
    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText(
      '15 / Page'
    );

    // 4. Go back to Table Page (Asset List)
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Asset Page Size persisted as 25 (independent of Global)
    await expect(page.getByTestId('page-size-selection-dropdown')).toHaveText('25 / Page');
  });
});
