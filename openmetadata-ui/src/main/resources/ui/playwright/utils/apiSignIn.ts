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
import { expect, Page, request } from '@playwright/test';
import { suppressWelcomeScreen } from './common';
import { setToken } from './tokenStorage';

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
 * The navigation to the app origin before writing the token is required, not
 * incidental: IndexedDB is origin-scoped, so there is nowhere to write until
 * the page has loaded the origin. Unauthenticated it lands on /signin, which is
 * the same origin and serves fine as a place to seed from.
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
  const isH2Mode = process.env.PW_PROTOCOL === 'h2';
  const loginContext = await request.newContext({
    baseURL:
      process.env.PLAYWRIGHT_TEST_BASE_URL ??
      (isH2Mode ? 'https://localhost:8585' : 'http://localhost:8585'),
    ignoreHTTPSErrors: isH2Mode,
    timeout: 90000,
  });

  try {
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

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (credentials.suppressWelcome ?? true) {
      await suppressWelcomeScreen(
        page,
        credentials.userName ?? credentials.email
      );
    }
    await setToken(page, accessToken);
    await page.goto('/my-data', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByTestId('left-sidebar'),
      `API sign-in as "${credentials.email}" did not produce a signed-in session — the app shell never rendered. The token was accepted by /api/v1/auth/login but the app did not pick it up from app_state.primary; check utils/tokenStorage.ts against the app's SwTokenStorageUtils.`
    ).toBeAttached({ timeout: 30_000 });

    return accessToken;
  } finally {
    await loginContext.dispose();
  }
};
