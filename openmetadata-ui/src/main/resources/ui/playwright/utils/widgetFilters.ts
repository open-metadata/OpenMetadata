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
import { expect, Page } from '@playwright/test';
import { waitForAllLoadersToDisappear } from './entity';

export const verifyActivityFeedFilters = async (
  page: Page,
  widgetKey: string
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  // Wait for the widget feed to load
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  const myDataFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Conversation') &&
      response.url().includes('filterType=OWNER')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'My Data' }).click();
  await myDataFilter;

  const followingFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Conversation') &&
      response.url().includes('filterType=FOLLOWS')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Following' }).click();
  await followingFilter;

  const allActivityFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Conversation')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'All Activity' }).click();
  await allActivityFilter;
};

export const verifyDataFilters = async (page: Page, widgetKey: string) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  // Wait for the widget data to appear
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=all') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=all') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=all') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
};

export const verifyTotalDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const last14DaysFilter = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data'
        ) &&
      response.url().includes('start=') &&
      response.url().includes('end=')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Last 14 days' }).click();
  await last14DaysFilter;

  const last7DaysFilter = page.waitForResponse(
    (response) =>
      response
        .url()
        .includes(
          '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data'
        ) &&
      response.url().includes('start=') &&
      response.url().includes('end=')
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Last 7 days' }).click();
  await last7DaysFilter;
};

export const verifyDataProductsFilters = async (
  page: Page,
  widgetKey: string
) => {
  await waitForAllLoadersToDisappear(page);

  const widget = page.getByTestId(widgetKey);

  const sortDropdown = widget.getByTestId('widget-sort-by-dropdown');

  await expect(sortDropdown).toBeVisible();

  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
};

export const verifyDomainsFilters = async (page: Page, widgetKey: string) => {
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
};

export const verifyTaskFilters = async (page: Page, widgetKey: string) => {
  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const mentionsTaskFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Task') &&
      response.url().includes('filterType=MENTIONS')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Mentions' }).click();
  await mentionsTaskFilter;

  const assignedTasksFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Task') &&
      response.url().includes('filterType=ASSIGNED_TO')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;

  const allTasksFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/feed') &&
      response.url().includes('type=Task') &&
      response.url().includes('filterType=OWNER_OR_FOLLOWS')
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
};

export const verifyDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = page.getByTestId(widgetKey);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  const sortDropdown = widget.getByTestId('widget-sort-by-dropdown');

  await expect(sortDropdown).toBeVisible();

  // Test A to Z sorting
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  // Wait for UI to update
  await page.waitForLoadState('networkidle');

  // Test Z to A sorting
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  // Wait for UI to update
  await page.waitForLoadState('networkidle');

  // Test High to Low sorting
  const highToLowFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'High to Low' }).click();
  await highToLowFilter;

  // Wait for UI to update
  await page.waitForLoadState('networkidle');

  // Test Low to High sorting
  const lowToHighFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await sortDropdown.click();
  await page.getByRole('menuitem', { name: 'Low to High' }).click();
  await lowToHighFilter;

  // Wait for UI to update
  await page.waitForLoadState('networkidle');
};
