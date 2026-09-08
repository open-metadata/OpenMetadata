/*
 *  Copyright 2024 Collate.
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
import {
  APIRequestContext,
  Browser,
  expect,
  Locator,
  Page,
  request,
} from '@playwright/test';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { toLower } from 'lodash';
import { SidebarItem } from '../constant/sidebar';
import { adjectives, nouns } from '../constant/user';
import { Domain } from '../support/domain/Domain';
import { installServerLoadReducers } from '../support/fixtures/serverLoad';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';
import { getToken as getTokenFromStorage } from './tokenStorage';

export const uuid = () => randomUUID().split('-')[0];
export const fullUuid = () => randomUUID();

const adminStorageStateFile = 'playwright/.auth/admin.json';
const adminApiTokenFile = 'playwright/.auth/admin-api-token.json';
let workerAdminAPIContext: Promise<APIRequestContext> | undefined;

export const descriptionBox = '.om-block-editor[contenteditable="true"]';
export const descriptionBoxReadOnly =
  '.om-block-editor[contenteditable="false"]';

/**
 * Resolve the description editor that belongs to `scope`.
 *
 * `descriptionBox` is page-global, so it matches every editable block editor
 * currently mounted. Any page that has more than one at a time — an entity page
 * with a form drawer or description modal overlaid on it, or two drawers
 * overlapping while one plays its exit animation — turns an unscoped
 * `page.locator(descriptionBox)` into a strict mode violation. Pass the form,
 * drawer or modal the editor lives in instead.
 *
 * A `Page` is accepted too, for the callers that have no narrower container to
 * hand; {@link resolveDescriptionBox} is what makes that case safe.
 */
export const getDescriptionBox = (scope: Page | Locator): Locator =>
  scope.locator(descriptionBox);

/**
 * Resolve the description editor that an `edit-description` click just opened.
 *
 * Editing a description can mount the editor inline on the page or inside a
 * modal, and on an entity page both can be present at once. `.first()` picks
 * whichever comes first in the DOM — the inline editor *behind* the overlay. It
 * is visible, so `toBeVisible()` passes, and the click then fails on
 * "ant-modal-wrap ... intercepts pointer events" and retries until the test
 * times out; the trace shows a 45s click on an editor nothing could reach.
 *
 * Prefers the editor inside the dialog whenever the edit opened one. Retrying
 * covers the modal's enter animation, during which the dialog is not yet
 * attached.
 */
export const resolveDescriptionBox = async (page: Page): Promise<Locator> => {
  const descriptionDialog = page
    .locator('[role="dialog"]')
    .filter({ has: getDescriptionBox(page) });

  let editor = getDescriptionBox(page);

  await expect(async () => {
    if (await descriptionDialog.count()) {
      editor = getDescriptionBox(descriptionDialog);

      // The one place a single-editor invariant actually holds. Two editors in
      // one open dialog means the dialog selector matched something it should
      // not have, which is worth failing on.
      await expect(editor).toHaveCount(1);
    } else {
      // No dialog: a page legitimately hosts several editors at once — an entity
      // description alongside per-column ones — so there is nothing to assert
      // and nothing better to discriminate on. This is the long-standing
      // behaviour, and it was never the bug: the bug was taking the first match
      // *while a modal was open*, which the branch above now handles.
      // eslint-disable-next-line om-playwright/no-positional-locator -- a page may hold several description editors; with no dialog to scope to there is no better discriminator
      editor = getDescriptionBox(page).first();
    }

    await expect(editor).toBeVisible();
  }).toPass({ timeout: 15_000 });

  return editor;
};

/**
 * Fill the description editor for `scope`.
 *
 * An explicit `Locator` is a container the author chose — a form, a modal —
 * where exactly one editor is a real invariant, so the count assertion from
 * #32599 stands: failing here names the scope that needs narrowing rather than
 * typing into an arbitrary editor.
 *
 * A `Page` means no container was chosen, and a page may legitimately hold
 * several editors, so asserting there would fail on ordinary pages. Resolve
 * instead — the dialog's editor when the edit opened one, first match otherwise.
 */
export const fillDescriptionBox = async (
  scope: Page | Locator,
  value: string
) => {
  if ('goto' in scope) {
    await (await resolveDescriptionBox(scope)).fill(value);

    return;
  }

  const editor = getDescriptionBox(scope);

  await expect(editor).toHaveCount(1);
  await editor.fill(value);
};

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name can be a maximum of 128 characters';

export const getToken = async (page: Page) => {
  return await getTokenFromStorage(page);
};

export const getAuthContext = async (token: string) => {
  const isH2Mode = process.env.PW_PROTOCOL === 'h2';

  return await request.newContext({
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ??
      (isH2Mode ? 'https://localhost:8585' : 'http://localhost:8585'),
    // Default timeout is 30s making it to 1m for AUTs
    timeout: 90000,
    ignoreHTTPSErrors: isH2Mode,
    extraHTTPHeaders: {
      ...(isH2Mode ? {} : { Connection: 'keep-alive' }),
      Authorization: `Bearer ${token}`,
    },
  });
};

const DISABLE_ETAG_CONDITIONAL_READS_KEY = 'OM_DISABLE_ETAG_CONDITIONAL_READS';
const etagOptOutInstalled = new WeakSet<Page>();

/**
 * Disable client-side conditional reads without installing a Playwright route.
 *
 * The UI attaches an ETag conditional-GET interceptor; the server ETag only
 * covers version/updatedAt, so a refetch racing a relationship-only or child
 * mutation (followers, votes, customMetrics, testSuite) is answered 304 and the
 * UI renders a stale body. A Playwright route would disable Chromium's HTTP
 * cache for the page and can shadow suite-specific API mocks, so E2E sessions
 * use the application's localStorage opt-out instead.
 */
export const disableEtagConditionalReads = async (page: Page) => {
  if (etagOptOutInstalled.has(page)) {
    return;
  }
  etagOptOutInstalled.add(page);
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'true');
  }, DISABLE_ETAG_CONDITIONAL_READS_KEY);

  if (/^https?:/.test(page.url())) {
    await page.evaluate((key) => {
      localStorage.setItem(key, 'true');
    }, DISABLE_ETAG_CONDITIONAL_READS_KEY);
  }
};

const LOGGED_IN_USERS_KEY = 'loggedInUsers';

