/*
 *  Copyright 2025 Collate.
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
import { waitForAllLoadersToDisappear } from './entity';

/**
 * The one place that knows how to drive the domain picker.
 *
 * Every surface that assigns a domain — the entity header, the summary panel,
 * the widget chrome, the bulk-edit grid, Collate's AI-mode header — renders the
 * *same* control: `DomainSelectableList` → `DomainSelect` → the ui-core
 * `TreeSelect`. Only the button that opens it differs. Before this module each
 * surface had its own copy of the search/select/apply sequence, so a change to
 * the shared control (e.g. the TreeSelect migration in #34008) had to be chased
 * through eight near-identical helpers, and any surface whose trigger was not
 * `add-domain` could not reuse a single one of them.
 *
 * Callers own the two ends that genuinely differ — opening the picker and
 * asserting the result. This module owns the middle.
 */

/** Search box inside the open picker. */
const SEARCH_TEST_ID = 'domain-selectable-tree-search';

/**
 * Popover body. `TreeSelect` renders this on a `display: contents` wrapper, so
 * it is usable for *scoping* but never for a visibility assertion — it has no
 * box of its own. Assert on the search field instead.
 */
const POPOVER_TEST_ID = 'domain-selectable-tree-popover';

export interface DomainPickerTarget {
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

export interface SelectDomainInPickerOptions {
  /**
   * Staged multi-select pickers hold the selection until the Apply footer
   * (`update-btn`) is pressed; single-select pickers commit on the node click
   * itself and close immediately. Defaults to the staged behaviour.
   */
  multiSelect?: boolean;

  /** Clear text already in the search box before typing. */
  clearSearch?: boolean;

  /**
   * Await a PATCH after committing. Turn off for pickers that defer the save
   * (the bulk-edit grid stages its edits and saves the whole sheet later).
   */
  awaitPatch?: boolean;

  /**
   * Wait for the picker to detach after committing.
   *
   * Only some single-select surfaces need this: the commit closes the picker,
   * and a test that immediately reopens it can otherwise race the close
   * animation. Off by default because the surfaces that never reopen would
   * just pay the wait — and one that does *not* close would hang on it.
   */
  waitForClose?: boolean;

  /**
   * Re-run the search until the node shows up. Domain search is
   * Elasticsearch-backed and lags creation, so a domain created moments
   * earlier can legitimately miss the first query — and the DB-backed tree
   * behind it is capped at `PAGE_SIZE_LARGE`, so it may not be on page 1
   * either. Opt in when the test created the domain itself.
   */
  retryUntilIndexed?: boolean;
}

/** Budget for one search attempt when `retryUntilIndexed` is on. */
const INDEXING_ATTEMPT_TIMEOUT = 5_000;
/** Total budget for the domain to become searchable. */
const INDEXING_TIMEOUT = 90_000;

const getSearchBox = (page: Page): Locator => page.getByTestId(SEARCH_TEST_ID);

/**
 * Locate a domain's row in the open picker.
 *
 * Prefers the stable `tree-node-<fqn>` id. Callers that only know a display
 * name (the summary panel renders no FQN) fall back to matching text inside
 * the popover, which is scoped enough to be unambiguous but will match a
 * substring — pass `fullyQualifiedName` whenever you have it.
 */
export const getDomainNode = (
  page: Page,
  domain: DomainPickerTarget
): Locator =>
  domain.fullyQualifiedName
    ? page.getByTestId(`tree-node-${domain.fullyQualifiedName}`)
    : page.getByTestId(POPOVER_TEST_ID).getByText(domain.name);

/**
 * Wait for the picker to be open and interactive.
 *
 * Deliberately keyed on the search field rather than the picker root:
 * `TreeSelect` puts its `data-testid` on the trigger it builds itself, so a
 * caller that supplies its own trigger (`renderTrigger`) gets no id on the
 * picker at all, and the `-popover` wrapper is `display: contents` and so
 * never "visible" to Playwright.
 */
export const waitForDomainPicker = async (page: Page): Promise<void> => {
  await expect(getSearchBox(page)).toBeVisible();
};

/**
 * Search for `domain` in the already-open picker, select it, and commit.
 *
 * Does **not** open the picker and does **not** assert the outcome — opening
 * differs per surface (testid, force-click, scroll, keypress) and the
 * assertion is the test's point. Callers do both.
 *
 * Returns the PATCH response when one was awaited, so a caller that wants to
 * assert its status can.
 */
export const selectDomainInPicker = async (
  page: Page,
  domain: DomainPickerTarget,
  options: SelectDomainInPickerOptions = {}
): Promise<Response | undefined> => {
  const {
    multiSelect = true,
    clearSearch = false,
    awaitPatch = true,
    waitForClose = false,
    retryUntilIndexed = false,
  } = options;

  const searchBox = getSearchBox(page);
  await expect(searchBox).toBeVisible();

  if (clearSearch) {
    await searchBox.clear();
  }

  const domainNode = getDomainNode(page, domain);

  if (retryUntilIndexed) {
    await expect(async () => {
      await searchBox.fill('');
      await searchBox.fill(domain.name);
      await expect(domainNode).toBeVisible({
        timeout: INDEXING_ATTEMPT_TIMEOUT,
      });
    }).toPass({ timeout: INDEXING_TIMEOUT });
  } else {
    const searchResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain.name))
    );
    await searchBox.fill(domain.name);
    await searchResponse;
    await domainNode.waitFor({ state: 'visible' });
  }

  const patch = awaitPatch
    ? page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      )
    : undefined;

  if (multiSelect) {
    // Staged: the node only stages the choice, the Apply footer commits it.
    await domainNode.click();
    await page.getByTestId('update-btn').click();
  } else {
    // Immediate: the node click is the commit, and it closes the picker.
    await domainNode.click();
  }

  const patchResponse = await patch;
  await waitForAllLoadersToDisappear(page);

  if (waitForClose) {
    await searchBox.waitFor({ state: 'detached' });
  }

  return patchResponse;
};
