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
  for (const state of ['initial', 'pending', 'error'] as const) {
    test(`glossary deletion ${state} ${theme}`, async ({ page }) => {
      await prepareVisualTheme(page, theme);
      await installVisualData(page);
      let releaseDelete: (() => void) | undefined;
      let deleteStarted = false;
      if (state === 'pending') {
        await page.route('**/api/v1/**', async (route) => {
          if (route.request().method() !== 'DELETE') return route.fallback();
          deleteStarted = true;
          await new Promise<void>((resolve) => {
            releaseDelete = resolve;
          });
          await route.fulfill({
            status: 503,
            json: { message: 'The visual fixture service is unavailable.' },
          });
        });
      }
      await gotoForScreenshot(page, '/glossary/VisualBusinessGlossary', {
        readyTestId: 'entity-header-display-name',
      });
      await page.getByTestId('manage-button').click();
      await expect(page.getByTestId('delete-button')).toBeVisible();
      await page.getByTestId('delete-button').click();
      const modal = page.getByTestId('delete-modal');
      await expect(modal).toBeVisible();
      try {
        if (state !== 'initial') {
          await modal.getByTestId('confirm-button').click();
          if (state === 'pending') {
            await expect.poll(() => deleteStarted).toBe(true);
            // The glossary leaves its confirmation open until the request settles.
            await expect(modal).toBeVisible();
          } else {
            await expect(page.getByRole('alertdialog')).toContainText(
              'The visual fixture service is unavailable.'
            );
          }
        }
        await expectVisualScreenshot(page, `delete-${state}`, theme, {
          allowErrorFeedback: state === 'error',
        });
      } finally {
        // Finish the held response before Playwright tears down its route.
        const pendingResponse = deleteStarted
          ? page.waitForResponse(
              (response) => response.request().method() === 'DELETE'
            )
          : undefined;
        releaseDelete?.();
        if (pendingResponse) await (await pendingResponse).finished();
      }
    });
  }
}