/**
 * Suppress the landing-page welcome banner at the source.
 *
 * MyDataPage renders the welcome banner only when the logged-in user's `name`
 * is absent from the `loggedInUsers` localStorage list (see
 * MyDataPage.component.tsx). Seeding that list with the user's name before the
 * first navigation means the banner never renders for the session, so no test
 * has to dismiss it. `userName` must equal the app's `currentUser.name` — for a
 * created UserClass that is `responseData.name`; the email local-part is the
 * server-assigned fallback for a pure login (e.g. admin).
 */
export const suppressWelcomeScreen = async (page: Page, userName: string) => {
  const name = userName.includes('@') ? userName.split('@')[0] : userName;
  const seed = ({ key, value }: { key: string; value: string }) => {
    const existing = (localStorage.getItem(key) ?? '')
      .split(',')
      .filter(Boolean);
    if (!existing.includes(value)) {
      localStorage.setItem(key, [...existing, value].join(','));
    }
  };
  const arg = { key: LOGGED_IN_USERS_KEY, value: name };

  await page.addInitScript(seed, arg);

  if (/^https?:/.test(page.url())) {
    await page.evaluate(seed, arg);
  }
};

export const redirectToHomePage = async (
  page: Page,
  _waitForLoaders = true
) => {
  // Every spec funnels through here, including the ones that build their own
  // page with browser.newPage() and so never touch the `context` fixture. This
  // is the only hook that reaches all of them; the call is idempotent.
  await installServerLoadReducers(page.context());
  await disableEtagConditionalReads(page);
  await page.goto('/my-data', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForURL('**/my-data', {
    waitUntil: 'domcontentloaded',
  });

  if (_waitForLoaders) {
    await waitForAllLoadersToDisappear(page);
  }
};

export const redirectToExplorePage = async (page: Page) => {
  await page.goto('/explore');
  await page.waitForURL('**/explore');
  await waitForAllLoadersToDisappear(page);
};

type CreateNewPageResult = {
  afterAction: () => Promise<void>;
  apiContext: APIRequestContext;
};

type NavigatedPageResult = CreateNewPageResult & { page: Page };
type APIOnlyPageResult = CreateNewPageResult & { page?: never };

export const getSavedAdminToken = async () => {
  const tokenFile = JSON.parse(await readFile(adminApiTokenFile, 'utf8')) as {
    token: string;
  };

  return tokenFile.token;
};

const createValidatedWorkerAdminAPIContext = async () => {
  const apiContext = await getAuthContext(await getSavedAdminToken());

  try {
    const response = await apiContext.get('/api/v1/users/loggedInUser');

    try {
      if (!response.ok()) {
        throw new Error(
          `Saved admin token validation failed (${response.status()})`
        );
      }
    } finally {
      await response.dispose();
    }

    return apiContext;
  } catch (error) {
    await apiContext.dispose();
    throw error;
  }
};

export const getWorkerAdminAPIContext = () => {
  workerAdminAPIContext ??= createValidatedWorkerAdminAPIContext().catch(
    (error) => {
      workerAdminAPIContext = undefined;
      throw error;
    }
  );

  return workerAdminAPIContext;
};

export const disposeWorkerAdminAPIContext = async () => {
  const apiContext = workerAdminAPIContext;
  workerAdminAPIContext = undefined;
  if (apiContext) {
    await (await apiContext).dispose();
  }
};

export function createNewPage(
  browser: Browser,
  options: { navigate: true }
): Promise<NavigatedPageResult>;
export function createNewPage(
  browser: Browser,
  options?: { navigate?: false }
): Promise<APIOnlyPageResult>;
export async function createNewPage(
  browser: Browser,
  { navigate = false }: { navigate?: boolean } = {}
): Promise<NavigatedPageResult | APIOnlyPageResult> {
  let page: Page | undefined;
  let ownsApiContext = false;
  if (navigate) {
    page = await browser.newPage({
      storageState: existsSync(adminStorageStateFile)
        ? adminStorageStateFile
        : undefined,
    });
    await installServerLoadReducers(page.context());
    await redirectToHomePage(page);
  }

  let apiContext: APIRequestContext;
  try {
    apiContext = await getWorkerAdminAPIContext();
  } catch {
    if (!page) {
      page = await browser.newPage({
        storageState: existsSync(adminStorageStateFile)
          ? adminStorageStateFile
          : undefined,
      });
      await redirectToHomePage(page);
    }
    apiContext = await getAuthContext(await getToken(page));
    ownsApiContext = true;
  }

  const afterAction = async () => {
    if (ownsApiContext) {
      await apiContext.dispose();
    }
    await page?.close();
  };

  if (navigate) {
    if (!page) {
      throw new Error('Expected a navigated page');
    }

    return { page, apiContext, afterAction };
  }

  return { apiContext, afterAction };
}

export const getDefaultAdminAPIContext = async (browser: Browser) => {
  if (existsSync(adminApiTokenFile)) {
    const apiContext = await getWorkerAdminAPIContext();
    const afterAction = async () => undefined;

    return { apiContext, afterAction };
  }

  const context = await browser.newContext({
    storageState: 'playwright/.auth/admin.json',
  });

  const page = await context.newPage();
  await redirectToHomePage(page);
  const { apiContext } = await getApiContext(page);

  const afterAction = async () => {
    await apiContext.dispose();
    await page.close();
    await context.close();
  };

  return { apiContext, afterAction };
};

/**
 * Retrieves the API context for the given page.
 * @param page The Playwright page object.
 * @returns An object containing the API context and a cleanup function.
 */
export const getApiContext = async (page: Page) => {
  const token = await getToken(page);
  const apiContext = await getAuthContext(token);
  const afterAction = async () => await apiContext.dispose();

  return { apiContext, afterAction };
};

const DASHBOARD_DATA_MODEL = 'DashboardDataModel';

export const getEntityTypeSearchIndexMapping = (entityType: string) => {
  const entityMapping = {
    Table: 'table',
    Topic: 'topic',
    Dashboard: 'dashboard',
    Pipeline: 'pipeline',
    MlModel: 'mlmodel',
    Container: 'container',
    SearchIndex: 'searchIndex',
    ApiEndpoint: 'apiEndpoint',
    Metric: 'metric',
    ['Store Procedure']: 'storedProcedure',
    Directory: 'directory',
    File: 'file',
    Spreadsheet: 'spreadsheet',
    Worksheet: 'worksheet',
    [DASHBOARD_DATA_MODEL]: 'dashboardDataModel',
  };

  return entityMapping[entityType as keyof typeof entityMapping];
};

export const toastNotification = async (
  page: Page,
  message: string | RegExp,
  timeout?: number
) => {
  const toast = page
    .getByTestId('alert-bar')
    .filter({ hasText: message })
    .first();

  await toast.waitFor({ state: 'visible', timeout });

  await expect(toast.getByTestId('alert-icon')).toBeVisible();
};

/**
 * Waits until the toast carrying `message` is gone.
 *
 * Always filter by message instead of waiting on a bare `alert-bar` locator: toasts
 * are a stacking queue, and the backend fans async-delete/job notifications out to
 * every socket of the logged-in user — so a parallel worker's cleanup can pop an
 * unrelated toast into this page and turn an unfiltered locator into a strict-mode
 * violation.
 */
export const waitForToastToDisappear = async (
  page: Page,
  message: string | RegExp,
  timeout?: number
) => {
  await page
    .getByTestId('alert-bar')
    .filter({ hasText: message })
    .first()
    .waitFor({ state: 'detached', timeout });
};

/**
 * Asserts that the page is showing no error toast, optionally narrowed to the
 * ones carrying `message`.
 *
 * Scoped to the error variant on purpose — a bare `alert-bar` assertion also
 * catches the background success notifications the backend fans out to every
 * socket of the logged-in user (async delete, export jobs), which a parallel
 * worker can trigger at any moment.
 */
export const expectNoErrorToast = async (
  page: Page,
  message?: string | RegExp
) => {
  const errorToast = page.locator(
    '[data-testid="alert-bar"][data-variant="error"]'
  );

  await expect(
    message ? errorToast.filter({ hasText: message }) : errorToast
  ).toHaveCount(0);
};

export const clickOutside = async (page: Page) => {
  await page.locator('body').click({
    position: {
      x: 0,
      y: 0,
    },
  });
};

/**
 * Blocks until every open Ant Design overlay has finished its enter animation.
 *
 * Ant Design animates a dropdown open with `transform: scaleY(0.8) -> scaleY(1)`
 * around `transform-origin: 0 0`, and rc-motion applies the start class one frame
 * before the `-active` class that begins the transition. Playwright's actionability
 * check ("bounding box unchanged across two consecutive animation frames") can be
 * satisfied on those pre-transition frames, so the click point gets computed against
 * the 0.8-scaled menu. Once the menu finishes growing, that point has slid onto the
 * item above the intended one — the click silently selects the wrong option.
 *
 * rc-motion strips the `-appear`/`-enter` classes on `animationend`, so their absence
 * is the signal that the popup geometry is final.
 */
export const waitForAntdPopupToSettle = async (page: Page) => {
  await expect(
    page.locator(
      '.ant-dropdown:not(.ant-dropdown-hidden)[class*="-appear"], ' +
        '.ant-dropdown:not(.ant-dropdown-hidden)[class*="-enter"]'
    )
  ).toHaveCount(0);
};

export const searchFromSearchInput = async (
  page: Page,
  searchInput: Locator,
  searchTerm: string
) => {
  const searchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.request().method() === 'GET'
  );

  await searchInput.clear();
  await searchInput.fill(searchTerm);
  await expect(searchInput).toHaveValue(searchTerm);

  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);
};

