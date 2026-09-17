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
import { expect, Page } from '@playwright/test';
import { suppressWelcomeScreen } from './common';
import { setToken } from './tokenStorage';

/**
 * A path on the app's origin that the app does not serve, used only to obtain a
 * document to seed storage into.
 *
 * Seeding used to navigate to `/`, which boots the entire SPA — bundle,
 * bootstrap requests, render — purely so the next two lines have an origin to
 * write to. That is a whole extra app boot on every sign-in, and it showed:
 * once the suite migrated to `signIn()`, CI measured 2.59 app boots per UI
 * scenario against a 2.23 baseline, ~1700 extra boots per run.
 *
 * Storage is scoped to the *origin*, not to the app, so a stubbed blank
 * document on that origin gives `suppressWelcomeScreen` and `setToken` exactly
 * the same access for one intercepted request and no boot. `TokenStorage.spec`
 * holds a case on this, since sign-in now depends on it.
 */
const PRIMER_PATH = '/__playwright_auth_primer__';

/**
 * Sign a page in by asking the API for a token and writing it where the app
 * looks, instead of driving the sign-in form.
 *
 * `UserClass.login()` performs nine UI interactions — navigate to /signin, wait
 * for the form, fill the email, Tab, fill the password, click, await the login
 * response, await the redirect, dismiss the getting-started modal, collapse the
 * sidebar. Every one of them is a step that can time out, and the suite does it
 * ~290 times. None of it is what the tests are testing.
 *
 * This does the same job with one POST and two navigations, out of pieces that
 * are already load-bearing elsewhere in the suite:
 *
 * - the request shape is the one `createAdminApiContext` uses (the password is
 *   base64, matching the UI's `btoa(password)`);
 * - `setToken` is the exact inverse of the `getToken` that `auth.setup.ts`
 *   reads back after a real sign-in — both operate on `app_state.primary` in
 *   the `AppDataStore` IndexedDB store, which is where the app's
 *   `setOidcToken()` puts the access token after a basic-auth login;
 * - `suppressWelcomeScreen` is the same call `UserClass.login()` makes.
 *
 * A navigation before writing the token is required, not incidental: IndexedDB
 * and localStorage are origin-scoped, so there is nowhere to write until the
 * page owns a document on the app's origin. It does not have to be the *app* —
 * see `PRIMER_PATH` below.
 *
 * The trailing assertion is deliberate. If the injected session is not accepted
 * — a changed token key, a refresh token the app has started to require, an
 * auth provider that is not basic — this fails here, naming the user, rather
 * than letting the test walk on to a signed-out page and time out somewhere
 * unrelated 60 seconds later.
 */
export const signInViaApi = async (
  page: Page,
  credentials: {
    email: string;
    password: string;
    userName?: string;
    /** Seed `loggedInUsers` so the landing-page welcome banner never renders. */
    suppressWelcome?: boolean;
  }
): Promise<string> => {
  // Post through the page's own context, not a standalone `request.newContext()`.
  // The server sets `OM_SESSION` on the login response, and `context.request`
  // shares its cookie jar with the browser — a throwaway context would swallow
  // that cookie, leaving a storage state that authenticates through the token in
  // IndexedDB but carries no session cookie. The app itself does not mind, which
  // is what makes the omission easy to miss locally, but
  // `.github/scripts/rotate_playwright_auth_state.py` rotates the cached
  // preseeded state by replacing that cookie and fails the whole CI job with
  // "Playwright auth state has no OM_SESSION cookie" when it is absent.
  const loginContext = page.context().request;

  const response = await loginContext.post('/api/v1/auth/login', {
    data: {
      email: credentials.email,
      password: Buffer.from(credentials.password).toString('base64'),
    },
  });

  if (!response.ok()) {
    throw new Error(
      `API sign-in failed for "${
        credentials.email
      }" (${response.status()}): ${await response.text()}`
    );
  }

  const { accessToken } = (await response.json()) as { accessToken: string };

  if (!accessToken) {
    throw new Error(
      `API sign-in for "${credentials.email}" returned no accessToken.`
    );
  }

  // Registered last, so it wins over any broader `**/*` handler an enclosing
  // fixture installed, and removed again before the real navigation below.
  await page.route(`**${PRIMER_PATH}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>auth primer</title>',
    })
  );

  try {
    await page.goto(PRIMER_PATH, { waitUntil: 'domcontentloaded' });

    if (credentials.suppressWelcome ?? true) {
      await suppressWelcomeScreen(
        page,
        credentials.userName ?? credentials.email
      );
    }
    await setToken(page, accessToken);
  } finally {
    await page.unroute(`**${PRIMER_PATH}`);
  }

  await page.goto('/my-data', { waitUntil: 'domcontentloaded' });

  await expect(
    page.getByTestId('left-sidebar'),
    `API sign-in as "${credentials.email}" did not produce a signed-in session — the app shell never rendered. The token was accepted by /api/v1/auth/login but the app did not pick it up from app_state.primary; check utils/tokenStorage.ts against the app's SwTokenStorageUtils.`
  ).toBeAttached({ timeout: 30_000 });

  return accessToken;
};
