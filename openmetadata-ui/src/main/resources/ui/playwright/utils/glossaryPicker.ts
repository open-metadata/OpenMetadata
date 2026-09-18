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
import { expect, Locator, Page, Response } from '@playwright/test';

// Drives the picker popover: portaled, and nothing is saved until Apply.

export type GlossaryTermRef = {
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
};

const POPOVER = 'glossary-term-picker-popover';

// Scoped to the popover rather than a placeholder, which is translated.
const searchBox = (page: Page) => page.getByTestId(POPOVER).locator('input');

const tree = (page: Page) =>
  page.getByTestId(POPOVER).locator('[role="treegrid"]');

const termRow = (page: Page, term: GlossaryTermRef) =>
  page.getByTestId(`tree-node-${term.fullyQualifiedName}`);

// Rows are keyed by FQN; callers that only know a display name match on text.
export const glossaryPickerRow = (page: Page, name: string) =>
  page
    .getByTestId(POPOVER)
    .locator('[data-testid^="tree-node-"]')
    .filter({ hasText: name });

// The row's control carries the selected state.
export const isGlossaryTermSelected = (row: Locator) =>
  row
    .locator('[data-selected="true"]')
    .count()
    .then((n) => n > 0);

export const searchGlossaryPicker = async (page: Page, term: string) => {
  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('glossary')
  );
  await searchBox(page).fill(term);
  await searchResponse;
};

// In slower CI environments the first click can land before the react-aria
// trigger is fully interactive, so retry once if the popover doesn't appear.
export const openGlossaryPicker = async (
  page: Page,
  trigger: Locator,
  options?: { force?: boolean }
) => {
  await expect(trigger).toBeVisible();
  await trigger.click({ force: options?.force });

  const treeLocator = tree(page);

  try {
    await treeLocator.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    // eslint-disable-next-line playwright/no-force-option -- retry: first click may not have registered on the react-aria trigger
    await trigger.click({ force: true });
    await treeLocator.waitFor({ state: 'visible' });
  }
};

// Search results arrive nested and pre-expanded, so no manual expanding.
export const toggleGlossaryTermInPicker = async (
  page: Page,
  term: GlossaryTermRef
) => {
  const row = termRow(page, term);

  if (!(await row.isVisible())) {
    await searchGlossaryPicker(page, term.displayName ?? term.name);
  }

  await expect(row).toBeVisible();
  await row.click();
};

// One PATCH however many terms toggled; `false` where Apply only updates state.
export const applyGlossaryPicker = async (
  page: Page,
  patchUrl?: string | ((response: Response) => boolean) | false
) => {
  const apply = page.getByTestId('update-btn');
  await expect(apply).toBeEnabled();

  let patchRequest = null;
  if (patchUrl !== false) {
    patchRequest = patchUrl
      ? page.waitForResponse(patchUrl)
      : page.waitForResponse(
          (response) => response.request().method() === 'PATCH'
        );
  }

  await apply.click();
  await patchRequest;

  await expect(page.getByTestId('update-btn')).not.toBeVisible();
};
