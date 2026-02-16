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
  await page
    .waitForSelector(`[data-testid="${widgetKey}"] entity-list-skeleton`, {
      state: 'detached',
      timeout: 10000,
    })
    .catch(() => {
      // Skeleton might already be detached
    });

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();

  // Wait for either old or new feed API response with timeout
  const myDataFilter = Promise.race([
    page.waitForResponse(
      (response) =>
        (response.url().includes('/api/v1/feed') ||
          response.url().includes('/api/v1/activities')) &&
        response.url().includes('filterType=OWNER')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'My Data' }).click();
  await myDataFilter;
  await page.waitForLoadState('networkidle');

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const followingFilter = Promise.race([
    page.waitForResponse(
      (response) =>
        (response.url().includes('/api/v1/feed') ||
          response.url().includes('/api/v1/activities')) &&
        response.url().includes('filterType=FOLLOWS')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'Following' }).click();
  await followingFilter;
  await page.waitForLoadState('networkidle');

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const allActivityFilter = Promise.race([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/feed') ||
        response.url().includes('/api/v1/activities')
    ),
    page.waitForTimeout(5000),
  ]);
  await page.getByRole('menuitem', { name: 'All Activity' }).click();
  await allActivityFilter;
  await page.waitForLoadState('networkidle');
};

export const verifyDataFilters = async (page: Page, widgetKey: string) => {
  // Wait for the widget data to appear
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

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
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

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
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=all') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );
};

export const verifyTotalDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
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
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
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
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );
};

export const verifyDataProductsFilters = async (
  page: Page,
  widgetKey: string
) => {
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  const sortDropdown = page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown');

  await expect(sortDropdown).toBeVisible();

  await sortDropdown.click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await sortDropdown.click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await sortDropdown.click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=data_product') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );
};

export const verifyDomainsFilters = async (page: Page, widgetKey: string) => {
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

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
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=asc')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=name.keyword') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const latestFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=domain_search_index') &&
      response.url().includes('sort_field=updatedAt') &&
      response.url().includes('sort_order=desc')
  );
  await page.getByRole('menuitem', { name: 'Latest' }).click();
  await latestFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );
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

  await page
    .waitForSelector(`[data-testid="${widgetKey}"] entity-list-skeleton`, {
      state: 'detached',
      timeout: 10000,
    })
    .catch(() => {
      // Skeleton might already be detached
    });

  await expect(
    page.getByTestId(widgetKey).getByTestId('widget-sort-by-dropdown')
  ).toBeVisible();

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const mentionsTaskFilter = waitForTaskFilterResponse('MENTIONS');
  await page.getByRole('menuitem', { name: 'Mentions' }).click();
  await mentionsTaskFilter;
  await page.waitForLoadState('networkidle');

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const assignedTasksFilter = waitForTaskFilterResponse('ASSIGNED_TO');
  await page.getByRole('menuitem', { name: 'Assigned' }).click();
  await assignedTasksFilter;
  await page.waitForLoadState('networkidle');

  await page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown')
    .click();
  const allTasksFilter = waitForTaskFilterResponse('OWNER_OR_FOLLOWS');
  await page.getByRole('menuitem', { name: 'All' }).click();
  await allTasksFilter;
  await page.waitForLoadState('networkidle');
};

export const verifyDataAssetsFilters = async (
  page: Page,
  widgetKey: string
) => {
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  const sortDropdown = page
    .getByTestId(widgetKey)
    .getByTestId('widget-sort-by-dropdown');

  await expect(sortDropdown).toBeVisible();

  // Test A to Z sorting
  await sortDropdown.click();
  const aToZFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await page.getByRole('menuitem', { name: 'A to Z' }).click();
  await aToZFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  // Test Z to A sorting
  await sortDropdown.click();
  const zToAFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await page.getByRole('menuitem', { name: 'Z to A' }).click();
  await zToAFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  // Test High to Low sorting
  await sortDropdown.click();
  const highToLowFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await page.getByRole('menuitem', { name: 'High to Low' }).click();
  await highToLowFilter;
  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );

  // Test Low to High sorting
  await sortDropdown.click();
  const lowToHighFilter = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('table_search_index')
  );
  await page.getByRole('menuitem', { name: 'Low to High' }).click();
  await lowToHighFilter;

  await page.waitForSelector(
    `[data-testid="${widgetKey}"] entity-list-skeleton`,
    {
      state: 'detached',
    }
  );
};
