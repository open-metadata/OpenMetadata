/*
 *  Copyright 2025 Collate.
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
import { Page } from '@playwright/test';
import {
  test as userPagesTest,
  UserPages,
} from '../../support/fixtures/userPages';

/**
 * The role-page fixtures with the built-in `page` aliased to `adminPage`.
 *
 * This is the only difference from `support/fixtures/userPages.ts`, which owns
 * every role page and all the construction logic. The two used to be
 * near-identical copies that had already drifted — one had `viewOnlyPage`, the
 * other did not — so the pages themselves now live in exactly one place and this
 * module adds only the alias.
 *
 * Which one to import:
 *
 * - **this module** when the spec is admin-first and wants `{ page }` to be a
 *   signed-in admin, optionally taking a role page alongside it;
 * - **`support/fixtures/userPages`** when the spec drives named roles explicitly
 *   and wants `page` left as Playwright's own (so a file-level
 *   `test.use({ storageState })` still applies).
 *
 * `page` here ignores `test.use({ storageState })` — it is always the admin
 * storage state. That is deliberate and long-standing; use the other module if
 * you need `storageState` to win.
 */
export type CustomFixtures = UserPages & {
  page: Page;
};

export const test = userPagesTest.extend<{ page: Page }>({
  page: async ({ adminPage }, use) => {
    await use(adminPage);
  },
});

export { expect } from '@playwright/test';
