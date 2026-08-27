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

const getWidgetForFilters = async (
  page: Page,
  widgetKey: string
): Promise<Locator> => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await expect(widget.getByTestId('widget-sort-by-dropdown')).toBeVisible();

  return widget;
};

/**
 * Selects an Activity Feed widget filter and asserts it triggered a request to
 * exactly the endpoint that filter owns.
 *
 * The path is compared against the response's pathname rather than with
 * `includes()` — `/api/v1/activity` is a prefix of both `/api/v1/activity/my-feed`
 * and `/api/v1/activity/following`, so a substring match would let any filter
 * satisfy any assertion.
 */
export const selectActivityFeedFilterAndVerifyEndpoint = async (
  page: Page,
  widget: Locator,
  filterName: string,
  expectedPath: string
) => {
  await widget.getByTestId('widget-sort-by-dropdown').click();

  const activityResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === expectedPath
  );

  await page.getByRole('menuitem', { name: filterName }).click();

  const response = await activityResponse;

  expect(response.status()).toBe(200);

  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
};

export const verifyActivityFeedFilters = async (
  page: Page,
  widgetKey: string
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  const widget = await getWidgetForFilters(page, widgetKey);

  await selectActivityFeedFilterAndVerifyEndpoint(
    page,
    widget,
    'My Data',
    '/api/v1/activity/my-feed'
  );

  await selectActivityFeedFilterAndVerifyEndpoint(
    page,
    widget,
    'Following',
    '/api/v1/activity/following'
  );

  await selectActivityFeedFilterAndVerifyEndpoint(
    page,
    widget,
    'All Activity',
    '/api/v1/activity'
  );
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

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
  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const assignedTasksFilter = waitForTaskFilterResponse('ASSIGNED_TO');
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const allTasksFilter = waitForTaskFilterResponse('OWNER_OR_FOLLOWS');
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  // Test Z to A sorting
  await sortDropdown.click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  // Test High to Low sorting
  await sortDropdown.click();
  const highToLowFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'High to Low' }).click();
  await highToLowFilter;
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  // Test Low to High sorting
  await sortDropdown.click();
  const lowToHighFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=table')
  );
  await page.getByRole('menuitem', { name: 'Low to High' }).click();
  await lowToHighFilter;

  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
};
