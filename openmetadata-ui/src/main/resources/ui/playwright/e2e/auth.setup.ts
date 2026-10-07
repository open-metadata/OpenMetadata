/*
 *  Copyright 2024 Collate.
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
import { Page, test as setup } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import {
  EDIT_DESCRIPTION_RULE,
  EDIT_GLOSSARY_TERM_RULE,
  EDIT_TAGS_RULE,
  VIEW_ONLY_RULE,
} from '../constant/permission';
import { AdminClass } from '../support/user/AdminClass';
import { UserClass } from '../support/user/UserClass';
import { settleAll } from '../utils/apiResponse';
import {
  disableEtagConditionalReads,
  getApiContext,
  getToken,
  uuid,
} from '../utils/common';
import { loginAsAdmin } from '../utils/initialSetup';

/**
 * Opt every E2E session out of client-side conditional (If-None-Match) reads.
 *
 * The server ETag only covers the entity's version/updatedAt, so it does not change for
 * relationship-only or child mutations (followers, votes, customMetrics, testSuite). A refetch
 * racing such a mutation can be answered "not modified" and render a stale body, which surfaces
 * as flaky assertions across the suite. Setting the flag here persists it into storageState, so
 * every spec in both OpenMetadata and Collate inherits it without a per-test helper.
 */
const adminFile = 'playwright/.auth/admin.json';
const dataConsumerFile = 'playwright/.auth/dataConsumer.json';
const dataStewardFile = 'playwright/.auth/dataSteward.json';
const editDescriptionFile = 'playwright/.auth/editDescription.json';
const editTagsFile = 'playwright/.auth/editTags.json';
const editGlossaryTermFile = 'playwright/.auth/editGlossaryTerm.json';
const viewOnlyFile = 'playwright/.auth/viewOnly.json';
const ownerFile = 'playwright/.auth/owner.json';
const adminApiTokenFile = 'playwright/.auth/admin-api-token.json';

const userUUID = uuid();

