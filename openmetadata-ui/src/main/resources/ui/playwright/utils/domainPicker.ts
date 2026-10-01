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
 * The one helper that drives the domain picker.
 *
 * Every surface that assigns a domain renders the *same* control:
 * `DomainSelectableList` → `DomainSelect` → the ui-core `TreeSelect`. Only the
 * button that opens it differs. This used to be ten near-identical helpers,
 * each hardcoding its own trigger, so a change to the shared control had to be
 * chased through all ten and any surface whose trigger was not `add-domain`
 * could not reuse a single one of them.
 */

/** Search box inside the open picker. */
const SEARCH_TEST_ID = 'domain-selectable-tree-search';

/**
 * Popover body. `TreeSelect` renders this on a `display: contents` wrapper, so
 * it is usable for *scoping* but never for a visibility assertion — it has no
 * box of its own. Assert on the search field instead.
 */
const POPOVER_TEST_ID = 'domain-selectable-tree-popover';

/** Budget for one search attempt when `retryUntilIndexed` is on. */
const INDEXING_ATTEMPT_TIMEOUT = 5_000;
/** Total budget for the domain to become searchable. */
const INDEXING_TIMEOUT = 90_000;

export interface DomainPickerTarget {
  name: string;
  displayName?: string;
  fullyQualifiedName?: string;
}

/** What to assert once the picker has committed. */
export type DomainVerification =
  /** The domain's chip is on the entity. */
  | 'assigned'
  /** The entity shows its empty-domain placeholder. */
  | 'cleared'
  /** The domain's chip is gone, without claiming the entity has none. */
  | 'chip-gone'
  /** Nothing — the caller asserts. */
  | 'none';

export interface SetDomainOptions {
  /**
   * How to open the picker. A string is a testid to click; pass a function for
   * the surfaces that need to scroll, force-click, or open a grid cell first.
   */
  trigger?: string | (() => Promise<void>);

  /**
   * Await a PATCH after committing. Turn off for pickers that defer the save —
   * the bulk-edit grid stages the whole sheet and saves it later.
   */
  awaitPatch?: boolean;

  /**
   * Re-run the search until the node shows up. Domain search is
   * Elasticsearch-backed and lags creation, so a domain created moments
   * earlier can legitimately miss the first query — and the DB-backed tree
   * behind it is capped at `PAGE_SIZE_LARGE`, so it may not be on page 1
   * either. Opt in when the test created the domain itself.
   */
  retryUntilIndexed?: boolean;

  /** Defaults to `'assigned'`. */
  verify?: DomainVerification;

  /** For `verify: 'cleared'` — whether the placeholder is `--` or `No Domains`. */
  dashPlaceholder?: boolean;
}

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

const openPicker = async (
  page: Page,
  trigger: string | (() => Promise<void>)
): Promise<void> => {
  if (typeof trigger === 'function') {
    await trigger();
  } else {
    await page.getByTestId(trigger).click();
  }

  await waitForAllLoadersToDisappear(page);

  // Keyed on the search field rather than the picker root: `TreeSelect` puts
  // its `data-testid` on the trigger it builds itself, so a caller supplying
  // `renderTrigger` gets no id on the picker at all, and the `-popover`
  // wrapper is `display: contents` and so never "visible" to Playwright.
  await expect(getSearchBox(page)).toBeVisible();
};

const searchForDomain = async (
  page: Page,
  domain: DomainPickerTarget,
  retryUntilIndexed: boolean
): Promise<void> => {
  const searchBox = getSearchBox(page);
  const domainNode = getDomainNode(page, domain);

  if (retryUntilIndexed) {
    await expect(async () => {
      await searchBox.fill('');
      await searchBox.fill(domain.name);
      await expect(domainNode).toBeVisible({
        timeout: INDEXING_ATTEMPT_TIMEOUT,
      });
    }).toPass({ timeout: INDEXING_TIMEOUT });

    return;
  }

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  // Clearing first is unconditional: reopening a picker can leave the previous
  // term in the box, and an empty box is the same keystroke cost anyway.
  await searchBox.fill('');
  await searchBox.fill(domain.name);
  await searchResponse;
  await domainNode.waitFor({ state: 'visible' });
};

const verifyOutcome = async (
  page: Page,
  domain: DomainPickerTarget,
  verify: DomainVerification,
  dashPlaceholder: boolean
): Promise<void> => {
  const chip = page.getByTestId(`domain-tag-${domain.fullyQualifiedName}`);

  if (verify === 'assigned') {
    // Several domains collapse into one chip plus a "+ N More" toggle, so the
    // individual chip is only on screen while the entity has just the one.
    const collapsed = page.getByTestId('show-all-domains');
    if (await collapsed.isVisible()) {
      await expect(collapsed).toBeVisible();

      return;
    }

    await expect(chip).toBeVisible();

    if (domain.displayName) {
      await expect(chip).toContainText(domain.displayName);
    }

    return;
  }

  if (verify === 'cleared') {
    await expect(page.getByTestId('no-domain-text')).toContainText(
      dashPlaceholder ? '--' : 'No Domains'
    );

    return;
  }

  if (verify === 'chip-gone') {
    await expect(chip).not.toBeVisible();
  }
};

/**
 * Open the domain picker, search for `domain`, toggle it, and commit.
 *
 * Clicking an already-selected node deselects it, so this is both "assign" and
 * "remove" — `verify` says which outcome to expect.
 *
 * Staged vs immediate commit is **detected, not declared**: `DomainSelect`
 * renders the Apply footer only for multi-select (`commitMode: 'staged'`), so
 * the footer's presence is an exact proxy. That is why there is no
 * `multiSelect` flag — the control already knows, and a test that restated it
 * could disagree with the component and hang waiting for an Apply that is not
 * there (or a close that never comes).
 *
 * Returns the PATCH response when one was awaited, so a caller that wants to
 * assert its status can.
 */
export const setDomain = async (
  page: Page,
  domain: DomainPickerTarget,
  options: SetDomainOptions = {}
): Promise<Response | undefined> => {
  const {
    trigger = 'add-domain',
    awaitPatch = true,
    retryUntilIndexed = false,
    verify = 'assigned',
    dashPlaceholder = true,
  } = options;

  await openPicker(page, trigger);
  await searchForDomain(page, domain, retryUntilIndexed);

  // Scoped to the popover: `update-btn` is the generic confirm id, shared with
  // SelectableList, DataProductsSelectList and AsyncSelectList, so an unscoped
  // lookup can match another widget's button.
  const applyButton = page
    .getByTestId(POPOVER_TEST_ID)
    .getByTestId('update-btn');

  const patch = awaitPatch
    ? page.waitForResponse(
        (response) => response.request().method() === 'PATCH'
      )
    : undefined;

  await getDomainNode(page, domain).click();

  // Sampled after the click, matching the ordering the Explore page object
  // arrived at: racing the two outcomes instead was tried and reverted
  // upstream because the Apply branch could win against an already-committed
  // single-select and swallow the PATCH the caller is waiting on.
  const isStaged = await applyButton.isVisible();

  if (isStaged) {
    await applyButton.click();
  }

  const patchResponse = await patch;
  await waitForAllLoadersToDisappear(page);

  if (!isStaged) {
    // An immediate commit closes the picker. Wait for it to detach so a test
    // that reopens it straight away does not race the close animation.
    await getSearchBox(page).waitFor({ state: 'detached' });
  }

  await verifyOutcome(page, domain, verify, dashPlaceholder);

  return patchResponse;
};
