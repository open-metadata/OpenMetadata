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

/**
 * Scopes a row lookup to the test's own entity by unique name rather than by
 * position. Position-based lookups break as soon as unrelated rows appear,
 * which is the dominant source of order-dependent failures in a shared instance.
 */
export const getRowByName = (
  page: Page,
  name: string,
  rowSelector = '[role="row"]'
): Locator => page.locator(rowSelector).filter({ hasText: name });

export const expectRowFor = async (page: Page, name: string): Promise<void> => {
  await expect(getRowByName(page, name)).toBeVisible();
};
