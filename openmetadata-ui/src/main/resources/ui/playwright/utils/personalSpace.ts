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
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { openAiProfile } from './aiProfile';
import { clickIgnoringToasts, selectOptionWithRetry } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { AI_SHELL_TIMEOUT } from './inbox';
import { waitForResponseWithStatus } from './waitHelpers';

export const PERSONAL_SPACE_ROUTES = {
  HOME: '/',
  INBOX: '/inbox',
  MY_DATA: '/my-data',
};

// Navigate to an AI-app-mode route and wait until the AI shell has rendered.
export const gotoPersonalSpace = async (page: Page, path: string) => {
  await enableAiAppMode(page);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('ask-sidebar')).toBeVisible({
    timeout: AI_SHELL_TIMEOUT,
  });
};

/**
 * Open the Profile modal from the sidebar user menu (Profile is modal-only, not
 * a route). Does NOT assert the profile page rendered — the permission gate may
 * replace it with an error, so callers assert the expected outcome themselves.
 */
export const openProfileModal = async (page: Page) => {
  await gotoPersonalSpace(page, PERSONAL_SPACE_ROUTES.HOME);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
};

/**
 * Open the Profile modal and optionally select a left-rail nav item by its id
 * (`profile-nav-<nav>`; see profileNavConfig). A plain string so Collate can
 * reach the nav items it registers.
 */
export const visitProfile = (page: Page, nav?: string) =>
  openAiProfile(page, nav ? `profile-nav-${nav}` : undefined);

/**
 * Dismiss the Profile modal via its dialog Close button and assert it is gone.
 * Reopen with {@link visitProfile}, which re-navigates and re-fetches the user —
 * so a close→reopen round-trip proves a value was persisted server-side rather
 * than only living in the still-open editor's state.
 */
export const closeProfileModal = async (page: Page) => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('ai-profile-page')).toHaveCount(0);
  await expect(dialog).toHaveCount(0);
};

const USER_PATCH = (r: Response) =>
  r.url().includes('/api/v1/users/') && r.request().method() === 'PATCH';

// The chip helpers act on whoever is signed in and never see a user id, so this
// matches any user PATCH; aiProfile's waitForUserPatch is the id-scoped one.
const waitForSignedInUserPatch = (page: Page) =>
  waitForResponseWithStatus(page, USER_PATCH, 200, { timeout: 60_000 });

/**
 * Matches a GET to the roles search endpoint for the given query, so tests
 * can assert the Roles Autocomplete actually calls the server as the user
 * types instead of only filtering a locally cached page of options.
 */
export const rolesSearchResponse = (query: string) => (r: Response) =>
  r.request().method() === 'GET' &&
  r.url().includes('/api/v1/roles/search') &&
  new URL(r.url()).searchParams.get('q') === query;

/**
 * Matches a GET to the personas search endpoint for the given query, so tests
 * can assert the Persona Autocomplete actually calls the server as the user
 * types instead of only filtering a locally cached page of options.
 */
export const personasSearchResponse = (query: string) => (r: Response) =>
  r.request().method() === 'GET' &&
  r.url().includes('/api/v1/personas/search') &&
  new URL(r.url()).searchParams.get('q') === query;

/**
 * Matches the domain search the Domains Autocomplete fires as the user types.
 * `searchDomains` wraps the query in wildcards (`q=*<query>*`) and targets the
 * domain index, so match on both rather than on an exact `q`.
 */
export const domainsSearchResponse = (query: string) => (r: Response) => {
  if (
    r.request().method() !== 'GET' ||
    !r.url().includes('/api/v1/search/query')
  ) {
    return false;
  }
  const params = new URL(r.url()).searchParams;

  return params.get('index') === 'domain' && params.get('q') === `*${query}*`;
};

/**
 * The search each chip row fires as the user types, keyed by row test id. Teams
 * is absent on purpose: TeamsRow loads the whole hierarchy when the editor
 * opens and filters it client-side, so typing issues no request to wait on.
 */