export const visitOwnProfilePage = async (page: Page) => {
  await page.locator('[data-testid="dropdown-profile"] svg').click();
  await page.locator('[role="menu"].profile-dropdown').waitFor({
    state: 'visible',
  });
  const userResponse = page.waitForResponse(
    '/api/v1/users/name/*?fields=*&include=all'
  );
  await page.getByRole('link', { name: 'View Profile' }).click();
  await userResponse;
  await clickOutside(page);
};

export const assignDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  checkSelectedDomain = true
) => {
  await page.getByTestId('add-domain').click();
  await waitForAllLoadersToDisappear(page);

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);

  await searchDomain;

  // Wait for the tag element to be visible and ensure page is still valid
  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await waitForAllLoadersToDisappear(page);

  if (checkSelectedDomain) {
    const hasMultipleDomains = await page
      .getByTestId('domain-count-button')
      .isVisible();
    if (hasMultipleDomains) {
      await expect(page.getByTestId('domain-count-button')).toBeVisible();
    } else {
      await expect(page.getByTestId('domain-link')).toContainText(
        domain.displayName
      );
    }
  }
};

export const assignSingleSelectDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await waitForAllLoadersToDisappear(page);

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);

  await searchDomain;

  // Wait for the tag element to be visible and ensure page is still valid
  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await tagSelector.click();

  await patchReq;
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('domain-link')).toContainText(
    domain.displayName
  );
};

export const updateDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string }
) => {
  await page.getByTestId('add-domain').click();
  await waitForAllLoadersToDisappear(page);

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .clear();

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  await page.getByTestId(`tag-${domain.fullyQualifiedName}`).click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('header-domain-container')).toContainText('+1');

  await page.getByTestId('header-domain-container').getByText('+1').hover();

  await expect(
    page.getByRole('menuitem', { name: domain.displayName })
  ).toBeVisible();
};

export const removeDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  showDashPlaceholder = true
) => {
  await page.getByTestId('add-domain').click();
  await waitForAllLoadersToDisappear(page);

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  const tagSelector = page.getByTestId(`tag-${domain.fullyQualifiedName}`);
  await tagSelector.waitFor({ state: 'visible' });
  await tagSelector.click();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('no-domain-text')).toContainText(
    showDashPlaceholder ? '--' : 'No Domains'
  );
};

export const removeSingleSelectDomain = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  showDashPlaceholder = true
) => {
  await page.getByTestId('add-domain').click();
  await waitForAllLoadersToDisappear(page);

  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .clear();

  const searchDomain = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes(encodeURIComponent(domain.name))
  );
  await page
    .getByTestId('domain-selectable-tree')
    .getByTestId('searchbar')
    .fill(domain.name);
  await searchDomain;

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page.getByTestId(`tag-${domain.fullyQualifiedName}`).click();

  await patchReq;
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('no-domain-text')).toContainText(
    showDashPlaceholder ? '--' : 'No Domains'
  );
};

