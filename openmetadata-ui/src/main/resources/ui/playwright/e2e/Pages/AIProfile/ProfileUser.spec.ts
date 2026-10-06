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

import { Domain } from '../../../support/domain/Domain';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  createTrackedUser,
  navigateToMembersPanel,
  openAdminsPanel,
  openAiProfile,
  openUserProfile,
  openUsersPanel,
  searchUserRow,
  waitForUserPatch,
} from '../../../utils/aiProfile';
import { uuid } from '../../../utils/common';
import { expect, test } from '../../fixtures/pages';

// Ports the PORTABLE behaviours of Users.spec.ts + UserDetails.spec.ts onto the
// AI-mode Users/Admins panels and the user profile view (ProfileDetailsPanel).
// Deferred/NOT-APPLICABLE (not ported): access-token gen/revoke/expiry;
// entity-detail & settings permission matrices; header persona-dropdown switcher;
// team/role/description editing on the profile and delete/restore from the
// profile (ProfileDetailsPanel does not expose these); the performance suite.

// Instantiated in beforeAll (not at module scope) so a second beforeAll run in the
// same worker rebuilds it, and created via the API (bypasses the UI intake form).
let persona: PersonaClass;
let domain: Domain;
let createdUsers: UserClass[] = [];

const trackUser = (
  apiContext: Parameters<UserClass['create']>[0]
): Promise<UserClass> => createTrackedUser(apiContext, createdUsers);

/** Open a user's profile view (#profile/<name>) from the Users list. */
test.describe('AI Profile Users', () => {
  test.beforeAll(async ({ browser }) => {
    createdUsers = [];
    persona = new PersonaClass();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await persona.create(apiContext);

    const domainId = uuid();
    domain = new Domain({
      name: `PW%domain.${domainId}`,
      displayName: `PW Domain ${domainId}`,
      description: 'playwright profile-user domain',
      domainType: 'Aggregate',
      fullyQualifiedName: `"PW%domain.${domainId}"`,
    });
    await domain.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    for (const user of createdUsers) {
      await user.delete(apiContext).catch(() => undefined);
    }
    await persona.delete(apiContext).catch(() => undefined);
    await domain?.delete(apiContext).catch(() => undefined);
    await afterAction();
  });

  test('Should create a user from the create-user form', async ({ page }) => {
    const email = `pw-user-${uuid()}@example.com`;

    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await page.getByTestId('add-user').click();
    await expect(page.getByTestId('create-user-container')).toBeVisible();

    await page.getByTestId('email').getByRole('textbox').fill(email);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('save-user').click();
    const created = await createResponse;

    expect(created.ok()).toBeTruthy();
    const body = await created.json();
    createdUsers.push(
      Object.assign(new UserClass(), { responseData: body }) as UserClass
    );
  });

  test('Should not allow creating a user with a duplicate email', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const existing = await trackUser(apiContext);

    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await page.getByTestId('add-user').click();
    await page
      .getByTestId('email')
      .getByRole('textbox')
      .fill(existing.data.email);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('save-user').click();
    const response = await createResponse;

    expect(response.status()).toBe(409);
    await expect(page.getByTestId('create-user-container')).toBeVisible();
  });

  test('Should create an admin from the admins panel', async ({ page }) => {
    const email = `pw-admin-${uuid()}@example.com`;

    await navigateToMembersPanel(page);
    await openAdminsPanel(page);
    await page.getByTestId('add-user').click();
    await expect(page.getByTestId('create-user-container')).toBeVisible();
    await expect(
      page.getByTestId('create-user-container').getByTestId('admin')
    ).toBeVisible();

    await page.getByTestId('email').getByRole('textbox').fill(email);

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('save-user').click();
    const created = await createResponse;

    expect(created.ok()).toBeTruthy();
    const body = await created.json();
    expect(body.isAdmin).toBe(true);
    createdUsers.push(
      Object.assign(new UserClass(), { responseData: body }) as UserClass
    );
  });

  test('Should soft delete and restore a user from the list', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const user = await trackUser(apiContext);
    const userName = user.responseData.name;

    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await searchUserRow(page, userName);

    const softDelete = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/users/${user.responseData.id}`) &&
        response.url().includes('hardDelete=false')
    );
    await page.getByTestId(`delete-user-btn-${userName}`).click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('soft-delete').click();
    await page.getByTestId('confirm-button').click();
    await softDelete;

    // Show deleted users, then restore.
    await page.getByTestId('show-deleted').click();
    await searchUserRow(page, userName);

    const restore = page.waitForResponse((response) =>
      response.url().includes('/api/v1/users/restore')
    );
    await page.getByTestId(`restore-user-btn-${userName}`).click();
    await page
      .getByTestId('restore-user-modal')
      .getByRole('button', { name: 'Restore' })
      .click();
    await restore;
  });

  test('Should hard delete a user from the list', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const user = await trackUser(apiContext);
    const userName = user.responseData.name;

    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await searchUserRow(page, userName);

    const hardDelete = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/users/${user.responseData.id}`) &&
        response.url().includes('hardDelete=true')
    );
    await page.getByTestId(`delete-user-btn-${userName}`).click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('hard-delete').click();
    await page.getByTestId('confirm-button').click();
    await hardDelete;
  });

  test('Should edit the preferred name on a user profile', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const user = await trackUser(apiContext);

    await openUserProfile(page, user.responseData.name);

    await page.getByTestId('preferred-name-edit').click();
    await page
      .getByTestId('preferred-name-input')
      .getByRole('textbox')
      .fill(`${user.responseData.name}-edited`);

    const patch = waitForUserPatch(page, user.responseData.id ?? '');
    await page.getByTestId('preferred-name-save').click();
    await patch;
  });

  test('Should add a persona on a user profile', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const user = await trackUser(apiContext);

    await openUserProfile(page, user.responseData.name);

    await page.getByTestId('persona-edit').click();
    await page.getByTestId('persona-multiselect').click();
    await page
      .getByRole('option', { name: persona.responseData.displayName })
      .click();

    const patch = waitForUserPatch(page, user.responseData.id ?? '');
    await page.getByTestId('persona-save').click();
    await patch;

    await expect(page.getByTestId('persona')).toContainText(
      persona.responseData.displayName
    );
  });

  test('Should assign a domain on a user profile', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const user = await trackUser(apiContext);

    await openUserProfile(page, user.responseData.name);

    await page.getByTestId('domains-edit').click();
    await page.getByTestId('domains-multiselect').click();
    await page
      .getByRole('option', { name: domain.responseData.displayName })
      .click();

    const patch = waitForUserPatch(page, user.responseData.id ?? '');
    await page.getByTestId('domains-save').click();
    await patch;
  });

  test('Non-admin can edit own name but not persona', async ({
    dataConsumerPage,
  }) => {
    // Non-admins cannot reach Members; open their own profile directly.
    await openAiProfile(dataConsumerPage);
    await expect(
      dataConsumerPage.getByTestId('profile-details-panel')
    ).toBeVisible();

    await expect(
      dataConsumerPage.getByTestId('preferred-name-edit')
    ).toBeVisible();
    await expect(dataConsumerPage.getByTestId('persona-edit')).toBeHidden();
  });
});
