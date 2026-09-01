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

import { Locator, Page } from '@playwright/test';

/**
 * Scopes a row lookup to the test's own entity by unique name rather than by
 * position. Position-based lookups break as soon as unrelated rows appear,
 * which is the dominant source of order-dependent failures in a shared instance.
 *
 * Defaults to `page.getByRole('row')` rather than a `[role="row"]` CSS
 * selector: this repo's Ant Design tables render `<tr>` with an *implicit*
 * ARIA row role that a CSS attribute selector never matches (there is no
 * literal `role` attribute in the DOM), while `getByRole` resolves the
 * computed accessible role either way. Pass an explicit `rowSelector` (e.g.
 * `.rdg-row`) for react-data-grid tables, which render rows as `div`s.
 *
 * `hasText` matches by substring, so a `name` that is a prefix of another
 * row's text (e.g. "Team" vs. "Team A") yields a multi-element locator and a
 * Playwright strict-mode violation on the first action against it. That
 * failure is loud and immediate — the acceptable tradeoff versus silently
 * acting on the wrong row — so callers with colliding names should pass a
 * more specific `name` or `rowSelector` rather than work around it here.
 */
export const getRowByName = (
  page: Page,
  name: string,
  rowSelector?: string
): Locator => {
  const rows = rowSelector ? page.locator(rowSelector) : page.getByRole('row');

  return rows.filter({ hasText: name });
};
