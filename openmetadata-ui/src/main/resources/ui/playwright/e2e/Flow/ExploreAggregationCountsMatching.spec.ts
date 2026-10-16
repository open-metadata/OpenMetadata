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

import { APIRequestContext, Locator, Page, Response } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import { okJson } from '../../utils/apiResponse';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

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

const SEARCH_QUERY_PATH = '/api/v1/search/query';
const ENTITY_TYPE_COUNTS_PATH = '/api/v1/search/entityTypeCounts';
const SEARCH_QUERY = 'customers';
// The tab results query is the only one that asks for trackTotalHits; the search-box
// suggestion dropdown fires an index=dataAsset query with the same size/from, so the
// predicate must not rely on size/from alone.
const TAB_RESULT_SIZE = '15';

const getSearchParams = (response: Response) =>
  new URL(response.url()).searchParams;

const isSearchResponse = (response: Response, path: string) =>
  new URL(response.url()).pathname === path &&
  response.request().method() === 'GET' &&
  getSearchParams(response).get('q') === SEARCH_QUERY;

const isAggregationCountResponse = (response: Response) =>
  isSearchResponse(response, ENTITY_TYPE_COUNTS_PATH);

const isTabResultsResponse = (response: Response, index?: string) => {
  const searchParams = getSearchParams(response);

  return (
    isSearchResponse(response, SEARCH_QUERY_PATH) &&
    (index === undefined || searchParams.get('index') === index) &&
    searchParams.get('track_total_hits') === 'true' &&
    searchParams.get('size') === TAB_RESULT_SIZE &&
    searchParams.get('from') === '0'
  );
};

const getSelectedTab = (page: Page, tabTestId: string): Locator =>
  page.getByRole('tab', { selected: true }).and(page.getByTestId(tabTestId));

type TabSearchBody = {
  hits: { total: { value: number } };
};

type EntityTypeBucket = { key: string; doc_count: number };

type EntityTypeCountsBody = {
  aggregations?: Record<string, { buckets?: EntityTypeBucket[] }>;
};

const getEntityTypeBuckets = (body: EntityTypeCountsBody) =>
  (
    body.aggregations?.['entityType'] ??
    body.aggregations?.['sterms#entityType']
  )?.buckets ?? [];

// Replays the UI's own count and tab requests together on each attempt. The
// query also matches assets other workers are indexing, so the aggregation
// captured on search and a tab's results fetched several clicks later can
// differ by an asset neither endpoint got wrong.
const expectTabTotalToMatchAggregation = async (
  apiContext: APIRequestContext,
  countUrl: string,
  tabUrl: string,
  entityType: string
) => {
  await expect(async () => {
    const [countsBody, tabBody] = await Promise.all([
      apiContext
        .get(countUrl)
        .then((res) =>
          okJson<EntityTypeCountsBody>(res, 'search/entityTypeCounts')
        ),
      apiContext
        .get(tabUrl)
        .then((res) => okJson<TabSearchBody>(res, `${entityType} tab search`)),
    ]);
    const aggregationCount = getEntityTypeBuckets(countsBody).find(
      (bucket) => bucket.key === entityType
    )?.doc_count;

    expect(
      tabBody.hits.total.value,
      `Tab "${entityType}" search total hits should match the aggregation count`
    ).toBe(aggregationCount);
  }).toPass({ timeout: 30_000 });
};

async function runSearchValidation(page: Page): Promise<void> {
  const apiCountResPromise = waitForResponseWithStatus(
    page,
    isAggregationCountResponse,
    200
  );
  const initialTabSearchResPromise = waitForResponseWithStatus(
    page,
    (response) => isTabResultsResponse(response),
    200
  );

  await page.getByTestId('searchBox').fill(SEARCH_QUERY);
  await page.getByTestId('searchBox').press('Enter');

  const [apiCountRes, initialTabSearchRes] = await Promise.all([
    apiCountResPromise,
    initialTabSearchResPromise,
  ]);

  const initialTabSearchIndex =
    getSearchParams(initialTabSearchRes).get('index');

  await expect(page.getByTestId('explore-left-panel')).toBeVisible();

  // Every mapped entity type has an Explore tab, and a tab is listed whenever
  // its count is non-zero, so no bucket here may be skipped as "not visible".
  const tabBuckets = getEntityTypeBuckets(await apiCountRes.json()).filter(
    (bucket) => ENTITY_TYPE_TO_TAB_TESTID[bucket.key]
  );

  expect(tabBuckets.length).toBeGreaterThan(0);

  await test.step('Verify left panel counts match API aggregation', async () => {
    for (const bucket of tabBuckets) {
      await expect(
        page
          .getByTestId(ENTITY_TYPE_TO_TAB_TESTID[bucket.key])
          .getByTestId('filter-count'),
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
    const { apiContext, afterAction } = await getApiContext(page);

    for (const bucket of tabBuckets) {
      const tabTestId = ENTITY_TYPE_TO_TAB_TESTID[bucket.key];
      let tabSearchRes = initialTabSearchRes;

      // The auto-selected tab was already loaded by the initial search; clicking it
      // is a no-op in the Menu onClick handler, so no request would ever arrive.
      if (bucket.key !== initialTabSearchIndex) {
        const tabSearchResPromise = waitForResponseWithStatus(
          page,
          (response) => isTabResultsResponse(response, bucket.key),
          200
        );

        await page.getByTestId(tabTestId).click();

        // Fail fast if the click did not activate the tab, instead of hanging on a
        // waitForResponse predicate that can never match.
        await expect(getSelectedTab(page, tabTestId)).toBeVisible();

        tabSearchRes = await tabSearchResPromise;
      }

      await expectTabTotalToMatchAggregation(
        apiContext,
        apiCountRes.url(),
        tabSearchRes.url(),
        bucket.key
      );
    }

    await afterAction();
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
