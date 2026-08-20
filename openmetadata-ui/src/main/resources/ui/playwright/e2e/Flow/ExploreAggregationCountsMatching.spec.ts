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

import { expect, Page, Response, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';

// Maps entityType keys from the API aggregation to the explore left-panel tab testid labels.
// The testid format is `${lowerCase(tabDetail.label)}-tab` (see ExploreUtils.tsx generateTabItems).
const ENTITY_TYPE_TO_TAB_TESTID: Record<string, string> = {
  table: 'tables-tab',
  database: 'databases-tab',
  databaseSchema: 'database schemas-tab',
  glossaryTerm: 'glossary terms-tab',
  dataProduct: 'data products-tab',
  dashboard: 'dashboards-tab',
  pipeline: 'pipelines-tab',
  topic: 'topics-tab',
  mlmodel: 'ml models-tab',
  container: 'containers-tab',
  searchIndex: 'search indexes-tab',
  chart: 'charts-tab',
  storedProcedure: 'stored procedures-tab',
  tag: 'tags-tab',
  metric: 'metrics-tab',
};

const SEARCH_URL_FRAGMENT = '/api/v1/search/query';
const SEARCH_QUERY = 'customers';
const SEARCH_RESULT_SIZE = '15';

const getSearchParams = (response: Response) =>
  new URL(response.url()).searchParams;

const isSearchQueryResponse = (response: Response, index: string) => {
  const searchParams = getSearchParams(response);

  return (
    response.url().includes(SEARCH_URL_FRAGMENT) &&
    response.request().method() === 'GET' &&
    searchParams.get('q') === SEARCH_QUERY &&
    searchParams.get('index') === index
  );
};

const isTabSearchQueryResponse = (response: Response) => {
  const searchParams = getSearchParams(response);
  const index = searchParams.get('index') ?? '';

  return (
    isSearchQueryResponse(response, index) &&
    searchParams.get('size') === SEARCH_RESULT_SIZE &&
    searchParams.get('from') === '0'
  );
};

async function runSearchValidation(page: Page): Promise<void> {
  const apiCountResPromise = page.waitForResponse((response) =>
    isSearchQueryResponse(response, 'dataAsset')
  );

  const initialTabSearchResPromise = page.waitForResponse(
    isTabSearchQueryResponse
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
  const initialTabSearchBody = await initialTabSearchRes.json();
  const initialTabSearchIndex = new URL(
    initialTabSearchRes.url()
  ).searchParams.get('index');

  await expect(page.getByTestId('explore-left-panel')).toBeVisible();

  const aggregations = countResponseBody?.aggregations ?? {};
  const entityTypeBuckets: Array<{ key: string; doc_count: number }> =
    (aggregations['entityType'] ?? aggregations['sterms#entityType'])
      ?.buckets ?? [];

  await test.step('Verify left panel counts match API aggregation', async () => {
    for (const bucket of entityTypeBuckets) {
      const tabTestId = ENTITY_TYPE_TO_TAB_TESTID[bucket.key];

      if (!tabTestId) {
        continue;
      }

      const tabLocator = page.getByTestId(tabTestId);
      const isTabVisible = await tabLocator.isVisible();

      if (!isTabVisible) {
        continue;
      }

      const countLocator = tabLocator.getByTestId('filter-count');

      await expect(
        countLocator,
        `Left panel count for "${bucket.key}" should match API count`
      ).toHaveText(`${bucket.doc_count}`);
    }
  });

  await test.step('Click each tab and verify search results match entity type', async () => {
    for (const bucket of entityTypeBuckets) {
      const tabTestId = ENTITY_TYPE_TO_TAB_TESTID[bucket.key];

      if (!tabTestId) {
        continue;
      }

      const tabLocator = page.getByTestId(tabTestId);
      const isTabVisible = await tabLocator.isVisible();

      if (!isTabVisible) {
        continue;
      }

      let tabSearchBody: {
        hits: {
          total: { value: number };
          hits: Array<{ _source: { entityType: string } }>;
        };
      };

      if (bucket.key === initialTabSearchIndex) {
        tabSearchBody = initialTabSearchBody;
      } else {
        const tabSearchResPromise = page.waitForResponse(
          (response) =>
            isSearchQueryResponse(response, bucket.key) &&
            getSearchParams(response).get('size') === SEARCH_RESULT_SIZE &&
            getSearchParams(response).get('from') === '0'
        );

        await tabLocator.click();

        const tabSearchRes = await tabSearchResPromise;
        expect(tabSearchRes.status()).toBe(200);

        tabSearchBody = await tabSearchRes.json();
      }

      const totalHits: number = tabSearchBody?.hits?.total?.value ?? 0;

      expect(
        totalHits,
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
