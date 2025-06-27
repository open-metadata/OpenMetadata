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

  test('Table', async ({ page }) => {
    await selectDataAssetFilter(page, 'table');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Database', async ({ page }) => {
    await selectDataAssetFilter(page, 'database');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Database schema', async ({ page }) => {
    await selectDataAssetFilter(page, 'databaseSchema');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Dashboard', async ({ page }) => {
    await selectDataAssetFilter(page, 'dashboard');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Dashboard data model', async ({ page }) => {
    await selectDataAssetFilter(page, 'dashboardDataModel');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Pipeline', async ({ page }) => {
    await selectDataAssetFilter(page, 'pipeline');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Topic', async ({ page }) => {
    await selectDataAssetFilter(page, 'topic');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('ML Model', async ({ page }) => {
    await selectDataAssetFilter(page, 'mlmodel');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Container', async ({ page }) => {
    await selectDataAssetFilter(page, 'container');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });

  test('Search Index', async ({ page }) => {
    await selectDataAssetFilter(page, 'searchIndex');

    await selectSortOrder(page, 'Name');
    await verifyEntitiesAreSorted(page);
  });
});
