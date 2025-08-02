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

export const verifyActivityFeedFilters = async (
  page: Page,
  widgetKey: string
) => {
  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const myDataFilter = page.waitForResponse(
    '/api/v1/feed?type=Conversation&filterType=OWNER&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'My Data' }).click();
  await myDataFilter;

  const followingFilter = page.waitForResponse(
    '/api/v1/feed?type=Conversation&filterType=FOLLOWS&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Following' }).click();
  await followingFilter;

  const allActivityFilter = page.waitForResponse(
    '/api/v1/feed?type=Conversation&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'All Activity' }).click();
  await allActivityFilter;
};

export const verifyDataFilters = async (page: Page, widgetKey: string) => {
  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const aToZFilter = page.waitForResponse(
    '/api/v1/search/query?q=*&index=all*&sort_field=name.keyword&sort_order=asc'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  const zToAFilter = page.waitForResponse(
    '/api/v1/search/query?q=*&index=all*&sort_field=name.keyword&sort_order=desc'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  const latestFilter = page.waitForResponse(
    '/api/v1/search/query?q=*&index=all*&sort_field=updatedAt&sort_order=desc'
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
  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const last14DaysFilter = page.waitForResponse(
    '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data?start=*&end=*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Last 14 days' }).click();
  await last14DaysFilter;

  const last7DaysFilter = page.waitForResponse(
    '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data?start=*&end=*'
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Last 7 days' }).click();
  await last7DaysFilter;
};

export const verifyDomainsFilters = async (page: Page, widgetKey: string) => {
  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const aToZFilter = page.waitForResponse(
    'api/v1/search/query?q=*&index=domain_search_index&*&sort_field=name.keyword&sort_order=asc'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;

  const zToAFilter = page.waitForResponse(
    'api/v1/search/query?q=*&index=domain_search_index&*&sort_field=name.keyword&sort_order=desc'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;

  const latestFilter = page.waitForResponse(
    'api/v1/search/query?q=*&index=domain_search_index&*&sort_field=updatedAt&sort_order=desc'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
};

export const verifyTaskFilters = async (page: Page, widgetKey: string) => {
  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  const mentionsTaskFilter = page.waitForResponse(
    '/api/v1/feed?type=Task&filterType=MENTIONS&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Mentions' }).click();
  await mentionsTaskFilter;

  const assignedTasksFilter = page.waitForResponse(
    '/api/v1/feed?type=Task&filterType=ASSIGNED_TO&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;

  const allTasksFilter = page.waitForResponse(
    '/api/v1/feed?type=Task&filterType=OWNER_OR_FOLLOWS&*'
  );
  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
};
