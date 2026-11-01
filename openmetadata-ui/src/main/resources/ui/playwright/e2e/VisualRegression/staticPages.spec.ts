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
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
} from '../../utils/visualRegression';

// Classic mode is intentionally light-only. Its native counterpart is covered
// by the two-theme page catalog rather than forcing an unsupported appearance.
const PAGES = [
  ['landing-page', '/my-data', 'topic-card-platformHealth'],
  ['explore', '/explore', 'entity-summary-panel-container'],
  ['glossary', '/glossary/VisualBusinessGlossary', 'Customer'],
  ['settings', '/settings', 'preferences'],
  [
    'database-services',
    '/settings/services/databases',
    'service-name-visual_warehouse',
  ],
  ['data-quality', '/data-quality', 'dq-dashboard-container'],
  ['incident-manager', '/incident-manager', 'test-case-incident-manager-table'],
  ['users', '/settings/members/users', 'visual_steward'],
  ['teams', '/settings/members/teams', 'team-name-visual_analytics'],
  ['roles', '/settings/access/roles', 'role-name'],
  ['bots', '/settings/bots', 'bot-link-Ingestion bot'],
  ['applications', '/marketplace', 'auto-pilot-application-card'],
] as const;

test.beforeEach(async ({ page }) => {
  await prepareVisualTheme(page, 'light', 'classic');
  await installVisualData(page, 'populated', 'classic');
});

for (const [name, route, readyTestId] of PAGES) {
  test(`${name} matches baseline`, async ({ page }) => {
    await gotoForScreenshot(page, route, { readyTestId });
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    if (name === 'glossary')
      await expect(
        page.getByTestId('activity_feed').getByTestId('count')
      ).toHaveText('5');
    if (name === 'landing-page')
      await expect(
        page.getByTestId('topic-card-platformHealth').getByText(/^Updated /)
      ).toBeVisible();
    if (name === 'data-quality') {
      for (const widget of [
        'data-assets-coverage-pie-chart-widget',
        'entity-health-pie-chart-widget',
        'test-case-status-pie-chart-widget',
      ])
        await expect(page.getByTestId(widget)).toBeVisible();
    }
    await expectVisualScreenshot(page, name, 'light', { maxDiffPixelRatio: 0 });
  });
}

test('landing page with collapsed sidebar matches baseline', async ({
  page,
}) => {
  await gotoForScreenshot(page, '/my-data', {
    readyTestId: 'topic-card-platformHealth',
  });
  await page.getByTestId('sidebar-toggle').click();
  await expect(
    page.getByTestId('topic-card-platformHealth').getByText(/^Updated /)
  ).toBeVisible();
  await expectVisualScreenshot(
    page,
    'landing-page-sidebar-collapsed',
    'light',
    {
      maxDiffPixelRatio: 0,
    }
  );
});
