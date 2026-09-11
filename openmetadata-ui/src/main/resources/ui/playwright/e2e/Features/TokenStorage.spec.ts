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
 * Every request is stubbed, so this needs no backend — the point is the
 * browser-side storage behaviour, not the app.
 *
 * The origin must be `localhost`. `tokenStorage` picks IndexedDB only when
 * `'serviceWorker' in navigator`, which is false on a non-secure origin, and
 * silently falls back to localStorage. A version of this test written against
 * `http://something.test/` passes while exercising nothing but the fallback —
 * the third case below is what keeps that honest.
 */
const ORIGIN = 'http://localhost:8585/';

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
  await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });

  return page;
};

test.describe('token storage', () => {
  test.beforeEach(async ({ context, page }) => {
    await stubEverything(context);
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
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

  test('the token survives storageState({ indexedDB: true }) into a new context', async ({
    browser,
    context,
    page,
  }) => {
    await setToken(page, 'tok-survives');

    const restored = await browser.newContext({
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
    browser,
    context,
    page,
  }) => {
    await setToken(page, 'tok-lost');

    const restored = await browser.newContext({
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
