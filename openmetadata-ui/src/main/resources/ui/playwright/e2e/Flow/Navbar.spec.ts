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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { navbarSearchItems, selectOption } from '../../utils/navbar';
import { sidebarClick } from '../../utils/sidebar';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

for (const searchItem of navbarSearchItems) {
  const { label, searchIndex } = searchItem;

  test(
    `Search Term - ${label}`,
    PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
    async ({ page }) => {
      await redirectToHomePage(page);
      // Typing while Explore is still loading lets its first render close the
      // suggestions popover before the debounced search fires, and with the
      // popover closed no suggestion query is ever sent.
      const exploreLoaded = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.request().method() === 'GET',
        200
      );
      await sidebarClick(page, SidebarItem.EXPLORE);
      await exploreLoaded;
      await waitForAllLoadersToDisappear(page);

      await selectOption(
        page,
        page.getByTestId('global-search-selector'),
        label
      );

      await expect(page.getByTestId('global-search-selector')).toContainText(
        label
      );

      const searchRes = waitForResponseWithStatus(
        page,
        (response) => {
          const url = new URL(response.url());

          return (
            url.pathname.endsWith('/api/v1/search/query') &&
            url.searchParams.get('index') === searchIndex &&
            url.searchParams.get('q') === 'dim'
          );
        },
        200
      );
      await page.getByTestId('searchBox').fill('dim');
      await searchRes;
    }
  );
}