export const assignDataProduct = async (
  page: Page,
  domain: { name: string; displayName: string; fullyQualifiedName?: string },
  dataProducts: {
    name: string;
    displayName: string;
    fullyQualifiedName?: string;
  }[],
  action: 'Add' | 'Edit' = 'Add',
  parentId = 'KnowledgePanel.DataProducts',
  // Set true when the domain is inherited from a parent entity. The search
  // index is updated asynchronously, so a page reload is needed on each poll
  // to fetch the current state directly from the entity API.
  pollForInheritance = false
) => {
  if (pollForInheritance) {
    await expect
      .poll(
        async () => {
          await page.reload();
          await waitForAllLoadersToDisappear(page);

          return page
            .getByTestId('domain-link')
            .textContent()
            .catch(() => null);
        },
        {
          message: `Waiting for inherited domain "${domain.displayName}" to appear on the entity page`,
          timeout: 60_000,
          intervals: [2_000, 3_000, 5_000],
        }
      )
      .toContain(domain.displayName);
  } else {
    const hasMultipleDomains = await page
      .getByTestId('domain-count-button')
      .isVisible();
    if (hasMultipleDomains) {
      await expect(page.getByTestId('domain-count-button')).toBeVisible();
    } else {
      await expect(page.getByTestId('domain-link')).toContainText(
        domain.displayName
      );
    }
  }

  await page
    .getByTestId(parentId)
    .getByTestId('data-products-container')
    .getByTestId(action === 'Add' ? 'add-data-product' : 'edit-button')
    .click();

  for (const dataProduct of dataProducts) {
    const tagLocator = page.getByTestId(
      `tag-${dataProduct.fullyQualifiedName}`
    );

    await expect(async () => {
      // Match any Data Product search response. The dropdown filters by the
      // asset's domain only when the "Data Product Domain Validation" rule is
      // enabled; when it is disabled the query carries no domain, so we cannot
      // key the wait on the domain name. The tag visibility check below is the
      // real synchronization guard.
      const searchDataProduct = page.waitForResponse((response) =>
        response.url().includes('/api/v1/search/query')
      );
      await page.locator('[data-testid="data-product-selector"] input').clear();
      await page
        .locator('[data-testid="data-product-selector"] input')
        .fill(dataProduct.displayName);
      await searchDataProduct;
      await expect(tagLocator).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 5_000] });

    await tagLocator.click();
  }

  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;

  if (pollForInheritance) {
    for (const dataProduct of dataProducts) {
      await expect
        .poll(
          async () => {
            await page.reload();
            await waitForAllLoadersToDisappear(page);

            return page
              .getByTestId(parentId)
              .getByTestId('data-products-list')
              .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
              .isVisible()
              .catch(() => false);
          },
          {
            message: `Waiting for data product "${dataProduct.displayName}" to appear after save`,
            timeout: 60_000,
            intervals: [2_000, 3_000, 5_000],
          }
        )
        .toBe(true);
    }
  } else {
    for (const dataProduct of dataProducts) {
      await expect(
        page
          .getByTestId(parentId)
          .getByTestId('data-products-list')
          .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
      ).toBeVisible();
    }
  }
};

export const removeDataProduct = async (
  page: Page,
  dataProduct: {
    name: string;
    displayName: string;
    fullyQualifiedName?: string;
  }
) => {
  await page
    .getByTestId('KnowledgePanel.DataProducts')
    .getByTestId('data-products-container')
    .getByTestId('edit-button')
    .click();

  await waitForAllLoadersToDisappear(page);

  await page
    .getByTestId(`selected-tag-${dataProduct.fullyQualifiedName}`)
    .getByTestId('remove-tags')
    .locator('svg')
    .click();

  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).toBeEnabled();

  const patchReq = page.waitForResponse(
    (req) => req.request().method() === 'PATCH'
  );

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .click();
  await patchReq;

  await page
    .getByTestId('data-product-dropdown-actions')
    .getByTestId('saveAssociatedTag')
    .locator('[data-icon="loading"]')
    .waitFor({ state: 'detached' });
  await expect(
    page
      .getByTestId('data-product-dropdown-actions')
      .getByTestId('saveAssociatedTag')
  ).not.toBeVisible();

  await expect(
    page
      .getByTestId('KnowledgePanel.DataProducts')
      .getByTestId('data-products-list')
      .getByTestId(`data-product-${dataProduct.fullyQualifiedName}`)
  ).not.toBeVisible();
};

export const visitGlossaryPage = async (page: Page, glossaryName: string) => {
  await redirectToHomePage(page);
  const glossaryResponse = page.waitForResponse('/api/v1/glossaries?fields=*');
  await sidebarClick(page, SidebarItem.GLOSSARY);
  await glossaryResponse;
  await waitForAllLoadersToDisappear(page);
  await page
    .getByTestId('glossary-left-panel')
    .getByRole('menuitem', { name: glossaryName, exact: true })
    .click({ timeout: 30000 });
  await waitForAllLoadersToDisappear(page);
};

export const getRandomFirstName = () => {
  const index =
    parseInt(crypto.randomUUID().slice(0, 8), 16) % adjectives.length;
  return `${adjectives[index]}${uuid()}`;
};
export const getRandomLastName = () => {
  const index = parseInt(crypto.randomUUID().slice(0, 8), 16) % nouns.length;
  return `${nouns[index]}${uuid()}`;
};

export const generateRandomUsername = (prefix = '') => {
  const timestamp = Date.now();
  const firstName = `${prefix}${getRandomFirstName()}`;
  const lastName = `${prefix}${getRandomLastName()}`;

  return {
    firstName,
    lastName,
    email: `${firstName}.${lastName}.${timestamp}@example.com`,
    password: 'User@OMD123',
  };
};

export const generateRandomAdminUsername = (prefix = '') => {
  const timestamp = Date.now();
  const firstName = `${prefix}${getRandomFirstName()}`;
  const lastName = `${prefix}${getRandomLastName()}`;
  const name = toLower(`${firstName}.${lastName}.${timestamp}`);
  const password = 'Admin@OMD123';

  return {
    name,
    displayName: `${firstName}${lastName}`,
    email: `${name}@example.com`,
    password,
    confirmPassword: password,
    isAdmin: true,
  };
};

export const verifyDomainLinkInCard = async (
  entityCard: Locator,
  domain: Domain['responseData']
) => {
  const domainLink = entityCard.getByTestId('domain-link').filter({
    hasText: domain.displayName,
  });

  await expect(domainLink).toBeVisible();
  await expect(domainLink).toContainText(domain.displayName);

  const href = await domainLink.getAttribute('href');

  expect(href).toContain('/domain/');
  await expect(domainLink).toBeEnabled();
};

