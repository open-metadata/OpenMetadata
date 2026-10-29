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
  ['landing-page', '/my-data'],
  ['explore', '/explore'],
  ['glossary', '/glossary/VisualBusinessGlossary'],
  ['settings', '/settings'],
  ['database-services', '/settings/services/databases'],
  ['data-quality', '/data-quality'],
  ['incident-manager', '/incident-manager'],
  ['users', '/settings/members/users'],
  ['teams', '/settings/members/teams'],
  ['roles', '/settings/access/roles'],
  ['bots', '/settings/bots'],
  ['applications', '/marketplace'],
] as const;

test.beforeEach(async ({ page }) => {
  await prepareVisualTheme(page, 'light', 'classic');
  await installVisualData(page, 'populated', 'classic');
});

for (const [name, route] of PAGES) {
  test(`${name} matches baseline`, async ({ page }) => {
    await gotoForScreenshot(page, route);
    await expect(page.getByTestId('app-shell')).toHaveCount(0);
    await expectVisualScreenshot(page, name, 'light');
  });
}

test('landing page with collapsed sidebar matches baseline', async ({
  page,
}) => {
  await gotoForScreenshot(page, '/my-data');
  await page.getByTestId('sidebar-toggle').click();
  await expectVisualScreenshot(page, 'landing-page-sidebar-collapsed', 'light');
});
