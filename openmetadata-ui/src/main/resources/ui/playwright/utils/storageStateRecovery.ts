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
import { BrowserContext, Page, Request, test } from '@playwright/test';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { APP_STATE_KEY, getToken, OIDC_TOKEN_KEY } from './tokenStorage';

/**
 * Recovers a context whose storageState token never reached IndexedDB.
 *
 * On loaded CI hosts (load average ~100 on AUT runs) a context created from a
 * `playwright/.auth/*.json` file occasionally boots with an empty
 * `AppDataStore` even though the file carries a valid token: the cookies and
 * the token were handed to the context, but the app's first read of the token
 * returns nothing, so `resumeSignedInSession` renders /signin without a single
 * authenticated request. The test then fails 60s later on whatever it tried
 * next, which is why these flakes look unrelated. Measured at 3-7 attempts per
 * lane per AUT run, always on the context's first navigation.
 *
 * The recovery is deliberately narrow so it cannot mask a real auth bug. It
 * only acts when the app landed on /signin, the context still holds a session
 * cookie, a storageState file owns that exact session, and IndexedDB has no
 * token at all. A logout, a revoked session or an expired token all leave one
 * of those conditions false and fall through to the original failure.
 */

const AUTH_STATE_DIR = 'playwright/.auth';
// Same value as sessionRenewal's SESSION_COOKIE_NAME; not imported from there
// because sessionRenewal -> ssoAuth -> common would make common.ts import itself.
const SESSION_COOKIE_NAME = 'OM_SESSION';
const LOGGED_IN_USER_PATH = '/api/v1/users/loggedInUser';
const BOOT_DECISION_TIMEOUT_MS = 30_000;

type StorageStateFile = {
  cookies?: { name: string; value: string }[];
  origins?: {
    indexedDB?: {
      stores: { records: { key?: unknown; value?: unknown }[] }[];
    }[];
  }[];
};

/**
 * Resolves to true when the app decides it is signed out, false when it loads
 * the signed-in user. Must be started before the navigation it observes.
 */
const watchAuthBoot = (page: Page): Promise<boolean> => {
  const signedOut = page
    .waitForURL('**/signin', { timeout: BOOT_DECISION_TIMEOUT_MS })
    .then(() => true);
  const signedIn = page
    .waitForResponse(
      (response) => response.url().includes(LOGGED_IN_USER_PATH),
      { timeout: BOOT_DECISION_TIMEOUT_MS }
    )
    .then(() => false);

  // The loser of the race rejects on its own timeout later; that is expected.
  signedOut.catch(() => undefined);
  signedIn.catch(() => undefined);

  return Promise.race([signedOut, signedIn]).catch(() => false);
};

const tokenFromStateFile = (state: StorageStateFile): string | undefined => {
  for (const origin of state.origins ?? []) {
    for (const database of origin.indexedDB ?? []) {
      for (const store of database.stores) {
        const record = store.records.find(({ key }) => key === APP_STATE_KEY);

        if (typeof record?.value === 'string') {
          return JSON.parse(record.value)[OIDC_TOKEN_KEY];
        }
      }
    }
  }

  return undefined;
};

/**
 * The session cookie is restored through a different path than IndexedDB and
 * survives, so it identifies which storageState file this context came from —
 * without it, recovering with the admin token could silently turn a
 * dataConsumer permission test into an admin one.
 */
const findStateTokenForSession = async (
  context: BrowserContext
): Promise<string | undefined> => {
  const session = (await context.cookies()).find(
    ({ name }) => name === SESSION_COOKIE_NAME
  )?.value;

  if (!session) {
    return undefined;
  }

  const files = (await readdir(AUTH_STATE_DIR)).filter((file) =>
    file.endsWith('.json')
  );

  for (const file of files) {
    const state: StorageStateFile = JSON.parse(
      await readFile(path.join(AUTH_STATE_DIR, file), 'utf8')
    );
    const ownsSession = state.cookies?.some(
      ({ name, value }) => name === SESSION_COOKIE_NAME && value === session
    );

    const token = ownsSession ? tokenFromStateFile(state) : undefined;

    if (token) {
      return token;
    }
  }

  return undefined;
};

/**
 * Writes through the Service Worker rather than IndexedDB directly, because
 * the SW keeps an in-memory copy that `getOidcToken()` reads first.
 */
