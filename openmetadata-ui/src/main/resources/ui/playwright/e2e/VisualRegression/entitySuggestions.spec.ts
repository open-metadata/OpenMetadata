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
import { Locator } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';
import {
  installVisualData,
  VisualEntity,
  VISUAL_ENTITIES,
} from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
} from '../../utils/visualRegression';

const ADMIN = {
  id: '00000000-0000-4000-8000-000000000999',
  name: 'admin',
  fullyQualifiedName: 'admin',
  type: 'user',
  displayName: 'Administrator',
};

// Served only to this spec, so the shared task fixtures (and every task count
// other baselines record) stay unchanged.
const SUGGESTION_FIELD_PATHS = [
  'description',
  'columns.order_id.description',
  'columns.revenue.description',
  'columns.customer.description',
];

// The count badge sits above and right of the avatar, outside the header's own
// box, so the shot clips the page around the header with room for it.
const BADGE_MARGIN = 16;

const headerClip = async (header: Locator) => {
  const box = await header.boundingBox();
  if (!box) throw new Error('The suggestions header must be on screen.');

  return {
    x: box.x - BADGE_MARGIN,
    y: box.y - BADGE_MARGIN,
    width: box.width + BADGE_MARGIN * 2,
    height: box.height + BADGE_MARGIN * 2,
  };
};

const buildSuggestionTasks = (table: VisualEntity['entity']) =>
  SUGGESTION_FIELD_PATHS.map((fieldPath, index) => ({
    id: `00000000-0000-4000-8400-00000000000${index}`,
    taskId: `TASK-0090${index}`,
    name: `TASK-0090${index}`,
    fullyQualifiedName: `TASK-0090${index}`,
    category: 'MetadataUpdate',
    type: 'Suggestion',
    status: 'Open',
    priority: 'Medium',
    about: {
      id: table.id,
      type: 'table',
      name: table.name,
      fullyQualifiedName: table.fullyQualifiedName,
    },
    createdBy: ADMIN,
    createdById: ADMIN.id,
    createdAt: 1768471200000,
    updatedAt: 1768471200000,
    payload: {
      suggestionType: 'Description',
      fieldPath,
      suggestedValue: `Suggested description ${index + 1}`,
    },
  }));

for (const theme of VISUAL_THEMES) {
  test(`table suggestions match baselines (${theme})`, async ({ page }) => {
    const table = VISUAL_ENTITIES.find(({ type }) => type === 'table');
    if (!table) throw new Error('The table visual fixture is required.');
    const suggestions = buildSuggestionTasks(table.entity);

    await prepareVisualTheme(page, theme);
    await installVisualData(page, 'populated');
    // Registered after the shared fixtures, so it wins for suggestion lists only.
    await page.route('**/api/v1/tasks?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('type') !== 'Suggestion') {
        await route.fallback();

        return;
      }
      await route.fulfill({
        json: {
          data: suggestions,
          paging: { total: suggestions.length },
        },
      });
    });

    await gotoForScreenshot(page, table.route, {
      readyTestId: 'entity-header-display-name',
    });
    // The avatar edge and the solid count change ~500 px, far under the default
    // 1% page tolerance, so the shot is the header alone with no tolerance.
    const slider = page.getByTestId('suggestions-slider');
    const avatar = slider.getByTestId(`avatar-carousel-item-${ADMIN.id}`);
    await expect(avatar).toBeVisible();
    await expectVisualScreenshot(page, 'table-suggestions', theme, {
      clip: await headerClip(slider),
      maxDiffPixelRatio: 0,
    });

    await avatar.click();
    await expect(page.getByTestId('accept-all-suggestions')).toBeVisible();
    // The avatar's user popover opens on hover; keep it out of the image.
    await page.mouse.move(0, 0);
    await expectVisualScreenshot(page, 'table-suggestions-selected', theme, {
      clip: await headerClip(slider),
      maxDiffPixelRatio: 0,
    });
  });
}
