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

export type UiTheme = 'light' | 'dark';

// Must match the `UntitledUIThemeProvider` defaults
// (src/context/UntitledUIThemeProvider/theme-provider.tsx).
const THEME_STORAGE_KEY = 'ui-theme';
const DARK_MODE_CLASS = 'dark-mode';

const THEME_REGISTERED = Symbol.for('pw.theme.seeded');

/**
 * Seed the theme before the app boots, so the first paint already uses it.
 * Call before the first `page.goto`. Seeding only once per tab lets a test
 * still switch the theme at runtime (via `ThemeModeSwitcher`) without the
 * init script reverting it on the next navigation.
 */
export const seedTheme = async (page: Page, theme: UiTheme): Promise<void> => {
  const pageWithFlag = page as Page & { [THEME_REGISTERED]?: boolean };
  if (pageWithFlag[THEME_REGISTERED]) {
    return;
  }
  pageWithFlag[THEME_REGISTERED] = true;

  await page.addInitScript(
    ([storageKey, value]) => {
      if (!globalThis.sessionStorage.getItem('__pw_theme_seeded')) {
        globalThis.localStorage.setItem(storageKey, value);
        globalThis.sessionStorage.setItem('__pw_theme_seeded', '1');
      }
    },
    [THEME_STORAGE_KEY, theme]
  );
};

export const expectTheme = async (
  page: Page,
  theme: UiTheme
): Promise<void> => {
  const root = page.locator('html');
  const darkClass = new RegExp(`(^|\\s)${DARK_MODE_CLASS}(\\s|$)`);

  if (theme === 'dark') {
    await expect(root).toHaveClass(darkClass);
  } else {
    await expect(root).not.toHaveClass(darkClass);
  }
};

/**
 * Asserts the painted surface behind `locator` matches the theme: the first
 * opaque background up the tree must be dark (luminance < 0.3) in
 * dark mode and light (> 0.7) in light mode. Catches portals and surfaces
 * that ignore the theme even though `html.dark-mode` is set.
 */
export const expectSurfaceTheme = async (
  locator: Locator,
  theme: UiTheme
): Promise<void> => {
  const luminance = await locator.evaluate((element) => {
    // A 1x1 canvas normalises any CSS colour (oklch, color-mix, …) to sRGB.
    const context = document.createElement('canvas').getContext('2d', {
      willReadFrequently: true,
    });
    let node: Element | null = element;
    while (node && context) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      // Skip translucent layers (e.g. a modal backdrop): only an opaque
      // background is the surface the content is actually painted on.
      if (a === 255) {
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      }
      node = node.parentElement;
    }

    return 1;
  });

  if (theme === 'dark') {
    expect(luminance).toBeLessThan(0.3);
  } else {
    expect(luminance).toBeGreaterThan(0.7);
  }
};
