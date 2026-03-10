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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { DATA_ASSETS_SORT } from '../../constant/explore';
import { SidebarItem } from '../../constant/sidebar';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { selectSortOrder, verifyEntitiesAreSorted } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

test.describe(
  'Explore Sort Order Filter',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    DATA_ASSETS_SORT.forEach(({ name, filter }) => {
      test(`${name}`, async ({ browser }) => {
        test.slow(true);

        const { page, afterAction } = await performAdminLogin(browser);

        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.EXPLORE);

        await page.waitForLoadState('networkidle');

        await page.getByTestId('search-dropdown-Data Assets').click();
        await page.waitForSelector(
          '[data-testid="drop-down-menu"] [data-testid="loader"]',
          {
            state: 'detached',
          }
        );

        const dataAssetDropdownRequest = page.waitForResponse(
          '/api/v1/search/aggregate?index=dataAsset&field=entityType.keyword*'
        );
        await page
          .getByTestId('drop-down-menu')
          .getByTestId('search-input')
          .fill(filter.toLowerCase());
        await dataAssetDropdownRequest;
        await page.getByTestId(`${filter.toLowerCase()}-checkbox`).check();
        await page.waitForSelector(
          `[data-testid="${filter.toLowerCase()}-checkbox"]`,
          {
            state: 'visible',
          }
        );

        await page.getByTestId(`${filter.toLowerCase()}-checkbox`).check();
        await page.getByTestId('update-btn').click();

        await selectSortOrder(page, 'Name');
        await verifyEntitiesAreSorted(page);

        const clearFilters = page.getByTestId('clear-filters');

        expect(clearFilters).toBeVisible();

        await clearFilters.click();

        await afterAction();
      });
    });
  }
);
