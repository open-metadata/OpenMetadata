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
    await page.getByRole('menuitem', { name: '25 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify 25 is selected
    // Note: If default logic changes, this ensures we explicitly set it to 25 for the test.
    await expect(page.getByText('25 / page')).toBeVisible();

    // 2. Go to Explore Page (Global List)
    await sidebarClick(page, SidebarItem.EXPLORE);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Global Page Size did NOT change to 25
    // This proves independence. We don't verify "15 / page" since default might vary or pagination might be hidden.
    // If pagination is hidden, '25 / page' is also not visible, satisfying the check.
    // If pagination is visible, it should show default (15), so '25 / page' should be not visible.
    await expect(page.getByText('25 / page')).not.toBeVisible();

    // 3. Go to Users Page (Global List)
    await settingClick(page, GlobalSettingOptions.USERS);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Global Page Size did NOT change to 25 here either
    await expect(page.getByText('25 / page')).not.toBeVisible();

    // 4. Go back to Table Page (Asset List)
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Verify Asset Page Size persisted as 25 (independent of Global)
    await expect(page.getByText('25 / page')).toBeVisible();
  });
});
