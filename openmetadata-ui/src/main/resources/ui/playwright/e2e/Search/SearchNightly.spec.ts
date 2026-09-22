/*
 *  Copyright 2026 Collate.
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

import test, { expect } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';

test.describe('Search Nightly Smoke', { tag: ['@search-nightly'] }, () => {
  test('should load global search suggestions for sample data query', async ({
    page,
  }) => {
    await redirectToHomePage(page);

    const searchInput = page.getByTestId('searchBox');

    await expect(searchInput).toBeVisible();

    const searchQueryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.status() === 200
    );

    await searchInput.click();
    await searchInput.fill('sample_data');
    await searchQueryResponse;

    await expect(
      page.getByTestId('global-search-suggestion-box')
    ).toBeVisible();
  });
});
