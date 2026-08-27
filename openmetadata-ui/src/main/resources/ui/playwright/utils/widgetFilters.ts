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
import {
  expect,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';
import { waitForAntdPopupToSettle } from './common';
import { waitForLandingPageWidget } from './customizeLandingPage';
import { waitForAllLoadersToDisappear } from './entity';

type ResponseMatcher = (response: Response) => boolean;

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

const searchQueryMatcher =
  (index: string, sortField: string, sortOrder: string): ResponseMatcher =>
  (response) =>
    response.url().includes('/api/v1/search/query') &&
    response.url().includes(`index=${index}`) &&
    response.url().includes(`sort_field=${sortField}`) &&
    response.url().includes(`sort_order=${sortOrder}`);

/**
 * Opens a widget's sort/filter dropdown, picks an option, and returns the response
 * the option was expected to trigger.
 *
 * Two guards make this reliable, and both are load bearing:
 *
 * 1. `waitForAntdPopupToSettle` — without it the click can land on the option *above*
 *    the intended one while the menu is still scaling open, silently selecting the
 *    wrong filter.
 * 2. The trigger-label assertion — if a click still drifts, this fails immediately
 *    with "expected Following, received My Data" instead of leaving the caller blocked
 *    on a response that can never arrive.
 *
 * The response listener is registered after the menu has settled but before the click,
 * so a request fired synchronously by the selection cannot be missed.
 */
const selectWidgetSortOption = async (
  page: Page,
  widget: Locator,
  optionName: string,
  responseMatcher: ResponseMatcher
): Promise<Response> => {
  const trigger = widget.getByTestId('widget-sort-by-dropdown');
  const menuItem = page.getByRole('menuitem', { name: optionName });

  await trigger.click();
  await expect(menuItem).toBeVisible();
  await waitForAntdPopupToSettle(page);

  const filterResponse = page.waitForResponse(responseMatcher);
  // Nothing resolves this promise if the selection assertion below fails. Marking it
  // handled keeps its teardown rejection out of the report so the reported failure
  // stays the real one; the `await` further down still surfaces a genuine timeout.
  filterResponse.catch(() => undefined);

  await menuItem.click();

  await expect(trigger).toContainText(optionName);

  const response = await filterResponse;

  await widget.getByTestId('entity-list-skeleton').waitFor({
    state: 'detached',
  });

  return response;
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
  const response = await selectWidgetSortOption(
    page,
    widget,
    filterName,
    (candidate) =>
      candidate.request().method() === 'GET' &&
      new URL(candidate.url()).pathname === expectedPath
  );

  expect(response.status()).toBe(200);
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

  await selectWidgetSortOption(
    page,
    widget,
    'A to Z',
    searchQueryMatcher(searchIndex, 'name.keyword', 'asc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Z to A',
    searchQueryMatcher(searchIndex, 'name.keyword', 'desc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Latest',
    searchQueryMatcher(searchIndex, 'updatedAt', 'desc')
  );
};

export const verifyTotalDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  const totalDataAssetsMatcher: ResponseMatcher = (response) =>
    response
      .url()
      .includes(
        '/api/v1/analytics/dataInsights/system/charts/name/total_data_assets/data'
      ) &&
    response.url().includes('start=') &&
    response.url().includes('end=');

  await selectWidgetSortOption(
    page,
    widget,
    'Last 14 days',
    totalDataAssetsMatcher
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Last 7 days',
    totalDataAssetsMatcher
  );
};

export const verifyDataProductsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  await selectWidgetSortOption(
    page,
    widget,
    'A to Z',
    searchQueryMatcher('dataProduct', 'name.keyword', 'asc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Z to A',
    searchQueryMatcher('dataProduct', 'name.keyword', 'desc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Latest',
    searchQueryMatcher('dataProduct', 'updatedAt', 'desc')
  );
};

export const verifyDomainsFilters = async (page: Page, widgetKey: string) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  await selectWidgetSortOption(
    page,
    widget,
    'A to Z',
    searchQueryMatcher('domain', 'name.keyword', 'asc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Z to A',
    searchQueryMatcher('domain', 'name.keyword', 'desc')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Latest',
    searchQueryMatcher('domain', 'updatedAt', 'desc')
  );
};

export const verifyTaskFilters = async (page: Page, widgetKey: string) => {
  const taskFilterMatcher =
    (predicate: (url: URL) => boolean): ResponseMatcher =>
    (response) => {
      const url = new URL(response.url());

      return response.request().method() === 'GET' && predicate(url);
    };

  const widget = await getWidgetForFilters(page, widgetKey);

  await expect(widget.getByTestId('task-feed-card').first()).toBeVisible();

  await selectWidgetSortOption(
    page,
    widget,
    'Mentions',
    taskFilterMatcher(
      (url) =>
        url.pathname === '/api/v1/tasks' &&
        url.searchParams.has('mentionedUser')
    )
  );

  await selectWidgetSortOption(
    page,
    widget,
    'Assigned',
    taskFilterMatcher((url) => url.pathname === '/api/v1/tasks/assigned')
  );

  await selectWidgetSortOption(
    page,
    widget,
    'All',
    taskFilterMatcher((url) => url.pathname === '/api/v1/tasks/visible')
  );
};

export const verifyDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  const widget = await getWidgetForFilters(page, widgetKey);

  const tableSearchMatcher: ResponseMatcher = (response) =>
    response.url().includes('/api/v1/search/query') &&
    response.url().includes('index=table');

  await selectWidgetSortOption(page, widget, 'A to Z', tableSearchMatcher);
  await selectWidgetSortOption(page, widget, 'Z to A', tableSearchMatcher);
  await selectWidgetSortOption(page, widget, 'High to Low', tableSearchMatcher);
  await selectWidgetSortOption(page, widget, 'Low to High', tableSearchMatcher);
};
