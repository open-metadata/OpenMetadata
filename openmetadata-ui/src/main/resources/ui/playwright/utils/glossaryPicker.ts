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
import { clickOutside } from './common';

// Drives the picker popover: portaled, and nothing is saved until Apply.

export type GlossaryTermRef = {
  name: string;
  displayName?: string;
  fullyQualifiedName: string;
};

// The popover's testid varies per instance; this class is set by the component.
const POPOVER = '.glossary-term-picker-popover';

// Only the button and custom-trigger variants put a search box in the popover.
const popoverSearchBox = (page: Page) => page.locator(POPOVER).locator('input');

const tree = (page: Page) => page.locator(POPOVER).locator('[role="treegrid"]');

// Terms are keyed by FQN, glossary roots by bare `name` — accept both spellings.
const termRow = (page: Page, term: GlossaryTermRef) =>
  page
    .getByTestId(`tree-node-${term.fullyQualifiedName}`)
    .or(
      page.getByTestId(
        `tree-node-${term.fullyQualifiedName.replace(/^"|"$/g, '')}`
      )
    )
    .or(page.getByTestId(`tree-node-${term.name}`));

// Rows are keyed by FQN; callers that only know a display name match on text.
export const glossaryPickerRow = (page: Page, name: string) =>
  page
    .locator(POPOVER)
    .locator('[data-testid^="tree-node-"]')
    .filter({ hasText: name });

// The row's control carries the selected state.
export const isGlossaryTermSelected = (row: Locator) =>
  row
    .locator('[data-selected="true"]')
    .count()
    .then((n) => n > 0);

// The tree debounces and may skip the call, so the caller's row assertion is the wait.
export const searchGlossaryPicker = async (
  page: Page,
  term: string,
  trigger?: Locator
) => {
  const inPopover = popoverSearchBox(page);
  // The input variant's own trigger is the search box; prefer it over `:focus`.
  const box = (await inPopover.count())
    ? inPopover
    : trigger?.locator('input') ?? page.locator('input:focus');

  await box.fill(term);
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

// The trigger of a form picker, which renders its selection inline.
export const glossaryFieldTrigger = (scope: Page | Locator, testId: string) =>
  scope.getByTestId(testId);

// Chips live on the trigger; each carries an aria-label remove button.
export const removeGlossaryTermChip = async (
  trigger: Locator,
  label: string
) => {
  await trigger.getByRole('button', { name: `Remove ${label}` }).click();
};

// A form picker commits on click, so there is no Apply step to wait on.
export const pickGlossaryTermInField = async (
  page: Page,
  trigger: Locator,
  term: GlossaryTermRef
) => {
  await openGlossaryPicker(page, trigger);
  await toggleGlossaryTermInPicker(page, term);

  // Not Escape: these pickers sit in editors and drawers that close on it too.
  await clickOutside(page);
  await expect(page.locator(POPOVER)).not.toBeVisible();
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
