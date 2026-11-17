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
  VISUAL_THEMES,
} from '../../utils/visualRegression';

for (const theme of VISUAL_THEMES) {
  test(`My Data dashboard ${theme}`, async ({ page }) => {
    await prepareVisualTheme(page, theme);
    await installVisualData(page);
    await gotoForScreenshot(page, '/my-data', { readyTestId: 'my-data-page' });
    await expect(page.getByTestId('user-assets-list')).toBeVisible();
    await expectVisualScreenshot(page, 'ai-my-data', theme);
  });
}