const ROW_SEARCH_RESPONSE: Record<
  string,
  (query: string) => (r: Response) => boolean
> = {
  domains: domainsSearchResponse,
  persona: personasSearchResponse,
  roles: rolesSearchResponse,
};

/**
 * The chip for a selected value in a row's editor. Persona, Teams and Roles use
 * the core Autocomplete chips (`autocomplete-selected-item`); Domains uses the
 * shared DomainSelect picker, whose chips are `domain-tag-<fqn>` DomainTags.
 * Matched by label, since the test ids don't carry the value.
 */
export const getSelectedChip = (
  page: Page,
  rowTestId: string,
  optionTitle: string
) =>
  rowTestId === 'domains'
    ? page
        .getByTestId('domains-multiselect')
        .locator('[data-testid^="domain-tag-"]')
        .filter({ hasText: optionTitle })
    : page
        .getByTestId(`${rowTestId}-multiselect`)
        .getByTestId('autocomplete-selected-item')
        .filter({ hasText: optionTitle });

/** The remove (×) button on a selected value's chip. */
export const getChipRemoveButton = (
  page: Page,
  rowTestId: string,
  optionTitle: string
) => getSelectedChip(page, rowTestId, optionTitle).getByRole('button');

/**
 * Pick `optionTitle` in the Domains row's DomainSelect tree picker: type to
 * search, then toggle the matching tree node (a click toggles selection, so it
 * is only clicked while the chip is absent). Closes the picker afterwards.
 */
