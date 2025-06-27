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
import { test } from '@playwright/test';
import { DATA_ASSETS } from '../../constant/explore';
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { selectSortOrder, verifyEntitiesAreSorted } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// Use admin user to run the test
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Explore Sort Order Filter for all entities', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  DATA_ASSETS.forEach(({ name, filter }) => {
    test(`${name} - sort order`, async ({ page }) => {
      await page.getByRole('button', { name: 'Data Assets' }).click();

      // Check if filter exists
      const filterCheckbox = page.getByTestId(`${filter}-checkbox`);
      const isFilterPresent = await filterCheckbox.isVisible();

      if (!isFilterPresent) {
        return;
      }

      // Proceed if filter exists
      await filterCheckbox.check();
      await page.getByTestId('update-btn').click();

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await selectSortOrder(page, 'Name');
      await verifyEntitiesAreSorted(page);
    });
  });
});
