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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { selectDataAssetFilter } from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Entity Summary Panel', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  test('Table Entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'table');

    await expect(page.getByTestId('Type-label')).toBeVisible();
    await expect(page.getByTestId('Queries-label')).toBeVisible();
    await expect(page.getByTestId('Columns-label')).toBeVisible();
    await expect(page.getByTestId('profiler-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('schema-header')).toBeVisible();
  });

  test('Database', async ({ page }) => {
    await selectDataAssetFilter(page, 'database');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();
    await expect(page.getByTestId('Owners-value')).toBeVisible();
    await expect(page.getByTestId('Tier-label')).toBeVisible();
    await expect(page.getByTestId('Service-label')).toBeVisible();
    await expect(page.getByTestId('Usage-label')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('schema-header')).toBeVisible();
  });

  test('Database schema', async ({ page }) => {
    await selectDataAssetFilter(page, 'databaseSchema');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();
    await expect(page.getByTestId('Owners-value')).toBeVisible();
    await expect(page.getByTestId('Tier-label')).toBeVisible();
    await expect(page.getByTestId('Service-label')).toBeVisible();
    await expect(page.getByTestId('Database-label')).toBeVisible();
    await expect(page.getByTestId('Usage-label')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('Dashboard entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'dashboard');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Dashboard URL-label')).toBeVisible();
    await expect(page.getByTestId('Project-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('charts-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('Dashboard data model entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'dashboardDataModel');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Data Model URL-label')).toBeVisible();
    await expect(page.getByTestId('Service-label')).toBeVisible();
    await expect(page.getByTestId('Tier-label')).toBeVisible();
    await expect(page.getByTestId('Data Model Type-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('column-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('Pipeline entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'pipeline');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Pipeline URL-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('tasks-header')).toBeVisible();
  });

  test('Topic entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'topic');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Partitions-label')).toBeVisible();
    await expect(page.getByTestId('Replication Factor-label')).toBeVisible();
    await expect(page.getByTestId('Retention Size-label')).toBeVisible();
    await expect(page.getByTestId('CleanUp Policies-label')).toBeVisible();
    await expect(page.getByTestId('Max Message Size-label')).toBeVisible();
    await expect(page.getByTestId('Schema Type-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('schema-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('ML Model entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'mlmodel');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Algorithm-label')).toBeVisible();
    await expect(page.getByTestId('Target-label')).toBeVisible();
    await expect(page.getByTestId('Server-label')).toBeVisible();
    await expect(page.getByTestId('Dashboard-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('features-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('Container entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'container');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('Objects-label')).toBeVisible();
    await expect(page.getByTestId('Service Type-label')).toBeVisible();
    await expect(page.getByTestId('Columns-label')).toBeVisible();
    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('schema-header')).toBeVisible();
    await expect(page.getByTestId('domain-header')).toBeVisible();
  });

  test('Search Index entity', async ({ page }) => {
    await selectDataAssetFilter(page, 'searchIndex');

    await expect(
      page.locator('.ant-card-head-title > [data-testid="entity-link"]')
    ).toBeVisible();

    await expect(page.getByTestId('tags-header')).toBeVisible();
    await expect(page.getByTestId('description-header')).toBeVisible();
    await expect(page.getByTestId('data-products-header')).toBeVisible();
    await expect(page.getByTestId('fields-header')).toBeVisible();
  });
});
