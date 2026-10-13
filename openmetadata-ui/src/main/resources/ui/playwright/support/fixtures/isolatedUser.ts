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
import { BrowserContext, Page } from '@playwright/test';
import { UserClass } from '../../support/user/UserClass';
import {
  disableEtagConditionalReads,
  getWorkerAdminAPIContext,
} from '../../utils/common';
import { test as base } from './base';
import { installServerLoadReducers } from './serverLoad';

/**
 * The sanctioned way to run a test as a user that is *not* one of the seeded
 * roles.
 *
 * The seeded role pages in `userPages.ts` cover most specs. When they do not —
 * the test needs its own team, its own policy, or it renames or deletes the
 * account it is signed in as — the answer is one of these fixtures, **not** a
 * hand-rolled `new UserClass()` in `beforeAll` plus `performUserLogin`.
 *
 * That hand-rolled shape is what these exist to remove, because it fails the
 * same three ways every time:
 *
 * 1. **Lifecycle.** The user is created in `beforeAll` and deleted in
 *    `afterAll`, usually via an array the hook pushes into. `beforeAll` runs
 *    once per *group* of the file's tests dispatched to a worker, not once per
 *    worker, so it can run twice with an `afterAll` in between — and the array
 *    then holds accounts that no longer exist. That is the merge queue's
 *    number-one flake. A fixture cannot be got wrong this way: Playwright owns
 *    the teardown and runs it exactly once per instantiation.
 * 2. **Cost.** `UserClass.login()` drives the sign-in form: navigate, fill,
 *    tab, fill, click, await the response, await the redirect, dismiss the
 *    getting-started modal, collapse the sidebar. Nine UI interactions on the
 *    critical path of a test that is not about signing in. These fixtures sign
 *    in through the API instead (`UserClass.signIn`) — one POST and two
 *    navigations — so even the per-test variant is cheap.
 * 3. **Leaks.** A `beforeAll` that creates and an `afterAll` that misses one
 *    branch leaves the account behind for the rest of the run. Fixture teardown
 *    runs even when the test throws.
 *
 * Which one to take:
 *
 * - **`isolatedUserPage`** — one account per worker, a fresh page per test.
 *   Correct whenever the test needs *an* account that is not a seeded role but
 *   does not modify the account itself. The account is created and signed in
 *   once per worker; each test gets a page restored from the captured storage
 *   state.
 * - **`freshUserPage`** — a brand-new account per test. Use it whenever the
 *   test mutates the account it is signed in as (rename, role change,
 *   deactivate, delete), or whenever you simply want per-test isolation.
 *   Because the sign-in is an API call rather than a form, this costs a signup
 *   plus one POST — cheap enough to be a default rather than a last resort.
 *
 * ```ts
 * import { test } from '../../support/fixtures/isolatedUser';
 *
 * test.use({ isolatedUserOptions: { isAdmin: true } });
 *
 * test('an admin that is not the shared admin can do X', async ({
 *   isolatedUserPage,
 *   isolatedUser,
 * }) => {
 *   await isolatedUserPage.goto(`/users/${isolatedUser.getUserName()}`);
 * });
 * ```
 */
export type IsolatedUserOptions = {
  /** Grant the account admin. Defaults to a plain DataConsumer. */
  isAdmin?: boolean;
};

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

type IsolatedUserSession = {
  user: UserClass;
  storageState: StorageState;
};

export type IsolatedUserWorkerFixtures = {
  isolatedUserOptions: IsolatedUserOptions;
  isolatedUserSession: IsolatedUserSession;
};

export type IsolatedUserTestFixtures = {
  /** The account `isolatedUserPage` is signed in as. */
  isolatedUser: UserClass;
  /** A page signed in as the worker's isolated account. */
  isolatedUserPage: Page;
  /** A brand-new account and page, for tests that mutate the account itself. */
  freshUserPage: { page: Page; user: UserClass };
};

const preparePage = async (page: Page) => {
  await installServerLoadReducers(page.context());
  await disableEtagConditionalReads(page);

  return page;
};

export const test = base.extend<
  IsolatedUserTestFixtures,
  IsolatedUserWorkerFixtures
>({
  isolatedUserOptions: [{}, { option: true, scope: 'worker' }],

  /**
   * Sign in once per worker and keep the storage state, rather than driving the
   * sign-in form again for every test. The capture must include IndexedDB: the
   * app keeps its token under `AppDataStore/keyValueStore/app_state`, not in
   * localStorage, so a state captured without it restores a signed-out page.
   */
  isolatedUserSession: [
    async ({ browser, isolatedUserOptions }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const user = new UserClass(undefined, isolatedUserOptions.isAdmin);
      await user.create(apiContext);

      const loginPage = await browser.newPage();

      try {
        await installServerLoadReducers(loginPage.context());
        await user.signIn(loginPage);
        const storageState = await loginPage
          .context()
          .storageState({ indexedDB: true });

        await use({ user, storageState });
      } finally {
        await loginPage.close();
        await user.delete(apiContext);
      }
    },
    { scope: 'worker' },
  ],

  isolatedUser: async ({ isolatedUserSession }, use) => {
    await use(isolatedUserSession.user);
  },

  isolatedUserPage: async ({ browser, isolatedUserSession }, use) => {
    const page = await preparePage(
      await browser.newPage({ storageState: isolatedUserSession.storageState })
    );

    await use(page);
    await page.close();
  },

  freshUserPage: async ({ browser }, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const user = new UserClass();
    await user.create(apiContext);

    const page = await browser.newPage();

    try {
      await installServerLoadReducers(page.context());
      await user.signIn(page);
      await disableEtagConditionalReads(page);

      await use({ page, user });
    } finally {
      await page.close();
      await user.delete(apiContext);
    }
  },
});

export { expect } from '@playwright/test';
