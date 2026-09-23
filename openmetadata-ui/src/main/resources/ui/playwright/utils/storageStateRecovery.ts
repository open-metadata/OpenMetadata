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
export const watchAuthBoot = (page: Page): Promise<boolean> => {
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

const recover = async (
  page: Page,
  bootedSignedOut: Promise<boolean>,
  reloadUrl: string
): Promise<boolean> => {
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
};

// Both the context fixture and redirectToHomePage watch the same first boot.
// Whichever asks first runs the recovery (and its single reload); the other
// awaits that outcome, so a page is never reloaded twice.
const recoveries = new WeakMap<Page, Promise<boolean>>();

/**
 * Re-seeds the token and reloads `reloadUrl` when the boot landed on /signin
 * only because the storageState token was lost. Returns whether this page was
 * recovered, by this call or a concurrent one.
 */
export const recoverLostStorageStateToken = (
  page: Page,
  bootedSignedOut: Promise<boolean>,
  reloadUrl: string
): Promise<boolean> => {
  const inFlight = recoveries.get(page);

  if (inFlight) {
    return inFlight;
  }

  const recovery = recover(page, bootedSignedOut, reloadUrl);
  recoveries.set(page, recovery);

  return recovery;
};

const guardFirstBoot = (page: Page) => {
  const onRequest = (request: Request) => {
    if (
      !request.isNavigationRequest() ||
      request.frame() !== page.mainFrame()
    ) {
      return;
    }
    page.off('request', onRequest);

    // Runs alongside the test: by the time it acts, the test is on /signin
    // and would fail anyway. Reloading the URL the test asked for lets its
    // pending locator and response waits resolve against the signed-in app.
    recoverLostStorageStateToken(
      page,
      watchAuthBoot(page),
      request.url()
    ).catch((error) => {
      // A test that closes or navigates the page mid-check is not a failure
      // of this guard; it must never fail a test on its own.
      if (!page.isClosed()) {
        console.warn(`[auth] storageState recovery skipped: ${error}`);
      }
    });
  };

  page.on('request', onRequest);
};

/**
 * Covers specs whose first navigation is not redirectToHomePage (a direct
 * `page.goto('/observability')` etc.). Watches only each page's first main
 * frame navigation — the only boot that can observe a lost restore — and adds
 * no wait to the test itself.
 */
export const guardStorageStateBoot = (context: BrowserContext) => {
  context.pages().forEach(guardFirstBoot);
  context.on('page', guardFirstBoot);
};
