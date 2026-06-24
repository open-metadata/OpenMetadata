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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const SEARCH_QUERY_API = '**/api/v1/search/query**';

const openExplore = async (page: Page) => {
  await sidebarClick(page, SidebarItem.EXPLORE);
};

test.describe(
  'Explore - resilience and corner cases',
  { tag: ['@Pages', '@Discovery'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('surfaces the index banner and stays usable when search returns an index error', async ({
      page,
    }) => {
      test.slow();

      await page.route(SEARCH_QUERY_API, (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'Failed to to find index [table_search_index]',
          }),
        })
      );

      await openExplore(page);

      // The shell renders (no white-screen), results are suppressed, and the
      // indexing banner (which links to the indexing app) explains the failure.
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await expect(page.getByTestId('search-container')).toHaveCount(0);
      await expect(
        page.locator('[href*="SearchIndexingApplication"]')
      ).toBeVisible();

      // Recovers once the backend responds normally again.
      await page.unroute(SEARCH_QUERY_API);
      const recovered = page.waitForResponse(SEARCH_QUERY_API);
      await page.reload();
      await recovered;

      await expect(page.getByTestId('search-container')).toBeVisible();
      await expect(
        page.locator('[href*="SearchIndexingApplication"]')
      ).toHaveCount(0);
    });

    test('does not white-screen when the search request fails at the network level', async ({
      page,
    }) => {
      test.slow();

      await page.route(SEARCH_QUERY_API, (route) => route.abort());

      await openExplore(page);

      // Page shell and the browse tree both still render — browsing stays usable
      // even though the search request was aborted.
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await expect(page.getByTestId('explore-tree')).toBeVisible();
    });

    test('renders gracefully for a malformed browsePath URL parameter', async ({
      page,
    }) => {
      test.slow();

      const queryRes = page.waitForResponse(SEARCH_QUERY_API);
      await page.goto('/explore/tables?browsePath=not-valid-json');
      await queryRes;

      // The garbage param is ignored, the page loads, and no browse chip leaks.
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await expect(page.getByTestId('browse-chip-serviceType')).toHaveCount(0);
    });

    test('renders gracefully for a malformed quickFilter URL parameter', async ({
      page,
    }) => {
      test.slow();

      const queryRes = page.waitForResponse(SEARCH_QUERY_API);
      await page.goto('/explore/tables?quickFilter=%7Bbroken-json');
      await queryRes;

      // The unparseable filter is dropped and results still load.
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await expect(page.getByTestId('search-container')).toBeVisible();
    });
  }
);