// Create and setup all users
const dataConsumer = new UserClass({
  firstName: 'PW ',
  lastName: `DataConsumer ${userUUID}`,
  email: `pw-data-consumer-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const dataSteward = new UserClass({
  firstName: 'PW ',
  lastName: `DataSteward ${userUUID}`,
  email: `pw-data-steward-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editDescriptionUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditDescription ${userUUID}`,
  email: `pw-edit-description-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editTagsUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditTags ${userUUID}`,
  email: `pw-edit-tags-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editGlossaryTermUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditGlossaryTerm ${userUUID}`,
  email: `pw-edit-glossary-term-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const viewOnlyUser = new UserClass({
  firstName: 'PW ',
  lastName: `ViewOnly ${userUUID}`,
  email: `pw-view-only-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const ownerUser = new UserClass({
  firstName: 'PW ',
  lastName: `Owner ${userUUID}`,
  email: `pw-owner-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});

/**
 * Capture a signed-in context's storage state, and fail loudly if it is missing
 * the session cookie.
 *
 * The app authenticates from the token in IndexedDB, so a state without
 * `OM_SESSION` still drives every test locally — which is exactly what makes its
 * absence easy to ship. CI's `.github/scripts/rotate_playwright_auth_state.py`
 * rotates the cached preseeded state by replacing that cookie, and without it
 * every shard dies in "Setup Openmetadata Test Environment" with
 * "Playwright auth state has no OM_SESSION cookie" — a failure that names
 * neither the test nor the sign-in path that dropped it.
 */
const saveStorageState = async (page: Page, path: string) => {
  const state = await page.context().storageState({ path, indexedDB: true });

  if (!state.cookies.some((cookie) => cookie.name === 'OM_SESSION')) {
    throw new Error(
      `Refusing to write ${path}: the signed-in context has no OM_SESSION cookie, so CI's auth-state rotation would fail. The login request must go through the browser context (page.context().request), not a standalone request context, or the Set-Cookie is discarded.`
    );
  }

  return state;
};

setup('authenticate all users', async ({ browser }) => {
  // With PW_PRESEEDED_STATE this project has no dependents, so it is scheduled
  // alongside the shard's own specs and competes with them for workers. Eight
  // user creations and nine logins do not fit the old 2-minute budget under
  // that contention.
  setup.setTimeout(180 * 1000);
  // Create separate pages for each user
  const [
    adminPage,
    dataConsumerPage,
    dataStewardPage,
    editDescriptionPage,
    editTagsPage,
    editGlossaryTermPage,
    viewOnlyPage,
    ownerPage,
  ] = await Promise.all([
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
    browser.newPage(),
  ]);

  try {
    // Create admin page and context
    const admin = new AdminClass();

    await loginAsAdmin(adminPage, admin);

    // Create a new page to sign the admin in after token expiry is set to 4
    // hours. This is done to avoid logging out the user to get the new token.
    //
    // Every sign-in here goes through `UserClass.signIn()` — one POST to
    // /api/v1/auth/login, then the token written where the app reads it —
    // rather than driving the sign-in form eight times. The storage state this
    // captures is what every worker in every lane reuses, so the only thing
    // that matters is that the session is real; how it was established is not
    // part of the fixture's contract. `loginAsAdmin` above already took this
    // path. A spec that is testing the sign-in *form* calls
    // `signInThroughForm(page, user)` from utils/formSignIn instead.
    const newAdminPage = await browser.newPage();
    await admin.signIn(newAdminPage);

    await newAdminPage.waitForURL(
      (url) => url.pathname === '/' || url.pathname === '/my-data',
      { waitUntil: 'domcontentloaded' }
    );

    await mkdir('playwright/.auth', { recursive: true });
    await writeFile(
      adminApiTokenFile,
      JSON.stringify({ token: await getToken(newAdminPage) }),
      { mode: 0o600 }
    );

    const { apiContext, afterAction } = await getApiContext(adminPage);

    await settleAll([
      dataConsumer.create(apiContext, false),
      dataSteward.create(apiContext, false),
      editDescriptionUser.create(apiContext, false),
      editTagsUser.create(apiContext, false),
      editGlossaryTermUser.create(apiContext, false),
      viewOnlyUser.create(apiContext, false),
      ownerUser.create(apiContext, false),
    ]);

    await settleAll([
      dataConsumer.setDataConsumerRole(apiContext),
      dataSteward.setDataStewardRole(apiContext),
      editDescriptionUser.setCustomRulePolicy(
        apiContext,
        EDIT_DESCRIPTION_RULE,
        'PW%Edit-Description'
      ),
      editTagsUser.setCustomRulePolicy(
        apiContext,
        EDIT_TAGS_RULE,
        'PW%Edit-Tags'
      ),
      editGlossaryTermUser.setCustomRulePolicy(
        apiContext,
        EDIT_GLOSSARY_TERM_RULE,
        'PW%Edit-Glossary-Term'
      ),
      viewOnlyUser.setCustomRulePolicy(
        apiContext,
        VIEW_ONLY_RULE,
        'PW%View-Only'
      ),
      ownerUser.setDataConsumerRole(apiContext),
    ]);

    // Wait for indexedDB databases to be available
    await adminPage.waitForFunction(() => indexedDB.databases());

    // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for auth state to be persisted to indexedDB
    await adminPage.waitForTimeout(2000);

    // Save admin state
    await disableEtagConditionalReads(newAdminPage);
    await saveStorageState(newAdminPage, adminFile);

    // Save states for each user sequentially to avoid file operation conflicts
    await dataConsumer.signIn(dataConsumerPage);
    await disableEtagConditionalReads(dataConsumerPage);
    await saveStorageState(dataConsumerPage, dataConsumerFile);

    await dataSteward.signIn(dataStewardPage);
    await disableEtagConditionalReads(dataStewardPage);
    await saveStorageState(dataStewardPage, dataStewardFile);

    await editDescriptionUser.signIn(editDescriptionPage);
    await disableEtagConditionalReads(editDescriptionPage);
    await saveStorageState(editDescriptionPage, editDescriptionFile);

    await editTagsUser.signIn(editTagsPage);
    await disableEtagConditionalReads(editTagsPage);
    await saveStorageState(editTagsPage, editTagsFile);

    await editGlossaryTermUser.signIn(editGlossaryTermPage);
    await disableEtagConditionalReads(editGlossaryTermPage);
    await saveStorageState(editGlossaryTermPage, editGlossaryTermFile);

    await viewOnlyUser.signIn(viewOnlyPage);
    await disableEtagConditionalReads(viewOnlyPage);
    await saveStorageState(viewOnlyPage, viewOnlyFile);

    await ownerUser.signIn(ownerPage);
    await disableEtagConditionalReads(ownerPage);
    await saveStorageState(ownerPage, ownerFile);

    await afterAction();

    if (newAdminPage) {
      await newAdminPage.close();
    }
  } catch (error) {
    console.error('Error during authentication setup:', error);

    throw error;
  } finally {
    // Close pages sequentially to avoid conflicts
    if (dataConsumerPage) {
      await dataConsumerPage.close();
    }
    if (dataStewardPage) {
      await dataStewardPage.close();
    }
    if (editDescriptionPage) {
      await editDescriptionPage.close();
    }
    if (editTagsPage) {
      await editTagsPage.close();
    }
    if (editGlossaryTermPage) {
      await editGlossaryTermPage.close();
    }
    if (viewOnlyPage) {
      await viewOnlyPage.close();
    }
    if (ownerPage) {
      await ownerPage.close();
    }
  }
});
