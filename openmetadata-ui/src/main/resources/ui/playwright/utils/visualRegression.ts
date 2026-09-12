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
import { expect, Page } from '@playwright/test';
import { waitForPageLoaded } from './polling';

export const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z');
export const VISUAL_GLOSSARY_NAME = 'pw_visual_regression_glossary';
export const VISUAL_GLOSSARY_DISPLAY_NAME = 'Visual regression glossary';
export const VISUAL_GLOSSARY_TERM_NAME = 'Account number';

/** Shared options for every toHaveScreenshot assertion in the visual suite. */
export const SCREENSHOT_OPTS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.01,
};

// Scroll behaviour only. `animation: none` used to live here too, but rc-motion
// drives every Ant overlay off animationend: suppressing the animation leaves
// the dropdown stuck with `pointer-events: none`, so a trusted click falls
// through to whatever is underneath. toHaveScreenshot already pins animations
// at capture time via SCREENSHOT_OPTS, so freezing them here bought nothing and
// cost every interactive baseline a dispatchEvent workaround.
const FREEZE_CSS = `
  * { scroll-behavior: auto !important; }
`;

/**
 * Navigate with a frozen clock so relative timestamps ("x minutes ago")
 * render identically on every run, then quiesce the page.
 *
 * Deviation from the original brief: the brief's snippet used
 * `page.waitForLoadState('networkidle')`, but this repo's eslint config
 * enforces `playwright/no-networkidle` (networkidle is unreliable with
 * websockets/polling — see PLAYWRIGHT_DEVELOPER_HANDBOOK.md). We use the
 * project's existing replacement, `waitForPageLoaded`, which waits for
 * `domcontentloaded` plus all loader spinners to disappear.
 */
export const gotoForScreenshot = async (page: Page, path: string) => {
  await page.clock.setFixedTime(FIXED_DATE);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForPageLoaded(page);
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.scrollingElement ?? document.documentElement).scrollTo(0, 0);
    // Entity pages and drawers can scroll independently of the document.
    document
      .querySelectorAll<HTMLElement>('body, body *')
      .forEach((element) => {
        if (element.scrollTop || element.scrollLeft) {
          element.scrollTo(0, 0);
        }
      });
  });
};

export const gotoVisualGlossary = async (page: Page) => {
  await gotoForScreenshot(page, `/glossary/${VISUAL_GLOSSARY_NAME}`);
  await expect(page.getByTestId('entity-header-display-name')).toHaveText(
    VISUAL_GLOSSARY_DISPLAY_NAME
  );
  await expect(page.getByTestId(VISUAL_GLOSSARY_TERM_NAME)).toBeVisible();
};
