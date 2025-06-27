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
import { startCase } from 'lodash';
import { EXPECTED_BUCKETS as DATA_ASSETS } from '../../constant/explore';
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import {
  selectDataAssetFilter,
  selectSortOrder,
  verifyEntitiesAreSorted,
} from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use admin user to run the test
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Explore Sort Order Filter for all entities', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  DATA_ASSETS.forEach((asset) => {
    test(`${startCase(asset)} - sort order`, async ({ page }) => {
      await selectDataAssetFilter(page, asset);
      await selectSortOrder(page, 'Name');
      await verifyEntitiesAreSorted(page);
    });
  });
});
