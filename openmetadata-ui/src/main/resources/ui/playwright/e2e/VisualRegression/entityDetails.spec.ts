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
import { installVisualData, VISUAL_ENTITIES } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
} from '../../utils/visualRegression';

test('classic table schema matches baseline', async ({ page }) => {
  const table = VISUAL_ENTITIES.find(({ type }) => type === 'table');
  if (!table) throw new Error('The table visual fixture is required.');
  await prepareVisualTheme(page, 'light', 'classic');
  await installVisualData(page, 'populated', 'classic');
  await gotoForScreenshot(page, table.route, {
    readyTestId: 'entity-header-display-name',
  });
  await expect(
    page.getByRole('rowheader').filter({ hasText: 'order_id' })
  ).toBeVisible();
  await expectVisualScreenshot(page, 'table-schema', 'light');
});
