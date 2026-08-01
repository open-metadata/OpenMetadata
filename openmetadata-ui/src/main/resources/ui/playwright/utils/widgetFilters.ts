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
import { expect, type Locator, type Page } from '@playwright/test';
import { waitForLandingPageWidget } from './customizeLandingPage';
import { waitForAllLoadersToDisappear } from './entity';

const waitForWidgetSkeletonToDetach = async (widget: Locator) => {
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
};

const getWidgetForFilters = async (
  page: Page,
  widgetKey: string
): Promise<Locator> => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  await waitForWidgetSkeletonToDetach(widget);

  await expect(widget.getByTestId('widget-sort-by-dropdown')).toBeVisible();

  return widget;
};

const waitForActivityFeedFilterResponse = (page: Page, filterType?: string) =>
  page.waitForResponse(
    (response) => {
      const url = response.url();
      const isActivityFeedResponse =
        url.includes('/api/v1/feed') || url.includes('/api/v1/activities');

      return filterType
        ? isActivityFeedResponse && url.includes(`filterType=${filterType}`)
        : isActivityFeedResponse;
    },
    { timeout: 15000 }
  );

export const verifyActivityFeedFilters = async (
  page: Page,
  widgetKey: string
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  const widget = await getWidgetForFilters(page, widgetKey);

  await widget.getByTestId('widget-sort-by-dropdown').click();

  const myDataFilter = waitForActivityFeedFilterResponse(page, 'OWNER');
  await page.getByRole('menuitem', { name: 'My Data' }).click();
  await myDataFilter;

  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const followingFilter = waitForActivityFeedFilterResponse(page, 'FOLLOWS');
  await page.getByRole('menuitem', { name: 'Following' }).click();
  await followingFilter;

  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const allActivityFilter = waitForActivityFeedFilterResponse(page);
  await page.getByRole('menuitem', { name: 'All Activity' }).click();
  await allActivityFilter;

  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyDataFilters = async (
  page: Page,
  widgetKey: string,
  searchIndex = 'dataAsset'
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndex}`) &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndex}`) &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(`index=${searchIndex}`) &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyTotalDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  await widget.getByTestId('widget-sort-by-dropdown').click();
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
  await page.getByRole('menuitem', { name: 'Last 14 days' }).click();
  await last14DaysFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
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
  await page.getByRole('menuitem', { name: 'Last 7 days' }).click();
  await last7DaysFilter;
  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyDataProductsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  const sortDropdown = widget.getByTestId('widget-sort-by-dropdown');

  await sortDropdown.click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=dataProduct') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await sortDropdown.click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=dataProduct') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await sortDropdown.click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=dataProduct') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyDomainsFilters = async (page: Page, widgetKey: string) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyTaskFilters = async (page: Page, widgetKey: string) => {
  const waitForTaskFilterResponse = (filterType: string) =>
    page.waitForResponse((response) => {
      const url = response.url();

      return (
        url.includes('/api/v1/tasks') ||
        (url.includes('/api/v1/feed') &&
          url.includes('type=Task') &&
          url.includes(`filterType=${filterType}`))
      );
    });

  const widget = await getWidgetForFilters(page, widgetKey);

  await expect(widget.getByTestId('task-feed-card').first()).toBeVisible();

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const mentionsTaskFilter = waitForTaskFilterResponse('MENTIONS');
  await page.getByRole('menuitem', { name: 'Mentions' }).click();
  await mentionsTaskFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const assignedTasksFilter = waitForTaskFilterResponse('ASSIGNED_TO');
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;
  await waitForWidgetSkeletonToDetach(widget);

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const allTasksFilter = waitForTaskFilterResponse('OWNER_OR_FOLLOWS');
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
  await waitForWidgetSkeletonToDetach(widget);
};

export const verifyDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  const sortDropdown = widget.getByTestId('widget-sort-by-dropdown');

  // Test A to Z sorting
  await sortDropdown.click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await waitForWidgetSkeletonToDetach(widget);

  // Test Z to A sorting
  await sortDropdown.click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await waitForWidgetSkeletonToDetach(widget);

  // Test High to Low sorting
  await sortDropdown.click();
  const highToLowFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'High to Low' }).click();
  await highToLowFilter;
  await waitForWidgetSkeletonToDetach(widget);

  // Test Low to High sorting
  await sortDropdown.click();
  const lowToHighFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'Low to High' }).click();
  await lowToHighFilter;

  await waitForWidgetSkeletonToDetach(widget);
};
