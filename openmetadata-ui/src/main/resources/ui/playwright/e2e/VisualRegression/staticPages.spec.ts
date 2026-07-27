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
import { expect, test } from '@playwright/test';
import {
  gotoForScreenshot,
  SCREENSHOT_OPTS,
} from '../../utils/visualRegression';

/**
 * Static routes that render deterministically from seeded data.
 * `mask` lists locators whose content varies per environment/run
 * (activity feeds, counts, relative timestamps).
 *
 * Testid corrections vs. the original draft (verified against the running
 * app and the current UI source, see task-5-report.md):
 * - landing-page: `activity-feed-widget` does not exist; the real testid on
 *   the feed widget wrapper is `KnowledgePanel.ActivityFeed`
 *   (src/components/MyData/FeedWidget/FeedWidget.component.tsx).
 * - explore: `search-summary` does not exist. The volatile regions are the
 *   result-count text (`search-results-count`,
 *   src/components/SearchedData/SearchedData.tsx) and the facet-count tree
 *   in the left sidebar (`explore-tree`,
 *   src/components/Explore/ExploreTree/ExploreTree.tsx). Both are masked.
 */
const PAGES: {
  name: string;
  route: string;
  mask?: string[];
}[] = [
  {
    name: 'landing-page',
    route: '/my-data',
    mask: ['[data-testid="KnowledgePanel.ActivityFeed"]'],
  },
  {
    name: 'explore',
    route: '/explore',
    mask: [
      '[data-testid="search-results-count"]',
      '[data-testid="explore-tree"]',
    ],
  },
  { name: 'glossary', route: '/glossary' },
  { name: 'settings', route: '/settings' },
  { name: 'database-services', route: '/settings/services/databases' },
  { name: 'data-quality', route: '/data-quality' },
  { name: 'incident-manager', route: '/incident-manager' },
  { name: 'users', route: '/settings/members/users' },
  { name: 'teams', route: '/settings/members/teams' },
  { name: 'roles', route: '/settings/access/roles' },
  { name: 'bots', route: '/settings/bots' },
  { name: 'applications', route: '/marketplace' },
];

for (const { name, route, mask } of PAGES) {
  test(`${name} matches baseline`, async ({ page }) => {
    await gotoForScreenshot(page, route);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...SCREENSHOT_OPTS,
      mask: (mask ?? []).map((selector) => page.locator(selector)),
    });
  });
}

test('landing page with collapsed sidebar matches baseline', async ({
  page,
}) => {
  await gotoForScreenshot(page, '/my-data');
  await page.getByTestId('sidebar-toggle').click();
  await expect(page).toHaveScreenshot('landing-page-sidebar-collapsed.png', {
    ...SCREENSHOT_OPTS,
    mask: [page.locator('[data-testid="KnowledgePanel.ActivityFeed"]')],
  });
});
