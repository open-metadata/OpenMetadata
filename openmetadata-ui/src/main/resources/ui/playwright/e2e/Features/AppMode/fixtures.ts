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
 * Shared Playwright fixtures for the AppMode/*.spec.ts suite.
 *
 * Motivation — the AppMode tests exercise the server-persisted
 * `user_preferences.appMode` and, in some cases, deliberately PUT it. When
 * those tests run as the shared `playwright/.auth/admin.json` fixture, a
 * passing test can leave the default admin's preference at `ai` for the rest
 * of the run, pushing every downstream spec into AI mode and breaking every
 * Classic-sidebar / Classic-navbar assertion across the suite.
 *
 * The fix: give the whole AppMode suite its own isolated admin. The
 * `isolatedAdmin` fixture is worker-scoped — created once per Playwright
 * worker, hard-deleted at worker teardown so the `user_preferences` row dies
 * with the user regardless of what any test writes. Same shape for the
 * non-admin `dataConsumer` used by the settings gating tests.
 *
 * The `page` / `dataConsumerPage` fixtures are test-scoped — a fresh browser
 * context per test, logged in via the UI. The teardown DELETEs the isolated
 * admin's `preferences/appMode` so a test that leaves it at `ai` doesn't
 * poison the next test in the same worker (belt-and-braces; the worker-scope
 * delete is still the ultimate guarantee).
 */

import { Browser, Page, test as base } from '@playwright/test';
import { UserClass } from '../../../support/user/UserClass';
import {
  createNewPage,
  getDefaultAdminAPIContext,
} from '../../../utils/common';

type WorkerFixtures = {
  isolatedAdmin: UserClass;
  dataConsumer: UserClass;
};

type TestFixtures = {
  page: Page;
  dataConsumerPage: Page;
};

/**
 * Best-effort DELETE of a user's server-side `appMode` preference via the
 * default super-admin's API context. Used between tests so state that one
 * test intentionally writes cannot leak into the next test on the same
 * worker's fixture user.
 */
const deleteAppModePreferenceFor = async (
  browser: Browser,
  userId: string
): Promise<void> => {
  const admin = await getDefaultAdminAPIContext(browser);
  try {
    await admin.apiContext.delete(
      `/api/v1/users/${userId}/preferences/appMode`
    );
  } catch {
    // Cleanup is best-effort — a missing pref is a 404, not a fatal error.
  } finally {
    await admin.afterAction();
  }
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  isolatedAdmin: [
    async ({ browser }, use) => {
      const admin = new UserClass(undefined, /* isAdmin */ true);
      const setup = await createNewPage(browser);
      await admin.create(setup.apiContext);
      await setup.afterAction();

      await use(admin);

      const teardown = await createNewPage(browser);
      await admin.delete(teardown.apiContext).catch(() => undefined);
      await teardown.afterAction();
    },
    { scope: 'worker' },
  ],

  dataConsumer: [
    async ({ browser }, use) => {
      const user = new UserClass();
      const setup = await createNewPage(browser);
      await user.create(setup.apiContext);
      await setup.afterAction();

      await use(user);

      const teardown = await createNewPage(browser);
      await user.delete(teardown.apiContext).catch(() => undefined);
      await teardown.afterAction();
    },
    { scope: 'worker' },
  ],

  page: async ({ browser, isolatedAdmin }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await isolatedAdmin.login(page);
      await use(page);
    } finally {
      await context.close();
      // Reset the isolated admin's server-side appMode preference so the
      // next test on this worker starts from a clean baseline. The
      // worker-scope user delete still guarantees zero cross-run leak;
      // this just keeps intra-worker ordering irrelevant.
      await deleteAppModePreferenceFor(
        browser,
        isolatedAdmin.responseData.id
      ).catch(() => undefined);
    }
  },

  dataConsumerPage: async ({ browser, dataConsumer }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await dataConsumer.login(page);
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect } from '@playwright/test';
