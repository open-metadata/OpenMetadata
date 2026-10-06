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
import {
  gotoForScreenshot,
  SCREENSHOT_OPTS,
} from '../../utils/visualRegression';
import { enableAiAppMode } from '../Utils/appMode';

/**
 * AI-mode counterparts of the classic baselines. The antd → core migration
 * (open-metadata/openmetadata-collate#6884) targets the AI shell, which the
 * classic static-page suite never renders, so layout changes there landed with
 * no visual gate at all.
 *
 * Masks follow the classic suite: anything that counts or names seeded data
 * varies per run, while the shell, headers and layout stay under test.
 */
const PAGES: {
  name: string;
  route: string;
  /** An element the page always renders once its content has mounted. */
  readyTestId: string;
  mask?: string[];
}[] = [
  {
    name: 'ai-home',
    route: '/my-data',
    readyTestId: 'my-data-page',
    mask: [
      '[data-testid^="stat-card-"][data-testid$="-value"]',
      '[data-testid^="stat-card-"][data-testid$="-subtitle"]',
      '[data-testid^="stat-card-"][data-testid$="-breakdown"]',
      '[data-testid="my-data-assets"]',
    ],
  },
  {
    name: 'ai-explore',
    route: '/explore',
    readyTestId: 'explore-tree',
    mask: [
      '[data-testid="explore-search-card-stats"]',
      '[data-testid="search-results-count"]',
      '[data-testid="explore-tree"]',
    ],
  },
  {
    name: 'ai-roles',
    route: '/settings/access/roles',
    readyTestId: 'roles-list-table',
    mask: [
      '[data-testid="roles-list-table"] tbody',
      '[data-testid="roles-list-container"] [data-testid="pagination"]',
    ],
  },
  { name: 'ai-bots', route: '/settings/bots', readyTestId: 'add-bot' },
];

test.beforeEach(async ({ page }) => {
  await enableAiAppMode(page);
});

for (const { name, route, readyTestId, mask } of PAGES) {
  test(`${name} matches baseline`, async ({ page }) => {
    await gotoForScreenshot(page, route, { readyTestId });
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, {
      ...SCREENSHOT_OPTS,
      mask: (mask ?? []).map((selector) => page.locator(selector)),
    });
  });
}
