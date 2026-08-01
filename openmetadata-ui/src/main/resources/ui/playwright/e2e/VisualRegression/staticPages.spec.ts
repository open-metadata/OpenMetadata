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
  waitForLandingWidgetsSettled,
} from '../../utils/visualRegression';

/**
 * Static routes that render deterministically from seeded data.
 * `mask` lists locators whose content varies per environment/run
 * (activity feeds, counts, relative timestamps).
 *
 * Masking convention (see also docs/antd-migration/README.md "Visual
 * regression masking convention"):
 * - Prefer masking the smallest container testid that already exists.
 * - When a page's volatility comes from row/column layout shifting (not
 *   just cell text — e.g. auto-width table columns whose width depends on
 *   the seeded content), mask the whole table container instead of
 *   individual cells: masking cells alone still lets surrounding pixels
 *   move and fail the diff.
 * - Add a new `data-testid` only when no existing selector reaches the
 *   volatile region; keep it small, semantic and consistent with sibling
 *   testids in the same file (see teams/data-testid additions tracked in
 *   OM#30783).
 *
 * Testid corrections vs. the original draft (verified against the running
 * app and the current UI source):
 * - landing-page: `activity-feed-widget` does not exist; the real testid on
 *   the feed widget wrapper is `KnowledgePanel.ActivityFeed`
 *   (src/components/MyData/FeedWidget/FeedWidget.component.tsx). It, and the
 *   other landing-page widgets, are handled by a dedicated test below
 *   because they need `waitForLandingWidgetsSettled` before the screenshot.
 * - explore: `search-summary` does not exist. The volatile regions are the
 *   result-count text (`search-results-count`,
 *   src/components/SearchedData/SearchedData.tsx) and the facet-count tree
 *   in the left sidebar (`explore-tree`,
 *   src/components/Explore/ExploreTree/ExploreTree.tsx). Both are masked.
 * - data-quality: the Data Health aggregate widgets (asset coverage,
 *   entity-health, test-case-status pie charts) all live inside
 *   `dq-dashboard-container`
 *   (src/components/DataQuality/DataQualityDashboard/DataQualityDashboard.component.tsx),
 *   which moves as other specs create/delete tables and tests. Masking that
 *   one container covers all three aggregates in a single selector.
 * - incident-manager: test-case rows (name links, `DateTimeDisplay`
 *   timestamps) are seeded per-run, and the table
 *   (src/components/IncidentManager/IncidentManagerTable.component.tsx)
 *   defines columns with no `width`, so a longer/shorter seeded name shifts
 *   every column after it. Masking individual cells wouldn't stop that
 *   shift, so the whole `test-case-incident-manager-table` is masked.
 * - teams: team/user/asset counts and the seeded team names inside
 *   `team-hierarchy-table`
 *   (src/components/Settings/Team/TeamDetails/TeamHierarchy.tsx) all vary
 *   per run; masked as one table, same reasoning as incident-manager.
 * - roles: seeded role names render through the (static, matches every row)
 *   `[data-testid="role-name"]` link
 *   (src/pages/RolesPage/RolesListPage/RolesListPage.tsx) — no new testid
 *   needed, `page.locator(...)` masks every matching row.
 */
const PAGES: {
  name: string;
  route: string;
  mask?: string[];
  maxDiffPixelRatio?: number;
}[] = [
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
  {
    name: 'data-quality',
    route: '/data-quality',
    mask: ['[data-testid="dq-dashboard-container"]'],
  },
  {
    name: 'incident-manager',
    route: '/incident-manager',
    mask: ['[data-testid="test-case-incident-manager-table"]'],
  },
  { name: 'users', route: '/settings/members/users' },
  {
    name: 'teams',
    route: '/settings/members/teams',
    mask: [
      '[data-testid="team-hierarchy-table"]',
      // Header "Total Users" stat (TeamsInfo.component.tsx) and the
      // Teams/Roles/Policies tab badge counts (TabsLabel.component.tsx,
      // data-testid="count") both move with the same seeded/PW-generated
      // data as the table itself.
      '[data-testid="team-user-count"]',
      '[data-testid="count"]',
    ],
  },
  {
    name: 'roles',
    route: '/settings/access/roles',
    mask: ['[data-testid="role-name"]'],
  },
  { name: 'bots', route: '/settings/bots' },
  { name: 'applications', route: '/marketplace' },
];

for (const { name, route, mask, maxDiffPixelRatio } of PAGES) {
  test(`${name} matches baseline`, async ({ page }) => {
    await gotoForScreenshot(page, route);
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...SCREENSHOT_OPTS,
      ...(maxDiffPixelRatio !== undefined && { maxDiffPixelRatio }),
      mask: (mask ?? []).map((selector) => page.locator(selector)),
    });
  });
}

/**
 * Widgets that render seeded/relationship-derived counts or lists and so
 * vary run-to-run: Data Assets (connected service list), My Data (owned
 * assets), KPI (numeric targets), Total Assets (coverage pie + legend
 * counts), Following (followed-entity list) and Activity Feed. Knowledge
 * Center is static help content and is left unmasked (but still waited-on,
 * since it uses the same WidgetWrapper loading signal).
 *
 * `whats-new-alert-card` (WhatsNewAlert.component.tsx) is the "version
 * toast" the original band-aid comment referred to: it shows until
 * dismissed (tracked in a version-keyed cookie), so whether it renders at
 * all depends on prior interactions with this seeded server, not this
 * page's own data — mask it too rather than depending on that history.
 */
const LANDING_WIDGET_MASKS = [
  '[data-testid="KnowledgePanel.ActivityFeed"]',
  '[data-testid="KnowledgePanel.DataAssets"]',
  '[data-testid="KnowledgePanel.MyData"]',
  '[data-testid="KnowledgePanel.KPI"]',
  '[data-testid="KnowledgePanel.TotalAssets"]',
  '[data-testid="KnowledgePanel.Following"]',
  '[data-testid="whats-new-alert-card"]',
];

test('landing page matches baseline', async ({ page }) => {
  await gotoForScreenshot(page, '/my-data');
  await waitForLandingWidgetsSettled(page);
  await expect(page).toHaveScreenshot('landing-page.png', {
    ...SCREENSHOT_OPTS,
    mask: LANDING_WIDGET_MASKS.map((selector) => page.locator(selector)),
  });
});

test('landing page with collapsed sidebar matches baseline', async ({
  page,
}) => {
  await gotoForScreenshot(page, '/my-data');
  await waitForLandingWidgetsSettled(page);
  await page.getByTestId('sidebar-toggle').click();
  await expect(page).toHaveScreenshot('landing-page-sidebar-collapsed.png', {
    ...SCREENSHOT_OPTS,
    mask: LANDING_WIDGET_MASKS.map((selector) => page.locator(selector)),
  });
});
