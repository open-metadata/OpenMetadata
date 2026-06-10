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

import { expect, Page, test } from '@playwright/test';
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

async function runSearchValidation(page: Page): Promise<void> {
  const apiCountResPromise = page.waitForResponse(
    'api/v1/search/query?q=customers&index=dataAsset&*'
  );

  // Capture the initial table tab search response which fires automatically on load
  const initialTabSearchResPromise = page.waitForResponse(
    (response) =>
      response.url().includes(SEARCH_URL_FRAGMENT) &&
      response.url().includes('size=15') &&
      response.url().includes('from=0') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('searchBox').fill('customers');
  await page.getByTestId('searchBox').press('Enter');

  const [apiCountRes, initialTabSearchRes] = await Promise.all([
    apiCountResPromise,
    initialTabSearchResPromise,
  ]);
  const countResponseBody = await apiCountRes.json();
  const initialTabSearchBody = await initialTabSearchRes.json();

  // Wait for the explore left panel to appear after search
  await page.getByTestId('explore-left-panel').waitFor({ state: 'visible' });

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
      const countText = await countLocator.textContent();
      const displayedCount = parseInt(countText?.trim() ?? '0', 10);

      expect(
        displayedCount,
        `Left panel count for "${bucket.key}" should match API count`
      ).toBe(bucket.doc_count);
    }
  });

  await test.step('Click each tab and verify search results match entity type', async () => {
    let isFirstTab = true;

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

      if (isFirstTab) {
        tabSearchBody = initialTabSearchBody;
        isFirstTab = false;
      } else {
        const tabSearchResPromise = page.waitForResponse(
          (response) =>
            response.url().includes(SEARCH_URL_FRAGMENT) &&
            response.url().includes('size=15') &&
            response.url().includes('from=0') &&
            response.request().method() === 'GET' &&
            response.url().includes(`index=${bucket.key}`)
        );

        await tabLocator.click();

        const tabSearchRes = await tabSearchResPromise;
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
