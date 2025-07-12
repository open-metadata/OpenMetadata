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
  test('Page size should persist across different pages', async ({
    dataConsumerPage: page,
  }) => {
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Change page size to 25
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '25 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Go to Explore Page
    await sidebarClick(page, SidebarItem.EXPLORE);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByText('25 / page')).toBeVisible();

    // Change page size to 50
    await page.locator('.ant-pagination-options-size-changer').click();
    await page.getByTitle('50 / Page').click();

    // Go to Users Page
    await settingClick(page, GlobalSettingOptions.USERS);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByText('50 / page')).toBeVisible();
  });
});
