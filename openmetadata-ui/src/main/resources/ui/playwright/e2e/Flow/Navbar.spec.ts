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
import { expect, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { navbarSearchItems, selectOption } from '../../utils/navbar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

for (const searchItem of navbarSearchItems) {
  const { label, searchIndex, isScrollRequired } = searchItem;

  test(`Search Term - ${label}`, async ({ page }) => {
    await redirectToHomePage(page);

    await selectOption(
      page,
      page.getByTestId('global-search-selector'),
      label,
      isScrollRequired
    );

    await expect(page.getByTestId('global-search-selector')).toContainText(
      label
    );

    const searchRes = page.waitForResponse(
      `/api/v1/search/query?q=*&index=${searchIndex}**`
    );
    await page.getByTestId('searchBox').fill('dim');
    await searchRes;
  });
}