const writeTokenThroughServiceWorker = async (page: Page, token: string) => {
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker?.controller),
    undefined,
    { timeout: BOOT_DECISION_TIMEOUT_MS }
  );

  await page.evaluate(
    ({ appStateKey, oidcTokenKey, oidcToken }) =>
      new Promise<void>((resolve, reject) => {
        const controller = navigator.serviceWorker.controller;

        if (!controller) {
          reject(new Error('No active Service Worker controller'));

          return;
        }

        const channel = new MessageChannel();

        channel.port1.onmessage = (event) =>
          event.data?.error ? reject(new Error(event.data.error)) : resolve();
        controller.postMessage(
          {
            type: 'set',
            key: appStateKey,
            value: JSON.stringify({ [oidcTokenKey]: oidcToken }),
          },
          [channel.port2]
        );
      }),
    {
      appStateKey: APP_STATE_KEY,
      oidcTokenKey: OIDC_TOKEN_KEY,
      oidcToken: token,
    }
  );
};

const annotateRecovery = (description: string) => {
  console.warn(`[auth] ${description}`);
  try {
    test.info().annotations.push({ type: 'auth-token-recovered', description });
  } catch {
    // Called outside a test (e.g. a setup script): the log line is enough.
  }
};

// A test that deliberately lands here (to log in as another user) is not a
// failed restore, whatever state its storage happens to be in.
const AUTH_ROUTES = ['/signin', '/signup', '/forgot-password', '/callback'];

const isAuthRoute = (url: string) => {
  const { pathname } = new URL(url, 'http://localhost');

  return AUTH_ROUTES.some((route) => pathname.startsWith(route));
};

const recover = async (
  page: Page,
  bootedSignedOut: Promise<boolean>,
  reloadUrl: string
): Promise<boolean> => {
  try {
    if (!(await bootedSignedOut) || (await getToken(page))) {
      return false;
    }

    const token = await findStateTokenForSession(page.context());

    if (!token) {
      return false;
    }

    annotateRecovery(
      'storageState token missing from IndexedDB at boot; re-seeded from ' +
        `${AUTH_STATE_DIR} and reloaded ${reloadUrl} (landed on ${page.url()})`
    );
    await writeTokenThroughServiceWorker(page, token);
    await page.goto(reloadUrl, { waitUntil: 'domcontentloaded' });

    return true;
  } catch (error) {
    // The test navigated or closed the page mid-check. That is not a failure
    // of this guard, and the guard must never fail a test on its own.
    if (!page.isClosed()) {
      console.warn(`[auth] storageState recovery skipped: ${error}`);
    }

    return false;
  }
};

/**
 * Only a context's very first navigation can observe a failed storageState
 * restore — nothing else has touched its storage yet. Any later signed-out
 * boot follows something the test did (cleared the token to log in as another
 * user, logged out, ...) and must fail or pass exactly as written, so every
 * context is claimed once, by whichever entry point sees that navigation first.
 */
const claimedContexts = new WeakSet<BrowserContext>();

/**
 * Call synchronously before starting the navigation to `reloadUrl`. Returns
 * undefined when that navigation is not the context's first boot; otherwise a
 * promise (never rejecting) of whether the lost token was re-seeded and
 * `reloadUrl` reloaded.
 */
export const claimFirstBoot = (
  page: Page,
  reloadUrl: string
): Promise<boolean> | undefined => {
  const context = page.context();
  const isFirstBoot =
    !claimedContexts.has(context) && page.url() === 'about:blank';

  claimedContexts.add(context);

  if (!isFirstBoot || isAuthRoute(reloadUrl)) {
    return undefined;
  }

  return recover(page, watchAuthBoot(page), reloadUrl);
};

/**
 * Covers specs whose first navigation is not redirectToHomePage (a direct
 * `page.goto('/observability')` etc.). Watches only the context's first main
 * frame navigation and adds no wait to the test itself: by the time it acts
 * the test is stuck on /signin and would fail anyway, and reloading the URL
 * the test asked for lets its pending locator and response waits resolve
 * against the signed-in app.
 */
export const guardStorageStateBoot = (context: BrowserContext) => {
  const onRequest = (request: Request) => {
    const frame = request.frame();

    if (!request.isNavigationRequest() || frame.parentFrame()) {
      return;
    }
    context.off('request', onRequest);
    claimFirstBoot(frame.page(), request.url());
  };

  context.on('request', onRequest);
};