export const waitForSearchResult = async (
  page: Page,
  searchTerm: string,
  result: Locator,
  tabSelector?: Locator
) => {
  let hasSubmittedSearch = false;

  await expect
    .poll(
      async () => {
        // Swallow the timeout: this wait only exists to let the search settle
        // before checking the result, and the enclosing poll is what decides
        // success. Left unhandled, a single slow search rejects and the
        // exception aborts the whole poll instead of counting as "not yet" —
        // so a 45s budget could fail after one 15s iteration.
        const searchResponse = page
          .waitForResponse(
            (response) =>
              response.url().includes('/api/v1/search/query') &&
              response.request().method() === 'GET',
            { timeout: 15_000 }
          )
          .catch(() => null);

        if (hasSubmittedSearch) {
          await Promise.all([searchResponse, page.reload()]);
        } else {
          await page.getByTestId('searchBox').fill(searchTerm);
          await Promise.all([
            searchResponse,
            page.getByTestId('searchBox').press('Enter'),
          ]);
          hasSubmittedSearch = true;
        }
        await waitForAllLoadersToDisappear(page);
        await tabSelector?.click();
        await waitForAllLoadersToDisappear(page);

        return result.isVisible();
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toBe(true);
};

export const verifyDomainPropagation = async (
  page: Page,
  domain: Domain['responseData'],
  childFqnSearchTerm: string,
  exploreTabName?: string
) => {
  // Domain propagation from the parent service to its children — and the
  // subsequent search reindex — is eventually consistent. Gate on the search
  // API actually reflecting the propagated domain before touching the UI, so
  // the test converges on real backend state instead of racing a fixed UI-poll
  // window under CI load.
  const { apiContext, afterAction } = await getApiContext(page);
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=${encodeURIComponent(
            childFqnSearchTerm
          )}&index=all&from=0&size=10`
        );

        const hits: {
          _source?: {
            name?: string;
            fullyQualifiedName?: string;
            domains?: { name?: string; fullyQualifiedName?: string }[];
          };
        }[] = response.ok() ? (await response.json())?.hits?.hits ?? [] : [];
        const source = hits.find(
          (hit) =>
            hit._source?.fullyQualifiedName === childFqnSearchTerm ||
            hit._source?.name === childFqnSearchTerm
        )?._source;

        return Boolean(
          source?.domains?.some(
            (entityDomain) =>
              entityDomain.fullyQualifiedName === domain.fullyQualifiedName ||
              entityDomain.name === domain.name
          )
        );
      },
      { timeout: 90_000, intervals: [2_000, 5_000, 10_000] }
    )
    .toBe(true);
  await afterAction();

  // The propagated domain is now indexed. Run a single explore search and
  // web-first wait for the entity card, then assert it carries the domain by
  // display name. (The old poll reloaded the page between attempts, dropping
  // the search term so it could never re-find the card; and the explore card
  // renders domains via DomainLabel, which exposes no `domain-link` testid.)
  const searchBox = page.getByTestId('searchBox');
  await searchBox.fill(childFqnSearchTerm);
  await searchBox.press('Enter');
  await waitForAllLoadersToDisappear(page);

  if (exploreTabName) {
    await page.getByRole('menuitem', { name: exploreTabName }).click();
    await waitForAllLoadersToDisappear(page);
  }

  const entityCard = page.getByTestId(`table-data-card_${childFqnSearchTerm}`);
  await expect(entityCard).toBeVisible({ timeout: 30_000 });
  await expect(entityCard).toContainText(domain.displayName);
};

/**
 * Wait for a hard-deleted entity to disappear from the search index.
 *
 * Search-index deletion is eventually consistent: a selection dropdown
 * queried immediately after `DELETE /api/v1/...?hardDelete=true` can still
 * return the deleted entity and fail a `not.toBeVisible()` assertion (the
 * ExplorePageRightPanel deleted-entity flake family — run 32500973433).
 * Gate on the search API no longer returning the entity before asserting
 * its absence in the UI, mirroring how verifyDomainPropagation gates on
 * presence.
 */
export const waitForDeletionFromSearchIndex = async (
  apiContext: APIRequestContext,
  searchTerm: string,
  searchIndex: string,
  matchNames: string[]
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=${encodeURIComponent(
            searchTerm
          )}&index=${searchIndex}&from=0&size=10`
        );

        // This poll resolves on `false` ("entity gone"), the OPPOSITE
        // polarity of verifyDomainPropagation — so a transient search error
        // must read as "still present" (keep polling), never as an empty
        // result set, or a single flaky 5xx would pass the gate against a
        // stale index.
        if (!response.ok()) {
          return true;
        }

        const hits: {
          _source?: {
            name?: string;
            displayName?: string;
            fullyQualifiedName?: string;
          };
        }[] = (await response.json())?.hits?.hits ?? [];

        return hits.some((hit) =>
          matchNames.some(
            (name) =>
              hit._source?.name === name ||
              hit._source?.displayName === name ||
              hit._source?.fullyQualifiedName === name
          )
        );
      },
      { timeout: 30_000, intervals: [1_000, 2_000, 3_000, 5_000] }
    )
    .toBe(false);
};

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

// Since the tests run in parallel sometimes the error toast alert pops up
// Stating the domain or glossary does not exist since it's deleted in other test
// This error toast blocks the buttons at the top
// Below logic closes the alert if it's present to avoid flakiness in tests
export const closeFirstPopupAlert = async (page: Page) => {
  const closeIcon = page.getByTestId('alert-icon-close').first();

  if (await closeIcon.isVisible()) {
    await closeIcon.click();
  }
};

export const reloadAndWaitForNetworkIdle = async (page: Page) => {
  await page.reload();

  await waitForAllLoadersToDisappear(page);
};

/**
 * Utility function to handle API calls with retry logic for connection-related errors.
 * This is particularly useful for cleanup operations that might fail due to network issues.
 *
 * @param apiCall - The API call function to execute
 * @param operationName - Name of the operation for logging purposes
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds for exponential backoff (default: 1000)
 * @returns The result of the API call if successful
 */
