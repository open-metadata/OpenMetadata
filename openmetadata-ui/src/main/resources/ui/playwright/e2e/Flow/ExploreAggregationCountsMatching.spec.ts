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

import { expect, Locator, Page, Response, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';

// Maps entityType keys from the API aggregation to the explore left-panel tab testid labels.
// The testid format is `${lowerCase(tabDetail.label)}-tab` (see ExploreUtils.tsx generateTabItems).
const ENTITY_TYPE_TO_TAB_TESTID: Record<string, string> = {
  table: 'tables-tab',
  tableColumn: 'columns-tab',
  database: 'databases-tab',
  databaseSchema: 'database schemas-tab',
  glossaryTerm: 'glossary terms-tab',
  dataProduct: 'data products-tab',
  dashboard: 'dashboards-tab',
  dashboardDataModel: 'dashboard data models-tab',
  pipeline: 'pipelines-tab',
  topic: 'topics-tab',
  mlmodel: 'ml models-tab',
  container: 'containers-tab',
  searchIndex: 'search indexes-tab',
  chart: 'charts-tab',
  storedProcedure: 'stored procedures-tab',
  tag: 'tags-tab',
  metric: 'metrics-tab',
  apiCollection: 'api collections-tab',
  apiEndpoint: 'api endpoints-tab',
  directory: 'directories-tab',
  file: 'files-tab',
  spreadsheet: 'spreadsheets-tab',
  worksheet: 'worksheets-tab',
};

const SEARCH_URL_FRAGMENT = '/api/v1/search/query';
const SEARCH_QUERY = 'customers';
const AGGREGATION_INDEX = 'dataAsset';
// The left-panel count query asks for a single hit (`pageSize: 1`) and only the
// entityType source field — see `runCountSearch` in ExploreUtils.tsx.
const AGGREGATION_RESULT_SIZE = '1';
// The tab results query is the only one that asks for trackTotalHits; the search-box
// suggestion dropdown fires an index=dataAsset query with the same size/from, so the
// predicate must not rely on size/from alone.
const TAB_RESULT_SIZE = '15';

const getSearchParams = (response: Response) =>
  new URL(response.url()).searchParams;

const isSearchQuery = (response: Response) =>
  response.url().includes(SEARCH_URL_FRAGMENT) &&
  response.request().method() === 'GET' &&
  getSearchParams(response).get('q') === SEARCH_QUERY;

const isAggregationCountResponse = (response: Response) => {
  const searchParams = getSearchParams(response);

  return (
    isSearchQuery(response) &&
    searchParams.get('index') === AGGREGATION_INDEX &&
    searchParams.get('size') === AGGREGATION_RESULT_SIZE &&
    searchParams.get('fetch_source') === 'true'
  );
};

const isTabResultsResponse = (response: Response, index?: string) => {
  const searchParams = getSearchParams(response);

  return (
    isSearchQuery(response) &&
    (index === undefined || searchParams.get('index') === index) &&
    searchParams.get('track_total_hits') === 'true' &&
    searchParams.get('size') === TAB_RESULT_SIZE &&
    searchParams.get('from') === '0'
  );
};

const getSelectedTab = (page: Page, tabTestId: string): Locator =>
  page.locator('.ant-menu-item-selected').getByTestId(tabTestId);

type TabSearchBody = {
  hits: {
    total: { value: number };
    hits: Array<{ _source: { entityType: string } }>;
  };
};

async function runSearchValidation(page: Page): Promise<void> {
  const apiCountResPromise = page.waitForResponse(isAggregationCountResponse);
  const initialTabSearchResPromise = page.waitForResponse((response) =>
    isTabResultsResponse(response)
  );

  await page.getByTestId('searchBox').fill(SEARCH_QUERY);
  await page.getByTestId('searchBox').press('Enter');

  const [apiCountRes, initialTabSearchRes] = await Promise.all([
    apiCountResPromise,
    initialTabSearchResPromise,
  ]);

  expect(apiCountRes.status()).toBe(200);
  expect(initialTabSearchRes.status()).toBe(200);

  const countResponseBody = await apiCountRes.json();
  const initialTabSearchBody: TabSearchBody = await initialTabSearchRes.json();
  const initialTabSearchIndex =
    getSearchParams(initialTabSearchRes).get('index');

  await expect(page.getByTestId('explore-left-panel')).toBeVisible();

  const aggregations = countResponseBody?.aggregations ?? {};
  const entityTypeBuckets: Array<{ key: string; doc_count: number }> =
    (aggregations['entityType'] ?? aggregations['sterms#entityType'])
      ?.buckets ?? [];

  expect(entityTypeBuckets.length).toBeGreaterThan(0);

  await test.step('Verify left panel counts match API aggregation', async () => {
    for (const bucket of entityTypeBuckets) {
      const tabTestId = ENTITY_TYPE_TO_TAB_TESTID[bucket.key];

      if (!tabTestId) {
        continue;
      }

      const tabLocator = page.getByTestId(tabTestId);

      if (!(await tabLocator.isVisible())) {
        continue;
      }

      await expect(
        tabLocator.getByTestId('filter-count'),
        `Left panel count for "${bucket.key}" should match API count`
      ).toHaveText(`${bucket.doc_count}`);
    }
  });

  // Asserted before any tab is clicked: the antd Menu is single-select, so the first
  // click on another tab deselects this one. Buckets are ordered by doc_count, which is
  // not the auto-selection order (findActiveSearchIndex picks the top-hit index), so this
  // cannot be checked from inside the click loop.
  await test.step('Verify the auto-selected tab is active', async () => {
    const initialTabTestId =
      ENTITY_TYPE_TO_TAB_TESTID[initialTabSearchIndex ?? ''];

    if (initialTabTestId) {
      await expect(getSelectedTab(page, initialTabTestId)).toBeVisible();
    }
  });

  await test.step('Click each tab and verify search results match entity type', async () => {
    for (const bucket of entityTypeBuckets) {
      const tabTestId = ENTITY_TYPE_TO_TAB_TESTID[bucket.key];

      if (!tabTestId) {
        continue;
      }

      const tabLocator = page.getByTestId(tabTestId);

      if (!(await tabLocator.isVisible())) {
        continue;
      }

      let tabSearchBody: TabSearchBody;

      if (bucket.key === initialTabSearchIndex) {
        // The auto-selected tab was already loaded by the initial search; clicking it
        // is a no-op in the Menu onClick handler, so no request would ever arrive.
        tabSearchBody = initialTabSearchBody;
      } else {
        const tabSearchResPromise = page.waitForResponse((response) =>
          isTabResultsResponse(response, bucket.key)
        );

        await tabLocator.click();

        // Fail fast if the click did not activate the tab, instead of hanging on a
        // waitForResponse predicate that can never match.
        await expect(getSelectedTab(page, tabTestId)).toBeVisible();

        const tabSearchRes = await tabSearchResPromise;
        expect(tabSearchRes.status()).toBe(200);

        tabSearchBody = await tabSearchRes.json();
      }

      expect(
        tabSearchBody?.hits?.total?.value ?? 0,
        `Tab "${bucket.key}" search total hits should match the aggregation count`
      ).toBe(bucket.doc_count);
    }
  });
}

test.describe(
  'Explore Aggregation Counts Matching',
  { tag: ['@Discovery'] },
  () => {
    test.use({
      storageState: 'playwright/.auth/admin.json',
    });

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should verify left panel counts and tab search results for normal search', async ({
      page,
    }) => {
      test.slow();

      await runSearchValidation(page);
    });
  }
);
