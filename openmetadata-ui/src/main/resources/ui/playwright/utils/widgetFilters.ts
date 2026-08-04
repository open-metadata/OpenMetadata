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

  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await expect(widget.getByTestId('widget-sort-by-dropdown')).toBeVisible();

  return widget;
};

export const verifyActivityFeedFilters = async (
  page: Page,
  widgetKey: string
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  const widget = await getWidgetForFilters(page, widgetKey);

  await widget.getByTestId('widget-sort-by-dropdown').click();

  const myDataFilter = Promise.race([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/activity') &&
        response.url().includes('/my-feed')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'My Data' }).click();
  await myDataFilter;

  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const followingFilter = Promise.race([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/activity') &&
        response.url().includes('/my-feed')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'Following' }).click();
  await followingFilter;

  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const allActivityFilter = Promise.race([
    page.waitForResponse((response) =>
      response.url().includes('/api/v1/activity')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'All Activity' }).click();
  await allActivityFilter;

  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
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
  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });
};

export const verifyTaskFilters = async (page: Page, widgetKey: string) => {
  const waitForTaskResponse = (predicate: (url: URL) => boolean) =>
    page.waitForResponse((response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' && predicate(url);
    });

  const widget = await getWidgetForFilters(page, widgetKey);

  await expect(widget.getByTestId('task-feed-card').first()).toBeVisible();

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const mentionsTaskFilter = waitForTaskResponse(
    (url) =>
      url.pathname === '/api/v1/tasks' && url.searchParams.has('mentionedUser')
  );
  await page.getByRole('menuitem', { name: 'Mentions' }).click();
  await mentionsTaskFilter;
  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const assignedTasksFilter = waitForTaskResponse(
    (url) => url.pathname === '/api/v1/tasks/assigned'
  );
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;
  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  await widget.getByTestId('widget-sort-by-dropdown').click();
  const allTasksFilter = waitForTaskResponse(
    (url) => url.pathname === '/api/v1/tasks/visible'
  );
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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
  await widget.locator('entity-list-skeleton').waitFor({
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

  await widget.locator('entity-list-skeleton').waitFor({
    state: 'detached',
  });
};
