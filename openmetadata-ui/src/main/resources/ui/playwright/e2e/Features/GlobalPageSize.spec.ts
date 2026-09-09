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
import { waitForAntdPopupToSettle } from '../../utils/common';
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
    await tablePageSizeDropdown.hover();
    await expect(menuItem).toBeVisible();
    await waitForAntdPopupToSettle(page);
    await menuItem.click();
    await expect(tablePageSizeDropdown).toHaveText('25 / Page');

    await waitForAllLoadersToDisappear(page);

    const exploreSearchAt25 = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/v1/search/query' &&
        url.searchParams.get('size') === '25'
      );
    });
    await sidebarClick(page, SidebarItem.EXPLORE);
    expect((await exploreSearchAt25).ok()).toBe(true);

    await waitForAllLoadersToDisappear(page);
    await expect(page.getByRole('button', { name: 'Records' })).toHaveText(
      '25'
    );

    // Change page size to 50
    const option50 = page.getByTestId('rows-per-page-option-50');
    const pageSizeRecordBtn = page.getByRole('button', { name: 'Records' });
    const exploreSearchAt50 = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/v1/search/query' &&
        url.searchParams.get('size') === '50'
      );
    });
    await pageSizeRecordBtn.click();
    await expect(option50).toBeVisible();
    await option50.click();
    await expect(pageSizeRecordBtn).toHaveText('50');

    await waitForAllLoadersToDisappear(page);

    expect((await exploreSearchAt50).ok()).toBe(true);

    // Go to Users Page
    await settingClick(page, GlobalSettingOptions.USERS);

    await waitForAllLoadersToDisappear(page);

    await expect(page.getByText('50 / page')).toBeVisible();
  });
});