const pickDomainNode = async (page: Page, optionTitle: string) => {
  const input = page.getByTestId('domains-multiselect').getByRole('combobox');
  await input.click();
  await input.fill(optionTitle);
  const node = page
    .locator('[data-testid^="tree-node-"]')
    .filter({ hasText: optionTitle });
  const chip = getSelectedChip(page, 'domains', optionTitle);
  await expect(async () => {
    if ((await chip.count()) === 0) {
      await node.click({ timeout: 2_000 });
    }
    await expect(chip).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect(node).toBeHidden();
};

/**
 * Open a chip row's editor and remove the value matching `optionTitle`, then
 * save. The × on that value's chip clears only that one value.
 */
export const removeChip = async (
  page: Page,
  rowTestId: string,
  optionTitle: string
) => {
  await clickIgnoringToasts(page.getByTestId(`${rowTestId}-edit`));
  const removeButton = getChipRemoveButton(page, rowTestId, optionTitle);
  await expect(removeButton).toBeVisible();

  // The save PATCH is built from the editor's draft, so a click that did not
  // register leaves the draft untouched and saves a no-op that still answers
  // 200 — surfacing much later as "the value is still there after a reopen".
  //
  // A click can be lost legitimately: the editor's on-open search response
  // re-renders the chip list, so a click dispatched in that window lands on a
  // node React has already replaced. Retry until the chip is actually gone from
  // the draft, which is what a user would do, rather than trusting one click.
  await expect(async () => {
    if ((await removeButton.count()) > 0) {
      await removeButton.click();
    }
    await expect(removeButton).toHaveCount(0, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  const saveResponse = waitForSignedInUserPatch(page);
  await clickIgnoringToasts(page.getByTestId(`${rowTestId}-save`));
  await saveResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId(rowTestId).getByText(optionTitle)).toHaveCount(
    0
  );
};

/**
 * Wait for `optionTitle` in the Autocomplete's listbox, reopening the popup if
 * needed. The react-aria combobox opens its listbox on user input — if the row's
 * options fetch resolves AFTER the test's near-instant fill(), the popup stays
 * closed even once the items load, so the option would never become visible.
 * ArrowDown is the standard combobox key that (re)opens the listbox without
 * changing the typed filter.
 */
export const waitForListboxOption = async (
  page: Page,
  input: Locator,
  optionTitle: string
) => {
  const option = page.getByRole('option', { name: optionTitle, exact: true });
  await expect(async () => {
    if (!(await option.isVisible())) {
      await input.press('ArrowDown');
    }
    await expect(option).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  return option;
};

/**
 * Open a chip row's editor, pick `optionTitle` from the Autocomplete, then save.
 * The react-aria Autocomplete opens its listbox on input, so type to filter,
 * then click the matching option (rendered in a portalled listbox).
 *
 * `searchResponseMatcher`, when given, is awaited right after typing — this
 * asserts the row's search actually hits the server for the typed query
 * (rather than only filtering a locally cached page of options), so a
 * regression that drops the search API call fails loudly instead of passing
 * by coincidence when the option happens to already be cached locally.
 */
export const assignChip = async (
  page: Page,
  rowTestId: string,
  optionTitle: string,
  searchResponseMatcher?: (r: Response) => boolean
) => {
  await clickIgnoringToasts(page.getByTestId(`${rowTestId}-edit`));

  if (rowTestId === 'domains') {
    // The tree picker builds its own search query, so wait on the node itself
    // rather than on an exact search request.
    await pickDomainNode(page, optionTitle);
    await saveChipRow(page, rowTestId);

    return;
  }

  // Every row's editor fires one search when it opens and another for the typed
  // query, and each response replaces the Autocomplete's `items` — which
  // rebuilds its listbox. Waiting for the typed query's response first closes
  // that window. Callers may still pass their own matcher;
  // `ROW_SEARCH_RESPONSE` supplies the row's default otherwise.
  const matcher =
    searchResponseMatcher ?? ROW_SEARCH_RESPONSE[rowTestId]?.(optionTitle);
  const searchResponse = matcher
    ? waitForResponseWithStatus(page, matcher, 200)
    : undefined;
  const input = page.getByTestId(`${rowTestId}-multiselect`).locator('input');
  await input.fill(optionTitle);
  await searchResponse;

  // The listbox only opens on user input, so when the options land after the
  // fill it stays closed — waitForListboxOption reopens it (ArrowDown).
  const option = await waitForListboxOption(page, input, optionTitle);

  // Same reasoning as removeChip: the pick has to land in the draft, and the
  // click that puts it there can be lost to a concurrent re-render, so retry
  // until the chip appears instead of trusting one click and saving a no-op.
  // A scroll can also close the popover under the click, so reopen it and keep
  // the click short — an unbounded click on a detached option never returns.
  const chip = getSelectedChip(page, rowTestId, optionTitle);
  await expect(async () => {
    if ((await chip.count()) === 0) {
      if ((await input.getAttribute('aria-expanded')) !== 'true') {
        await input.press('ArrowDown');
      }
      await option.click({ timeout: 2_000 });
    }
    await expect(chip).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  await saveChipRow(page, rowTestId);
};

const saveChipRow = async (page: Page, rowTestId: string) => {
  const saveResponse = waitForSignedInUserPatch(page);
  await clickIgnoringToasts(page.getByTestId(`${rowTestId}-save`));
  await saveResponse;
  await waitForAllLoadersToDisappear(page);
};

/**
 * Pick an option in a ui-core (react-aria) Select by its visible label. The
 * trigger carries the given test id; options render in a listbox popover.
 */
export const selectUiCoreOption = async (
  page: Page,
  triggerTestId: string,
  optionLabel: string
) => {
  const select = page.getByTestId(triggerTestId);
  await selectOptionWithRetry(
    select.getByRole('button'),
    page.getByRole('option', { name: optionLabel, exact: true })
  );
  await expect(select).toContainText(optionLabel);
};

const TOKEN_API = '/users/security/token';

const isRevokePut = (r: Response) =>
  r.url().includes(`${TOKEN_API}/revoke`) && r.request().method() === 'PUT';

const isGeneratePut = (r: Response) =>
  r.url().includes(TOKEN_API) &&
  !r.url().includes('/revoke') &&
  r.request().method() === 'PUT';

/** Revoke sits behind a confirm popover; the PUT only fires once it's confirmed. */
const confirmRevoke = async (page: Page, revokeButton: Locator) => {
  await revokeButton.click();
  await expect(page.getByTestId('revoke-token-popover')).toBeVisible();
  await page.getByTestId('revoke-token-popover-confirm').click();
};

/**
 * Assert the Personal Access Token card is in its no-token state. Every caller
 * signs in as a freshly created user, so a leftover token is a real failure.
 */
export const expectNoAiToken = async (page: Page) => {
  await expect(page.getByTestId('access-token-row')).toBeVisible();
  await expect(page.getByTestId('generate-token')).toBeVisible();
  await expect(page.getByTestId('revoke-token')).toHaveCount(0);
};

export const generateAiToken = async (page: Page) => {
  const generateButton = page.getByTestId('generate-token');
  await expect(generateButton).toBeEnabled();
  const tokenResponse = waitForResponseWithStatus(page, isGeneratePut, 200);
  await generateButton.click();
  const response = await tokenResponse;
  await expect(page.getByTestId('token-value')).toBeVisible();

  return response;
};

/** Regenerate the token: waits on both the revoke + generate PUTs. */
export const regenerateAiToken = async (page: Page) => {
  const regenerateButton = page.getByTestId('regenerate-token');
  await expect(regenerateButton).toBeEnabled();
  const revokeResponse = waitForResponseWithStatus(page, isRevokePut, 200);
  const generateResponse = waitForResponseWithStatus(page, isGeneratePut, 200);
  await regenerateButton.click();
  await Promise.all([revokeResponse, generateResponse]);
};

/**
 * Reveal the generated token (it renders masked by default) and return its
 * value so a test can assert it is a real JWT rather than the mask.
 */
export const revealAiToken = async (page: Page) => {
  await page
    .getByTestId('access-token-row')
    .getByRole('button', { name: 'Show' })
    .click();

  return page.getByTestId('token-value');
};

export const revokeAiToken = async (page: Page) => {
  const revokeButton = page.getByTestId('revoke-token');
  await expect(revokeButton).toBeEnabled();
  const revokeResponse = waitForResponseWithStatus(page, isRevokePut, 200);
  await confirmRevoke(page, revokeButton);
  await revokeResponse;
  await expect(page.getByTestId('generate-token')).toBeVisible();
};

const CHANGE_PASSWORD_API = '/api/v1/users/changePassword';

/** Expand the SECURITY section's inline change-password form. */
export const openChangePasswordForm = async (page: Page) => {
  const section = page.getByTestId('profile-section-security');
  await expect(section).toBeVisible();
  const trigger = page.getByTestId('change-password-button');
  await expect(trigger).toBeEnabled();
  await trigger.click();
  await expect(page.getByTestId('current-password-input')).toBeVisible();
};

/**
 * Type into one of the change-password fields. `PasswordInput` renders the
 * `data-testid` on the field wrapper, so the input is addressed through it.
 */
export const fillPasswordField = async (
  page: Page,
  testId:
    | 'current-password-input'
    | 'new-password-input'
    | 'confirm-password-input',
  value: string
) => {
  await page.getByTestId(testId).locator('input').fill(value);
};

/** Fill all three fields of the change-password form. */
export const fillChangePasswordForm = async (
  page: Page,
  { current, next }: { current: string; next: string }
) => {
  await fillPasswordField(page, 'current-password-input', current);
  await fillPasswordField(page, 'new-password-input', next);
  await page.getByTestId('confirm-password-input').locator('input').fill(next);
};

/**
 * Submit the change-password form and wait on the PUT it triggers, returning
 * the response so the caller can assert success or failure.
 */
export const submitChangePassword = async (page: Page) => {
  const submit = page.getByTestId('update-password-button');
  await expect(submit).toBeEnabled();
  // Both outcomes are under test (200 success, 400 wrong current password);
  // anything else fails here instead of in the caller's status assertion.
  const changeResponse = waitForResponseWithStatus(
    page,
    (r) =>
      r.url().includes(CHANGE_PASSWORD_API) && r.request().method() === 'PUT',
    [200, 400]
  );
  await submit.click();

  return changeResponse;
};
