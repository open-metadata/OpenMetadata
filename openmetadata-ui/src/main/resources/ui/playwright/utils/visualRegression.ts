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
import { Page } from '@playwright/test';
import { waitForPageLoaded } from './polling';

export const FIXED_DATE = new Date('2026-01-15T10:00:00.000Z');

/** Shared options for every toHaveScreenshot assertion in the visual suite. */
export const SCREENSHOT_OPTS = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.01,
};

const FREEZE_CSS = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
  html { scroll-behavior: auto !important; }
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
  await page.goto(path);
  await waitForPageLoaded(page);
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => window.scrollTo(0, 0));
};
