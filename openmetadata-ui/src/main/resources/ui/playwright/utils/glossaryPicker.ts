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

// Opens the picker and waits for the treegrid to render.
//
// The picker uses TreeSelect's custom-trigger path (renderTrigger + onClick={toggle}),
// so the trigger never carries `aria-expanded` — the popover's open state is only
// observable via the treegrid appearing. Both attempts have a bounded timeout so a
// genuine failure surfaces as "treegrid never rendered" instead of "browser closed"
// from the enclosing 180s test timeout (which is what the old retry — an unbounded
// waitFor after `force: true` — produced under merge-group shard load).
//
// Issue: https://github.com/open-metadata/OpenMetadata/issues/33640
export const openGlossaryPicker = async (
  page: Page,
  trigger: Locator,
  options?: { force?: boolean }
) => {
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeEnabled();

  const treeLocator = tree(page);

  const clickAndAwaitOpen = async (clickOptions?: { force?: boolean }) => {
    await trigger.click(clickOptions);
    await treeLocator.waitFor({ state: 'visible', timeout: 5_000 });
  };

  try {
    await clickAndAwaitOpen({ force: options?.force });
  } catch {
    // Retry: first click didn't open the popover (react-aria trigger race on
    // slow shards); force is the last resort before we give up. The
    // `no-force-option` rule pattern-matches literal `click({ force: true })`
    // call sites — this one hides behind `clickAndAwaitOpen`, so no suppress.
    await clickAndAwaitOpen({ force: true });
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

// The add/edit control of a glossary widget, inside `scope`.
export const glossaryWidgetTrigger = (
  scope: Page | Locator,
  action: 'Add' | 'Edit' = 'Add'
) =>
  scope
    .getByTestId('glossary-container')
    .getByTestId(action === 'Add' ? 'add-tag' : 'edit-button');

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
          (response) =>
            response.request().method() === 'PATCH' &&
            response.url().includes('/api/v1/') &&
            !response.url().includes('/api/v1/analytics')
        );
  }

  await apply.click();
  await patchRequest;

  await expect(page.getByTestId('update-btn')).not.toBeVisible();
};

// Open, pick one term, apply — the whole flow for a single-term assignment.
export const pickGlossaryTerm = async (
  page: Page,
  trigger: Locator,
  term: GlossaryTermRef,
  patchUrl?: string | ((response: Response) => boolean) | false
) => {
  await openGlossaryPicker(page, trigger);
  await toggleGlossaryTermInPicker(page, term);
  await applyGlossaryPicker(page, patchUrl);
};
