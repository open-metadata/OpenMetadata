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
import { selectOptionWithRetry } from './common';

/**
 * The rows-per-page control of a `PaginationCardWithControls`. Its accessible name is the static
 * "Records" label and its text is the current size, so the same locator both picks the control
 * and reads the value back.
 *
 * Always scope it: several pages can be mounted at once (AI mode keeps every visited cacheable
 * route alive), so an unscoped lookup can match a backgrounded page's control.
 */
export const getRecordsControl = (scope: Locator): Locator =>
  scope.getByRole('button', { name: 'Records' });

/**
 * Choose a rows-per-page size and wait for the control to show it.
 *
 * The options render in a portal, so they are looked up on the page rather than under the
 * control. `selectOptionWithRetry` handles the one case Playwright's auto-waiting cannot: a
 * trigger click that lands before the Select is interactive opens nothing, so there is no option
 * to wait for — it re-clicks, guarded on `aria-expanded` so a retry cannot toggle an already-open
 * listbox shut.
 */
export const selectPageSize = async (
  page: Page,
  records: Locator,
  size: string
): Promise<void> => {
  await selectOptionWithRetry(
    records,
    page.getByTestId(`rows-per-page-option-${size}`)
  );

  await expect(records).toHaveText(size);
};
