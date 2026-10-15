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
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { getToken, setToken } from '../../utils/tokenStorage';

/**
 * Guards the token transport that `utils/apiSignIn.ts` depends on.
 *
 * Runs against the configured `baseURL`, so it follows the environment rather
 * than pinning one. Every request is stubbed, so it still needs no backend —
 * the subject is the browser-side storage behaviour, not the app.
 *
 * The origin has to be a *secure* one. `tokenStorage` reaches for IndexedDB
 * only when `'serviceWorker' in navigator`, and silently falls back to
 * localStorage otherwise — so on a plain-http remote origin this whole file
 * would pass while exercising nothing but the fallback. The first case asserts
 * the secure context outright so that degradation fails loudly instead of
 * quietly, and the last case keeps the fallback distinguishable from a real
 * IndexedDB round trip. `http://localhost` and any https origin both qualify,
 * which covers the default run, `PW_PROTOCOL=h2`, and a deployed target.
 */

const stubEverything = (context: BrowserContext) =>
  context.route('**/*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<html><body>token storage harness</body></html>',
    })
  );

const openStubbedPage = async (context: BrowserContext): Promise<Page> => {
  await stubEverything(context);
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  return page;
};

test.describe('token storage', () => {
  test.beforeEach(async ({ context, page }) => {
    await stubEverything(context);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('runs against a secure context, so IndexedDB is the path under test', async ({
    page,
  }) => {
    const capabilities = await page.evaluate(() => ({
      hasServiceWorker: 'serviceWorker' in navigator,
      hasIndexedDB: 'indexedDB' in window,
    }));

    expect(capabilities).toEqual({
      hasServiceWorker: true,
      hasIndexedDB: true,
    });
  });

  test('setToken writes where getToken reads', async ({ page }) => {
    // Regression: on a context whose object store did not exist yet,
    // getFromIndexedDB resolved from onupgradeneeded without creating the
    // store, then onsuccess threw NotFoundError inside the event handler — a
    // promise that never settled, so this call hung until the test timed out
    // rather than failing.
    await setToken(page, 'tok-abc-123');

    expect(await getToken(page)).toBe('tok-abc-123');
  });

  test('a stubbed blank document is storage origin enough to seed a session', async ({
    baseURL,
    browser,
  }) => {
    // `utils/apiSignIn.ts` seeds the token into a route-stubbed blank document
    // rather than booting the app just to obtain an origin — worth ~1700 app
    // boots a run. That only holds if storage on such a document is the same
    // storage the app reads afterwards, so pin it rather than comment it.
    //
    // A cold context on purpose: the describe-level `beforeEach` navigates, and
    // seeding from an already-navigated page would prove nothing. This starts
    // where `signInViaApi` starts, on a page that has never left about:blank.
    const primerPath = '/__playwright_auth_primer__';
    const cold = await browser.newContext({ baseURL });

    try {
      const page = await cold.newPage();
      await page.route(`**${primerPath}`, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<!doctype html><title>auth primer</title>',
        })
      );
      await page.goto(primerPath, { waitUntil: 'domcontentloaded' });

      expect(await page.evaluate(() => 'serviceWorker' in navigator)).toBe(
        true
      );

      await setToken(page, 'tok-from-primer');
      await page.unroute(`**${primerPath}`);

      // Now stand the app up in place of the primer and read the token back.
      await stubEverything(cold);
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      expect(await getToken(page)).toBe('tok-from-primer');
    } finally {
      await cold.close();
    }
  });

  test('the token survives storageState({ indexedDB: true }) into a new context', async ({
    baseURL,
    browser,
    context,
    page,
  }) => {
    await setToken(page, 'tok-survives');

    const restored = await browser.newContext({
      baseURL,
      storageState: await context.storageState({ indexedDB: true }),
    });

    try {
      const restoredPage = await openStubbedPage(restored);

      expect(await getToken(restoredPage)).toBe('tok-survives');
    } finally {
      await restored.close();
    }
  });

  test('a state captured without indexedDB does not carry the token', async ({
    baseURL,
    browser,
    context,
    page,
  }) => {
    await setToken(page, 'tok-lost');

    const restored = await browser.newContext({
      baseURL,
      storageState: await context.storageState(),
    });

    try {
      const restoredPage = await openStubbedPage(restored);

      expect(await getToken(restoredPage)).toBe('');
    } finally {
      await restored.close();
    }
  });
});
