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
    // Under merge-queue load (many parallel shards on shared ES/DB) this
    // test's three page loads + two dropdown hand-offs can each drift 5–10 s.
    // Triple the budget so a slow shard finishes instead of failing at 60 s.
    test.slow();

    await page.goto(
      '/table/sample_data.ecommerce_db.shopify.performance_test_table'
    );

    await waitForAllLoadersToDisappear(page);

    // Change page size to 25.
    // The Antd Dropdown behind `page-size-selection-dropdown` opens on hover,
    // but under load the mouseenter can miss the transition and the menu
    // never renders. Same toPass pattern as playwright/utils/common.ts —
    // hover, fall back to click, and retry until the option is visible.
    const tablePageSizeDropdown = page.getByTestId(
      'page-size-selection-dropdown'
    );
    await tablePageSizeDropdown.scrollIntoViewIfNeeded();
    await expect(tablePageSizeDropdown).toBeVisible();

    const tablePageSizeOption = page
      .locator('.ant-dropdown:not(.ant-dropdown-hidden)')
      .getByRole('menuitem', { name: '25 / Page' });
    await expect(async () => {
      await tablePageSizeDropdown.hover();
      if (!(await tablePageSizeOption.isVisible())) {
        await tablePageSizeDropdown.click();
      }
      await expect(tablePageSizeOption).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000, 2_000] });
    await tablePageSizeOption.click();

    await waitForAllLoadersToDisappear(page);

    // Go to Explore Page
    await sidebarClick(page, SidebarItem.EXPLORE);

    await waitForAllLoadersToDisappear(page);

    const rowsPerPageDropdown = page.getByTestId('rows-per-page-dropdown');
    await expect(rowsPerPageDropdown.locator('p').first()).toHaveText('25');

    // Change page size to 50.
    // `rows-per-page-dropdown` is a react-aria Select. Under load the click
    // lands (button goes to [active] in the failure snapshot) but the popover
    // can close before the option is clickable. Wrap in toPass so the click
    // retries until the option is actually visible.
    const rowsPerPageOption50 = page.getByTestId('rows-per-page-option-50');
    await expect(async () => {
      await rowsPerPageDropdown.click();
      await expect(rowsPerPageOption50).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000, 2_000] });
    await rowsPerPageOption50.click();
    await waitForAllLoadersToDisappear(page);

    // Go to Users Page
    await settingClick(page, GlobalSettingOptions.USERS);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByText('50 / page')).toBeVisible();
  });
});
