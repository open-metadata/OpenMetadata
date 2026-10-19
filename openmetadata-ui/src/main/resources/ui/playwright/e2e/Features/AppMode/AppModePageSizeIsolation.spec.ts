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

/**
 * `pageSize` is one URL query param shared by every page, and AI mode keeps every visited
 * cacheable route mounted (see {@link KeepAliveRoutes}). So a page reads back sizes that belong
 * to other pickers, and a hidden page that reconciles the param to its own scale overwrites the
 * choice made on the page the user is actually looking at.
 *
 * Explore (15/25/50) and the Connections grid (12/24/48) are the pair that exposed it: with
 * Explore in the cache, choosing 24 on Connections snapped back to 15 — a size the grid's picker
 * has no option for, so its Select fell through to the placeholder and showed a value the
 * dropdown could not offer back, while the grid paged in 15s.
 *
 * Both halves are asserted: a size from elsewhere must not become this page's size, and this
 * page's size must survive a backgrounded route that cannot offer it.
 */

import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { getRecordsControl, selectPageSize } from '../../../utils/pagination';
import { enableAiAppMode, goToAppModeRoute } from '../../Utils/appMode';
import { expect, test } from './fixtures';

test.describe(
  'AppMode — kept-alive page size isolation',
  { tag: ['@Integration'] },
  () => {
    test('a page size the grid cannot offer never becomes the grid page size', async ({
      page,
    }) => {
      await enableAiAppMode(page);

      // 15 is the app-wide scale's size, and it reaches this page the way any shared value does:
      // left in the query param by another page, or followed in from a link someone shared.
      await page.goto('/connections?pageSize=15', {
        waitUntil: 'domcontentloaded',
      });
      await waitForAllLoadersToDisappear(page);

      const results = page.getByTestId('connections-results');

      await expect(results).toBeVisible();

      // Reconciled to this picker's own scale. Left at 15 it reaches the Select as a selectedKey
      // matching no item, which renders as the placeholder.
      await expect(getRecordsControl(results)).toHaveText('12');
    });

    test('a backgrounded route does not correct the page size out from under the page on screen', async ({
      page,
    }) => {
      await enableAiAppMode(page);

      await page.goto('/explore', { waitUntil: 'domcontentloaded' });
      await waitForAllLoadersToDisappear(page);

      const explore = page.getByTestId('explore-page');
      // Give Explore a size of its own first, so what follows proves the two pages keep separate
      // sizes rather than merely agreeing on a default.
      await selectPageSize(page, getRecordsControl(explore), '25');

      await goToAppModeRoute(page, '/connections');

      const results = page.getByTestId('connections-results');

      await expect(results).toBeVisible();

      const records = getRecordsControl(results);
      await selectPageSize(page, records, '24');

      await expect(page).toHaveURL(/pageSize=24/);

      // Explore is mounted behind this page and 24 is not one of its sizes. A regressed Explore
      // writes its own size back to the shared param from here.
      await expect(records).toHaveText('24');

      await goToAppModeRoute(page, '/explore');

      // The other direction: keeping out of the grid's business must not cost Explore its own
      // choice either.
      //
      // Returning to the grid is deliberately not asserted. Sidebar navigation carries no query
      // string, so the grid starts from its own default rather than the 24 chosen earlier —
      // page size is not remembered per page, which is a separate change.
      await expect(getRecordsControl(explore)).toHaveText('25');
    });
  }
);
