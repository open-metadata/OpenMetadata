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
import { Browser, Page } from '@playwright/test';
import { disableEtagConditionalReads } from '../../utils/common';
import { test as base } from './base';
import { installServerLoadReducers } from './serverLoad';

/**
 * The suite's role-page fixtures — the single place a signed-in page for one of
 * the pre-seeded roles is built.
 *
 * Prefer these over creating a user in `beforeAll` and logging it in. The role
 * accounts are created once by `e2e/auth.setup.ts` and their storage states are
 * reused by every worker, so a spec that takes `dataConsumerPage` costs one
 * browser context; a spec that mints its own user costs a signup, a login, a
 * page, and a teardown that has to delete the user again — per run, and often
 * per test. Reach for a bespoke user only when the test needs something the
 * seeded roles cannot express (a specific team, a custom policy, a rename), and
 * say so in a comment.
 *
 * `openmetadata-playwright/prefer-role-page-fixture` (warn) enforces this.
 *
 * Available roles and what `auth.setup.ts` grants them:
 *
 * | Fixture                 | Role                                        |
 * |-------------------------|---------------------------------------------|
 * | `adminPage`             | admin                                       |
 * | `dataConsumerPage`      | Data Consumer                               |
 * | `dataStewardPage`       | Data Steward                                |
 * | `ownerPage`             | owner of the seeded entities                |
 * | `editDescriptionPage`   | EditDescription only                        |
 * | `editTagsPage`          | EditTags only                               |
 * | `editGlossaryTermPage`  | EditGlossaryTerms only                      |
 * | `viewOnlyPage`          | view permissions, no edit                   |
 *
 * `e2e/fixtures/pages.ts` re-exports these and additionally aliases the built-in
 * `page` to `adminPage`; it holds no page-construction logic of its own.
 */
export type UserPages = {
  adminPage: Page;
  dataConsumerPage: Page;
  dataStewardPage: Page;
  ownerPage: Page;
  editDescriptionPage: Page;
  editTagsPage: Page;
  editGlossaryTermPage: Page;
  viewOnlyPage: Page;
};

export const ROLE_STORAGE_STATE = {
  adminPage: 'playwright/.auth/admin.json',
  dataConsumerPage: 'playwright/.auth/dataConsumer.json',
  dataStewardPage: 'playwright/.auth/dataSteward.json',
  ownerPage: 'playwright/.auth/owner.json',
  editDescriptionPage: 'playwright/.auth/editDescription.json',
  editTagsPage: 'playwright/.auth/editTags.json',
  editGlossaryTermPage: 'playwright/.auth/editGlossaryTerm.json',
  viewOnlyPage: 'playwright/.auth/viewOnly.json',
} as const satisfies Record<keyof UserPages, string>;

/**
 * These pages are built from `browser`, not from the `context` fixture, so they
 * bypass the `base.ts` override that installs the server-load reducers — hence
 * the explicit call here. `browser.newPage()` owns its context and closes it
 * with the page, so no separate context teardown is needed.
 *
 * Conditional reads are disabled so a fixture-based spec always receives fresh
 * entity state rather than a 304 against a stale ETag.
 */
const openRolePage = async (browser: Browser, storageState: string) => {
  const page = await browser.newPage({ storageState });
  await installServerLoadReducers(page.context());
  await disableEtagConditionalReads(page);

  return page;
};

const roleFixture =
  (role: keyof UserPages) =>
  async (
    { browser }: { browser: Browser },
    use: (page: Page) => Promise<void>
  ) => {
    const page = await openRolePage(browser, ROLE_STORAGE_STATE[role]);

    await use(page);
    await page.close();
  };

export const test = base.extend<UserPages>({
  adminPage: roleFixture('adminPage'),
  dataConsumerPage: roleFixture('dataConsumerPage'),
  dataStewardPage: roleFixture('dataStewardPage'),
  ownerPage: roleFixture('ownerPage'),
  editDescriptionPage: roleFixture('editDescriptionPage'),
  editTagsPage: roleFixture('editTagsPage'),
  editGlossaryTermPage: roleFixture('editGlossaryTermPage'),
  viewOnlyPage: roleFixture('viewOnlyPage'),
});

export { expect } from '@playwright/test';
