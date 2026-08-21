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

/**
 * Ported from `collate-ui`'s `AppMode/AppModePreferenceRoundTrip.spec.ts`.
 *
 * The Collate original drove the "remember" toggle from AI mode
 * (`switchToAiModeViaProfileToggle`). Stock OM has no installed
 * non-default mode to switch to — `useAppRoutesRegistry` is empty unless a
 * plugin registers one — so this port exercises the identical debounced
 * PUT/DELETE round trip against the mode that IS active out of the box:
 * `default` (Classic). The wire mechanics under test
 * (`useCurrentUserStore.ts::syncBackendKeys`, the `{type, config}` body
 * shape, the 300ms coalescing window) are the same regardless of which
 * mode string is being remembered.
 */

import { expect, Page, Request, test } from '@playwright/test';
import { UserClass } from '../../../support/user/UserClass';
import {
  isAppModePreferenceDelete,
  isAppModePreferencePut,
  openAppModeSwitcher,
} from '../../../utils/appMode';
import { createNewPage } from '../../../utils/common';

/**
 * Logs `user` in and opens the app-mode switcher popover in a fresh,
 * isolated browser context — never a shared admin fixture, since this
 * suite needs a user with no pre-existing preference.
 */
const openSwitcher = async (page: Page, user: UserClass) => {
  await user.login(page);
  await openAppModeSwitcher(page);
};

const user = new UserClass();

test.beforeAll('Create fresh fixture user', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await user.create(apiContext);
  await afterAction();
});

test.afterAll('Delete fixture user', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await user.delete(apiContext);
  await afterAction();
});

test.describe('AppMode — preference round trip', () => {
  test.afterEach(async ({ browser }) => {
    // Best-effort: a mid-test assertion failure must not leak a PUT'd
    // preference into a sibling test that shares this fixture user.
    const { apiContext, afterAction } = await createNewPage(browser);
    await apiContext
      .delete(`/api/v1/users/${user.responseData.id}/preferences/appMode`)
      .catch(() => undefined);
    await afterAction();
  });

  test('Toggle "remember" ON emits a PUT with the typed-union body', async ({
    browser,
  }) => {
    // openSwitcher = user.login + open-switcher — heavy enough to tip past
    // the 60s default under CI load. Bump per-test.
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openSwitcher(page, user);

      const [putResponse] = await Promise.all([
        page.waitForResponse(isAppModePreferencePut),
        page.getByTestId('app-mode-remember-toggle').first().click(),
      ]);

      const request: Request = putResponse.request();

      expect(request.method()).toBe('PUT');
      expect(request.url()).toContain(
        `/users/${user.responseData.id}/preferences/appMode`
      );
      expect(request.postDataJSON()).toEqual({
        type: 'appMode',
        config: { value: 'default' },
      });
    } finally {
      await context.close();
    }
  });

  test('Toggle "remember" OFF emits a DELETE', async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openSwitcher(page, user);

      // Tick it on first so there is something to untick.
      await Promise.all([
        page.waitForResponse(isAppModePreferencePut),
        page.getByTestId('app-mode-remember-toggle').first().click(),
      ]);

      const [deleteResponse] = await Promise.all([
        page.waitForResponse(isAppModePreferenceDelete),
        page.getByTestId('app-mode-remember-toggle').first().click(),
      ]);

      expect(deleteResponse.request().method()).toBe('DELETE');
      expect(deleteResponse.status()).toBe(200);
    } finally {
      await context.close();
    }
  });

  test('Rapid tick/untick/tick inside the debounce window coalesces to one request', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await openSwitcher(page, user);

      const preferenceRequests: string[] = [];
      const onRequest = (request: Request) => {
        if (request.url().endsWith('/preferences/appMode')) {
          preferenceRequests.push(request.method());
        }
      };
      page.on('request', onRequest);

      const toggle = page.getByTestId('app-mode-remember-toggle').first();
      // Three clicks well inside the 300ms debounce window — the write path
      // (`syncBackendKeys` in `useCurrentUserStore.ts`) keeps only the
      // last-write-wins value per key until the timer fires.
      await toggle.click(); // on
      await toggle.click(); // off
      await toggle.click(); // on — final state, so a single PUT is expected

      await page.waitForResponse(isAppModePreferencePut, { timeout: 10_000 });
      // Give the network a moment to go idle so a (bug-case) second request
      // has time to show up before we count.
      await page.waitForTimeout(500);
      page.off('request', onRequest);

      expect(preferenceRequests).toEqual(['PUT']);
      await expect(toggle.locator('[role="checkbox"]')).toHaveAttribute(
        'aria-checked',
        'true'
      );
    } finally {
      await context.close();
    }
  });
});
