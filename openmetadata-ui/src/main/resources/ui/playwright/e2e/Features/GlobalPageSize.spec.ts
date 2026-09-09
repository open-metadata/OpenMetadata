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
    const tablePageSizeOption = page
      .locator('.ant-dropdown:not(.ant-dropdown-hidden)')
      .getByRole('menuitem', { name: '25 / Page' });
    await expect(async () => {
      await tablePageSizeDropdown.hover();
      await expect(tablePageSizeOption).toBeVisible();
    }).toPass({ timeout: 15000 });
    await tablePageSizeOption.click();

    await waitForAllLoadersToDisappear(page);

    // Go to Explore Page — its first search runs at the persisted page size,
    // so wait for that size=25 response to settle before reading the value
    // back off the dropdown, otherwise the assertion can race the search and
    // read the pre-hydration default.
    const exploreSearchAt25 = page.waitForResponse(
      (res) =>
        res.url().includes('/search/query') &&
        new URL(res.url()).searchParams.get('size') === '25'
    );
    await sidebarClick(page, SidebarItem.EXPLORE);
    await exploreSearchAt25;

    await waitForAllLoadersToDisappear(page);

    const rowsPerPageDropdown = page.getByTestId('rows-per-page-dropdown');
    await expect(rowsPerPageDropdown.locator('p').first()).toHaveText('25');

    // Change page size to 50, then wait for the size=50 search to settle so the
    // persisted globalPageSize is committed before navigating to the next page.
    const option50 = page.getByTestId('rows-per-page-option-50');
    await expect(async () => {
      if (
        (await rowsPerPageDropdown.getAttribute('aria-expanded')) !== 'true'
      ) {
        await rowsPerPageDropdown.click();
      }
      await expect(option50).toBeVisible();
    }).toPass({ timeout: 15000 });
    const exploreSearchAt50 = page.waitForResponse(
      (res) =>
        res.url().includes('/search/query') &&
        new URL(res.url()).searchParams.get('size') === '50'
    );
    await option50.click();
    await exploreSearchAt50;
    await waitForAllLoadersToDisappear(page);

    // Go to Users Page
    await settingClick(page, GlobalSettingOptions.USERS);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByText('50 / page')).toBeVisible();
  });
});
