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

    // Verify default is 25
    await expect(page.getByText('25 / Page')).toBeVisible();

    // Change page size to 15
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByRole('menuitem', { name: '15 / Page' }).click();

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Go to Explore Page
    await sidebarClick(page, SidebarItem.EXPLORE);

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByText('15 / Page')).toBeVisible();

    // Change page size to 50
    const updatePreferenceResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/') &&
        response.request().method() === 'PUT' &&
        response.status() === 200
    );
    await page.locator('.ant-pagination-options-size-changer').click();
    await page.getByTitle('50 / Page').click();
    await updatePreferenceResponse;

    // Go to Users Page
    const usersListResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users') &&
        response.request().method() === 'GET' &&
        response.status() === 200
    );
    await settingClick(page, GlobalSettingOptions.USERS);
    await usersListResponse;

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await expect(page.getByText('50 / Page')).toBeVisible();
  });
});
