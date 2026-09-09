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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick, sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

test.describe('Table & Data Model columns table pagination', () => {
  test('Page size should persist across different pages', async ({
    dataConsumerPage: page,
  }) => {
    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await waitForAllLoadersToDisappear(page);

    // Change page size to 25
    const tablePageSizeDropdown = page.getByTestId(
      'page-size-selection-dropdown'
    );
    await tablePageSizeDropdown.scrollIntoViewIfNeeded();
    await expect(tablePageSizeDropdown).toBeVisible();
    const menuItem = page.getByRole('menuitem', { name: '25 / Page' });
    await expect(async () => {
      await tablePageSizeDropdown.hover();
      if (!(await menuItem.isVisible())) {
        await tablePageSizeDropdown.click();
      }
      await expect(menuItem).toBeVisible({ timeout: 2_000 });
      await menuItem.click();
      await expect(tablePageSizeDropdown).toHaveText('25 / Page');
    }).toPass({
      timeout: 30_000,
      intervals: [500, 1_000, 2_000],
    });



    await waitForAllLoadersToDisappear(page);

    // Go to Explore Page
    await sidebarClick(page, SidebarItem.EXPLORE);

    await waitForAllLoadersToDisappear(page);
    await expect(page.getByRole('button', { name: 'Records' })).toHaveText('25');

    // Change page size to 50
   const menuItem1 = page.getByTestId('rows-per-page-option-50');
   const pageSizeRecordBtn = page.getByRole('button', { name: 'Records' })
   await expect(async () => {
      await pageSizeRecordBtn.click();
      await expect(menuItem1).toBeVisible({ timeout: 2_000 });
      await menuItem1.click();
      await expect(page.getByRole('button', { name: 'Records' })).toHaveText('50');
    }).toPass({
      timeout: 30_000,
      intervals: [500, 1_000, 2_000],
    });

    await waitForAllLoadersToDisappear(page);

    // Go to Users Page
    await settingClick(page, GlobalSettingOptions.USERS);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByText('50 / page')).toBeVisible();
  });
});