export const executeWithRetry = async <T>(
  apiCall: () => Promise<T>,
  operationName: string,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T | void> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if it's a retriable error (connection-related issues)
      const isRetriableError =
        errorMessage.includes('socket hang up') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('ECONNREFUSED');

      if (isRetriableError && attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(
          `${operationName} attempt ${
            attempt + 1
          } failed with retriable error: ${errorMessage}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      } else {
        console.error(
          `Failed to ${operationName} after ${attempt + 1} attempts:`,
          errorMessage
        );

        // Don't throw the error to prevent test failures - just log it
        break;
      }
    }
  }
};

export const readElementInListWithScroll = async (
  page: Page,
  locator: Locator,
  hierarchyElementLocator: Locator
) => {
  const element = locator;

  // Reset scroll position to top before starting pagination
  await hierarchyElementLocator.hover();
  await page.mouse.wheel(0, -99999);

  // eslint-disable-next-line playwright/no-wait-for-timeout -- virtualized list rendering delay
  await page.waitForTimeout(1000);

  // Retry mechanism for pagination
  let elementCount = await element.count();
  let retryCount = 0;
  const maxRetries = 10;

  while (elementCount === 0 && retryCount < maxRetries) {
    await hierarchyElementLocator.hover();
    await page.mouse.wheel(0, 1000);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- virtualized list scroll rendering delay
    await page.waitForTimeout(500);

    // Create fresh locator and check if the article is now visible after this retry
    const freshArticle = locator;
    const count = await freshArticle.count();

    // Check if the article is now visible after this retry
    elementCount = count;

    // If we found the element, validate it and break out of the loop
    if (count > 0) {
      await expect(freshArticle).toBeVisible();

      return; // Exit the function early since we found and validated the article
    }

    retryCount++;
  }
};

export const testPaginationNavigation = async (
  page: Page,
  apiEndpointPattern: string,
  waitForLoadSelector?: string,
  validateUrl = true,
  validateRowCount = true
) => {
  const responseMatcher = (response: { url: () => string }) => {
    const url = response.url();
    return (
      url.includes(apiEndpointPattern) &&
      !url.includes('limit=0') &&
      (url.includes('limit=') ||
        url.includes('after=') ||
        url.includes('before='))
    );
  };

  const page1ResponsePromise = page.waitForResponse(responseMatcher);

  const page1Response = await page1ResponsePromise;
  expect(page1Response.status()).toBe(200);

  if (waitForLoadSelector) {
    await page.locator(waitForLoadSelector).waitFor({ state: 'visible' });
  }
  await waitForAllLoadersToDisappear(page);

  const page1Data = await page1Response.json();
  const page1FirstItem = page1Data.data?.[0];
  const page1FirstItemName =
    page1FirstItem?.displayName || page1FirstItem?.name;

  await expect(page.getByTestId('previous')).toBeDisabled();
  const nextButton = page.getByTestId('next');
  await expect(nextButton).toBeEnabled();
  await nextButton.scrollIntoViewIfNeeded();

  const [page2Response] = await Promise.all([
    page.waitForResponse(responseMatcher),
    nextButton.click(),
  ]);
  expect(page2Response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeEnabled();
  let afterValue: string | null = '';
  if (validateUrl) {
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const searchParams = urlObj.searchParams;

    expect(searchParams.get('currentPage')).toBe('2');
    expect(searchParams.get('cursorType')).toBe('after');

    afterValue = searchParams.get('cursorValue');

    expect(afterValue).toBeTruthy();
  }

  if (page1FirstItemName) {
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).not.toHaveText(
      page1FirstItemName
    );
    await expect(firstRow.locator('td').nth(1)).not.toHaveText(
      page1FirstItemName
    );
  }

  const reloadResponsePromise = page.waitForResponse(responseMatcher);

  await page.reload();

  const reloadResponse = await reloadResponsePromise;
  expect(reloadResponse.status()).toBe(200);
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationText = page.locator('[data-testid="page-indicator"]');
  await expect(paginationText).toBeVisible();
  const paginationTextContent = await paginationText.textContent();

  expect(paginationTextContent).toMatch(/2\s*of\s*\d+/);

  if (validateUrl) {
    const reloadedUrl = page.url();
    const reloadedUrlObj = new URL(reloadedUrl);
    const reloadedSearchParams = reloadedUrlObj.searchParams;

    expect(reloadedSearchParams.get('currentPage')).toBe('2');
    expect(reloadedSearchParams.get('cursorType')).toBe('after');
    expect(reloadedSearchParams.get('cursorValue')).toBe(afterValue);
  }
  await page.waitForLoadState('domcontentloaded');
  const pageSizeDropdown = page.getByTestId('page-size-selection-dropdown');
  if (await pageSizeDropdown.isVisible()) {
    await expect(pageSizeDropdown).toHaveText('15 / Page');

    // Explicitly using selector, as in some cases table cell contains markdown
    // and markdown can further have tables
    const initialRowCount = await page
      .locator('tbody > tr[data-row-key]:visible')
      .count();
    if (validateRowCount) {
      expect(initialRowCount).toBeLessThanOrEqual(15);
    }
    await page.waitForLoadState('domcontentloaded');
    const menuItem = page.getByRole('menuitem', { name: '25 / Page' });
    await expect(async () => {
      await pageSizeDropdown.hover();
      if (!(await menuItem.isVisible())) {
        await pageSizeDropdown.click();
      }
      await expect(menuItem).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000, intervals: [500, 1_000, 2_000] });

    const pageSizeChangePromise = page.waitForResponse((response) =>
      response.url().includes(apiEndpointPattern)
    );
    await menuItem.click();
    await pageSizeChangePromise;
    await waitForAllLoadersToDisappear(page);

    await expect(pageSizeDropdown).toHaveText('25 / Page');

    const newRowCount = await page
      .locator('tbody > tr[data-row-key]:visible')
      .count();
    if (validateRowCount) {
      expect(newRowCount).toBeLessThanOrEqual(25);
      expect(newRowCount).not.toBe(initialRowCount);
    }
  }
};

type ResponseWithRequest = {
  request: () => { method: () => string };
  url: () => string;
};

type MetricSearchHit = {
  _source?: {
    displayName?: string;
    name?: string;
  };
};

type MetricSearchResponse = {
  hits?: {
    hits?: MetricSearchHit[];
  };
};

type CsvAsyncJob = {
  jobId: string;
  status: string;
};

export const fetchCompletedCsvAsyncJobResult = async (
  apiContext: APIRequestContext,
  jobId: string
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/csvAsyncJobs?limit=50');

        if (!response.ok()) {
          return undefined;
        }

        const jobs = (await response.json()) as CsvAsyncJob[];

        return jobs.find((job) => job.jobId === jobId)?.status;
      },
      { timeout: 90_000 }
    )
    .toBe('COMPLETED');

  const resultResponse = await apiContext.get(
    `/api/v1/csvAsyncJobs/${jobId}/result`,
    {
      headers: { Accept: 'text/csv' },
    }
  );

  expect(resultResponse.ok()).toBeTruthy();

  return resultResponse.text();
};

export const isMetricsSearchResponse = (response: ResponseWithRequest) => {
  const url = new URL(response.url());

  return (
    response.request().method() === 'GET' &&
    url.pathname.endsWith('/api/v1/search/query') &&
    url.searchParams.get('index') === 'metric'
  );
};

export const waitForMetricsSearchResponse = (page: Page) =>
  page.waitForResponse(isMetricsSearchResponse);

export const testMetricsPaginationNavigation = async (page: Page) => {
  const page1ResponsePromise = waitForMetricsSearchResponse(page);

  await page.goto('/metrics?pageSize=15', { waitUntil: 'domcontentloaded' });

  const page1Response = await page1ResponsePromise;
  expect(page1Response.status()).toBe(200);

  await page.locator('table').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);

  const page1Data: MetricSearchResponse = await page1Response.json();
  const page1FirstItem = page1Data.hits?.hits?.[0]?._source;
  const page1FirstItemName =
    page1FirstItem?.displayName ?? page1FirstItem?.name;

  await expect(page.getByTestId('previous')).toBeDisabled();
  const nextButton = page.getByTestId('next');
  await expect(nextButton).toBeEnabled();

  const [page2Response] = await Promise.all([
    waitForMetricsSearchResponse(page),
    nextButton.click(),
  ]);
  expect(page2Response.status()).toBe(200);

  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('previous')).toBeEnabled();
  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');

  const paginationText = page.locator('[data-testid="page-indicator"]');
  await expect(paginationText).toBeVisible();
  expect(await paginationText.textContent()).toMatch(/2\s*of\s*\d+/);

  if (page1FirstItemName) {
    await expect(page.locator('tbody tr').first()).not.toContainText(
      page1FirstItemName
    );
  }

  const reloadResponsePromise = waitForMetricsSearchResponse(page);

  await page.reload();

  const reloadResponse = await reloadResponsePromise;
  expect(reloadResponse.status()).toBe(200);

  await page.locator('table').waitFor({ state: 'visible' });
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('previous')).toBeEnabled();
  expect(new URL(page.url()).searchParams.get('currentPage')).toBe('2');
  expect(await paginationText.textContent()).toMatch(/2\s*of\s*\d+/);

  const pageSizeDropdown = page.getByTestId('page-size-selection-dropdown');
  await expect(pageSizeDropdown).toHaveText('15 / Page');

  const menuItem = page.getByRole('menuitem', { name: '25 / Page' });
  await pageSizeDropdown.hover();
  const isMenuVisibleAfterHover = await menuItem.isVisible();
  if (!isMenuVisibleAfterHover) {
    await pageSizeDropdown.click();
  }
  await menuItem.waitFor({ state: 'visible' });

  const pageSizeChangeResponsePromise = waitForMetricsSearchResponse(page);
  await menuItem.click();

  const pageSizeChangeResponse = await pageSizeChangeResponsePromise;
  expect(pageSizeChangeResponse.status()).toBe(200);
  expect(new URL(pageSizeChangeResponse.url()).searchParams.get('size')).toBe(
    '25'
  );

  await waitForAllLoadersToDisappear(page);
  await expect(pageSizeDropdown).toHaveText('25 / Page');

  const newRowCount = await page
    .locator('tbody > tr[data-row-key]:visible')
    .count();
  expect(newRowCount).toBeLessThanOrEqual(25);
};

export const testClientSidePaginationNavigation = async (
  page: Page,
  waitForLoadSelector: string,
  validateRowCount = true
) => {
  if (waitForLoadSelector) {
    await page.locator(waitForLoadSelector).waitFor({ state: 'visible' });
  }
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeDisabled();
  const nextButton = page.locator('[data-testid="next"]');

  await nextButton.click();
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeEnabled();

  const currentUrl = page.url();
  expect(new URL(currentUrl).searchParams.get('currentPage')).toBe('2');

  await page.reload();

  if (waitForLoadSelector) {
    await page.locator(waitForLoadSelector).waitFor({ state: 'visible' });
  }
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationText = page.locator('[data-testid="page-indicator"]');
  await expect(paginationText).toBeVisible();
  expect(await paginationText.textContent()).toMatch(/2\s*of\s*\d+/);

  const reloadedSearchParams = new URL(page.url()).searchParams;
  expect(reloadedSearchParams.get('currentPage')).toBe('2');

  await page.waitForLoadState('domcontentloaded');
  const pageSizeDropdown = page.getByTestId('page-size-selection-dropdown');

  await expect(pageSizeDropdown).toHaveText('15 / Page');

  const initialRowCount = await page
    .locator('tbody > tr[data-row-key]:visible')
    .count();
  if (validateRowCount) {
    expect(initialRowCount).toBeLessThanOrEqual(15);
  }

  const menuItem = page.getByRole('menuitem', { name: '25 / Page' });
  await expect(async () => {
    await pageSizeDropdown.hover();
    if (!(await menuItem.isVisible())) {
      await pageSizeDropdown.click();
    }
    await expect(menuItem).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000, intervals: [500, 1_000, 2_000] });
  await menuItem.click();
  await waitForAllLoadersToDisappear(page);

  await expect(pageSizeDropdown).toHaveText('25 / Page');

  const newRowCount = await page
    .locator('tbody > tr[data-row-key]:visible')
    .count();
  if (validateRowCount) {
    expect(newRowCount).toBeLessThanOrEqual(25);
    expect(newRowCount).not.toBe(initialRowCount);
  }
};

export interface PaginationTestConfig {
  page: Page;
  baseUrl: string;
  normalApiPattern: string;
  searchApiPattern?: string;
  searchTestTerm?: string;
  searchParamName?: string;
  waitForLoadSelector?: string;
  deleteBtnTestId?: string;
}

export const testCompletePaginationWithSearch = async (
  config: PaginationTestConfig
) => {
  const {
    page,
    baseUrl,
    normalApiPattern,
    searchApiPattern = '/api/v1/search/query',
    searchTestTerm,
    searchParamName = 'endpoint',
    waitForLoadSelector = 'table',
    deleteBtnTestId = 'show-deleted',
  } = config;

  await page.goto(`${baseUrl}`);
  await page.locator(waitForLoadSelector).waitFor({ state: 'visible' });

  await waitForAllLoadersToDisappear(page);

  const nextButton = page.locator('[data-testid="next"]');
  await expect(page.getByTestId('previous')).toBeDisabled();

  const page2ResponsePromise = page.waitForResponse((response) =>
    response.url().includes(normalApiPattern)
  );

  await nextButton.click();
  const page2Response = await page2ResponsePromise;
  expect(page2Response.status()).toBe(200);
  await waitForAllLoadersToDisappear(page);

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationPage2 = page.locator('[data-testid="page-indicator"]');
  await expect(paginationPage2).toBeVisible();
  const page2Content = await paginationPage2.textContent();
  expect(page2Content).toMatch(/2\s*of\s*\d+/);

  const searchResponsePromise = page.waitForResponse((response) =>
    response.url().includes(searchApiPattern)
  );

  await page.getByTestId('searchbar').fill(searchTestTerm || '');
  const searchResponse = await searchResponsePromise;
  expect(searchResponse.status()).toBe(200);

  const urlAfterSearch = new URL(page.url());
  expect(urlAfterSearch.searchParams.get(searchParamName)).toBe(searchTestTerm);

  await expect(page.getByTestId('previous')).toBeDisabled();
  const paginationAfterSearch = page.locator('[data-testid="page-indicator"]');
  await expect(paginationAfterSearch).toBeVisible();
  const searchPage1Content = await paginationAfterSearch.textContent();
  expect(searchPage1Content).toMatch(/1\s*of\s*\d+/);

  const nextButtonAfterSearch = page.locator('[data-testid="next"]');

  const searchPage2Promise = page.waitForResponse((response) =>
    response.url().includes(searchApiPattern)
  );

  await nextButtonAfterSearch.click();
  const searchPage2Response = await searchPage2Promise;
  expect(searchPage2Response.status()).toBe(200);

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationSearchPage2 = page.locator('[data-testid="page-indicator"]');
  await expect(paginationSearchPage2).toBeVisible();
  const searchPage2Content = await paginationSearchPage2.textContent();
  expect(searchPage2Content).toMatch(/2\s*of\s*\d+/);

  const reloadPromise = page.waitForResponse((response) =>
    response.url().includes(searchApiPattern)
  );

  await page.reload();
  const reloadResponse = await reloadPromise;
  expect(reloadResponse.status()).toBe(200);

  const urlAfterRefresh = new URL(page.url());
  expect(urlAfterRefresh.searchParams.get(searchParamName)).toBe(
    searchTestTerm
  );

  await expect(page.getByTestId('previous')).toBeEnabled();
  const paginationAfterRefresh = page.locator('[data-testid="page-indicator"]');
  await expect(paginationAfterRefresh).toBeVisible();
  const refreshPage2Content = await paginationAfterRefresh.textContent();
  expect(refreshPage2Content).toMatch(/2\s*of\s*\d+/);

  await expect(page.getByTestId('searchbar')).toHaveValue(searchTestTerm || '');

  const deleteToggle = page.getByTestId(`${deleteBtnTestId}`);
  const isDeleteTogglePresent = await deleteToggle.count();

  if (isDeleteTogglePresent > 0) {
    const searchApiPromiseWithToggle1 = page.waitForResponse((response) =>
      response.url().includes(searchApiPattern)
    );

    await deleteToggle.click();
    const searchApiResponseWithToggle1 = await searchApiPromiseWithToggle1;
    expect(searchApiResponseWithToggle1.status()).toBe(200);
    await waitForAllLoadersToDisappear(page);

    const searchApiPromiseWithToggle2 = page.waitForResponse((response) =>
      response.url().includes(searchApiPattern)
    );

    await deleteToggle.click();
    const searchApiResponseWithToggle2 = await searchApiPromiseWithToggle2;
    expect(searchApiResponseWithToggle2.status()).toBe(200);
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByTestId('previous')).toBeDisabled();
    const paginationAfterToggleWithSearch = page.locator(
      '[data-testid="page-indicator"]'
    );
    await expect(paginationAfterToggleWithSearch).toBeVisible();
    const toggleSearchContent =
      await paginationAfterToggleWithSearch.textContent();
    expect(toggleSearchContent).toMatch(/1\s*of\s*\d+/);

    const urlAfterToggle = new URL(page.url());
    expect(urlAfterToggle.searchParams.get(searchParamName)).toBe(
      searchTestTerm
    );
  }
};

export const testTableSorting = async (
  page: Page,
  columnHeader: string,
  columnIndex = 0
) => {
  await waitForAllLoadersToDisappear(page);

  const header = page.locator(`th:has-text("${columnHeader}")`).first();
  const visibleRowSelector = `tbody tr:not([aria-hidden="true"])`;

  const getFirstCellValue = async () => {
    const firstCell = page.locator(`${visibleRowSelector} td`).nth(columnIndex);
    await firstCell.waitFor({ state: 'visible' });

    return (await firstCell.textContent())?.trim();
  };

  const initialValue = await getFirstCellValue();

  await header.click();
  await waitForAllLoadersToDisappear(page);
  await header.click();
  await waitForAllLoadersToDisappear(page);

  const afterFirstClickValue = await getFirstCellValue();

  expect(afterFirstClickValue).not.toBe(initialValue);

  await header.click();
  await waitForAllLoadersToDisappear(page);

  const afterSecondClickValue = await getFirstCellValue();

  expect(afterSecondClickValue).not.toBe(afterFirstClickValue);
};

export const testTableSearch = async (
  page: Page,
  searchIndex: string,
  searchTerm: string,
  notVisibleText: string
) => {
  await waitForAllLoadersToDisappear(page);

  await expect(async () => {
    const waitForSearchResponse = page.waitForResponse(
      `/api/v1/search/query?q=*index=${searchIndex}*`
    );
    await page.getByTestId('searchbar').fill(searchTerm);
    await waitForSearchResponse;
    await waitForAllLoadersToDisappear(page);

    await expect(page.getByText(searchTerm).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(notVisibleText).first()).not.toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 30_000, intervals: [2_000, 5_000] });
};

export const selectOptionWithRetry = async (
  trigger: Locator,
  option: Locator
) => {
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }

    await option.click({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
};
