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
import { expect, Locator, Page } from '@playwright/test';
import { expectVisualScreenshot, VisualTheme } from './visualRegression';

export const expectVisualMenuScreenshots = async (
  page: Page,
  name: string,
  theme: VisualTheme,
  menu: Locator,
  popup: Locator
) => {
  await expect(menu).toBeVisible();
  await expect(popup).toBeInViewport({ ratio: 1 });
  const options = menu.getByRole('option');
  await expect(options).not.toHaveCount(0);
  const choices = await options.all();
  let captures = 0;
  for (const [index, option] of choices.entries()) {
    const bounds = await option.boundingBox();
    const viewport = await popup.boundingBox();
    if (!bounds || !viewport)
      throw new Error('Menu choices require visible layout bounds.');
    // The listbox can extend beyond its scrolling popup. Each newly revealed
    // viewport protects choices omitted from the initial screenshot.
    if (
      captures === 0 ||
      bounds.y < viewport.y ||
      bounds.y + bounds.height > viewport.y + viewport.height
    ) {
      await option.scrollIntoViewIfNeeded();
      await expect(option).toBeInViewport({ ratio: 1 });
      await expectVisualScreenshot(
        page,
        captures === 0 ? name : `${name}-scroll-${index + 1}`,
        theme,
        { target: popup, maxDiffPixelRatio: 0 }
      );
      captures++;
    }
    await expect(option).toBeInViewport({ ratio: 1 });
  }
  await expect(options).toHaveCount(choices.length);
};
