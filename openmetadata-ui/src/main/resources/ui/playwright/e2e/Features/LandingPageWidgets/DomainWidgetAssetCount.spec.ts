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

/**
 * Regression tests for two bugs that prevented the Domains widget on the
 * home page from reflecting updated asset counts immediately after an asset
 * was added to a domain.
 *
 * Bug 1 — Stale React Query cache:
 *   addAssetsToDomain did not call
 *   queryClient.invalidateQueries({ queryKey: domainAssetsCountQueryKey }),
 *   so the widget served the 5-minute-stale cached count (0) instead of
 *   re-fetching after the mutation.
 *
 * Bug 2 — Missing useMemo dependency:
 *   `assetsCounts` was consumed inside the `domainsList` useMemo but was
 *   absent from its dependency array. Even after the cache was invalidated
 *   and state updated, the memoised JSX was not re-evaluated, so the stale
 *   number remained visible.
 */

import { expect, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { TopicClass } from '../../../support/entity/TopicClass';
import {
  getDefaultAdminAPIContext,
  redirectToHomePage,
  removeLandingBanner,
} from '../../../utils/common';
import {
  addAssetsToDomain,
  checkAssetsCount,
} from '../../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const DOMAIN_WIDGET_SELECTOR = (domainId: string) =>
  [
    `[data-testid="domain-card-${domainId}"] .domain-card-count`,
    `[data-testid="domain-card-${domainId}"] .domain-card-full-count`,
  ].join(', ');

test.describe('Domains widget — asset count regression', () => {
  const domain = new Domain();
  const topic = new TopicClass();

  // getDefaultAdminAPIContext reads the pre-saved admin token from
  // playwright/.auth/admin-api-token.json (written by global setup) so API
  // calls are authenticated without needing a page to navigate to the app.
  // browser.newPage() / getApiContext() would read from IndexedDB which is
  // empty on a page that has never navigated, causing a 401.
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
    await domain.create(apiContext);
    await topic.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
    await topic.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test('widget count updates immediately after assets are added — no stale cache', async ({
    page,
  }) => {
    test.slow();

    // Add one asset to the domain via the full UI flow. This exercises the
    // mutation path that must call invalidateQueries (Bug 1 fix).
    await sidebarClick(page, SidebarItem.DOMAIN);
    await addAssetsToDomain(page, domain, [topic], true, false);
    await checkAssetsCount(page, 1);

    // Navigate to the home page and verify the Domains widget shows 1, not 0.
    // Before Bug 1 fix: widget served the 5-minute stale cached count (0).
    // Before Bug 2 fix: even with cache invalidated, useMemo never re-ran.
    await redirectToHomePage(page);
    await removeLandingBanner(page);
    await waitForAllLoadersToDisappear(page);

    const domainId = domain.responseData.id ?? domain.data.name;
    const cardSelector = DOMAIN_WIDGET_SELECTOR(domainId);

    await expect
      .poll(
        async () => {
          const widget = page.getByTestId('KnowledgePanel.Domains');

          if (!(await widget.isVisible().catch(() => false))) {
            return null;
          }
          const card = widget.locator(cardSelector).first();

          if (!(await card.isVisible().catch(() => false))) {
            return null;
          }

          return (await card.textContent())?.trim() ?? null;
        },
        {
          message: 'Domains widget must show count 1 for the test domain',
          timeout: 60_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe('1');
  });
});
