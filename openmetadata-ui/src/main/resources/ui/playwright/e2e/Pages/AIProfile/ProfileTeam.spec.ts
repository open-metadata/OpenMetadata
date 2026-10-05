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

import { APIRequestContext } from '@playwright/test';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  addUserToTeam,
  navigateToMembersPanel,
  openCreatedTeam,
  openOrganizationTeams,
  openTeamByLink,
  openTeamTab,
  waitForTeamPatch,
} from '../../../utils/aiProfile';
import { uuid } from '../../../utils/common';
import { expect, test } from '../../fixtures/pages';

// Ports the PORTABLE behaviours of e2e/Pages/Teams.spec.ts onto the AI-mode team
// detail (MembersTeamDetail), using core-ui selectors. Deferred (not ported):
// the full permission-role matrix (editOnly/dataConsumer/owner variants); the
// classic /settings routes and antd manage-button have no AI-profile equivalent.

let policy: PolicyClass;
let role: RolesClass;
let member: UserClass;
let createdTeams: TeamClass[] = [];

const makeTeam = async (
  apiContext: APIRequestContext,
  overrides: Partial<ConstructorParameters<typeof TeamClass>[0]> = {}
): Promise<TeamClass> => {
  const id = uuid();
  const team = new TeamClass({
    name: `PW%team-${id}`,
    displayName: `PW Team ${id}`,
    description: 'playwright team detail',
    teamType: 'Group',
    users: [],
    policies: [],
    ...overrides,
  });
  await team.create(apiContext);
  createdTeams.push(team);

  return team;
};

test.describe('AI Profile Team Detail', () => {
  test.beforeAll(async ({ browser }) => {
    createdTeams = [];
    policy = new PolicyClass();
    role = new RolesClass();
    member = new UserClass();
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await member.create(apiContext);
    await policy.create(apiContext, [
      {
        name: `rule-${uuid()}`,
        resources: ['All'],
        operations: ['ViewAll'],
        effect: 'allow',
      },
    ]);
    await role.create(apiContext, [policy.responseData.name]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    for (const team of createdTeams) {
      await team.delete(apiContext, { recursive: true }).catch(() => undefined);
    }
    await role.delete(apiContext).catch(() => undefined);
    await policy.delete(apiContext).catch(() => undefined);
    await member.delete(apiContext).catch(() => undefined);
    await afterAction();
  });

  test('Should render the Organization team detail', async ({ page }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    await expect(page.getByTestId('team-info-widgets')).toBeVisible();
    await expect(page.getByTestId('team-user-count')).toBeVisible();
    await expect(page.getByTestId('sub-teams-table')).toBeVisible();
  });

  test('Should create a public team from the add-team form', async ({
    page,
  }) => {
    const id = uuid();
    const teamName = `PW%ui-team-${id}`;

    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await page.getByTestId('add-team').click();
    await expect(page.getByTestId('add-team-container')).toBeVisible();

    await page.getByTestId('name').getByRole('textbox').fill(teamName);
    await page
      .getByTestId('display-name')
      .getByRole('textbox')
      .fill(`PW UI Team ${id}`);
    // isJoinable defaults to true (public); toggling would make it private.

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/teams') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('submit-btn').click();
    const created = await createResponse;

    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.isJoinable).toBe(true);

    // Track for cleanup by its real id.
    const createdTeam = new TeamClass();
    createdTeam.responseData = body;
    createdTeams.push(createdTeam);
  });

  test('Should search teams in the Organization sub-teams table', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);

    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    const searchInput = page
      .getByTestId('team-detail')
      .getByTestId('searchbar');
    await searchInput.fill(team.responseData.displayName);
    await expect(
      page.getByTestId(`team-link-${team.responseData.name}`)
    ).toBeVisible();

    await searchInput.fill('non-existent-team-xyz');
    await expect(
      page.getByTestId(`team-link-${team.responseData.name}`)
    ).toBeHidden();
  });

  test('Should rename a team inline', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);

    await page.getByTestId('edit-display-name').click();
    await page
      .getByTestId('display-name-input')
      .getByRole('textbox')
      .fill(`${team.data.displayName}-edited`);

    const patch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByTestId('save-display-name').click();
    await patch;

    await expect(page.getByTestId('display-name-input')).toBeHidden();
  });

  test('Should edit the team email', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);

    await page.getByTestId('edit-email').click();
    await page
      .getByTestId('email-input')
      .getByRole('textbox')
      .fill(`team-${uuid()}@example.com`);

    const patch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByTestId('save-email').click();
    await patch;
  });

  test('Should edit the team description', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);

    await page.getByTestId('edit-description-btn').click();
    await page
      .getByTestId('editor')
      .locator('[contenteditable="true"]')
      .fill('Updated team description');

    const patch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByTestId('save-description').click();
    await patch;
  });

  test('Should add and remove a user from the team', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);

    const teamUsers = page.waitForResponse((response) =>
      response.url().includes('/api/v1/users?')
    );
    await openTeamTab(page, /Users/);
    await teamUsers;

    await addUserToTeam(
      page,
      team.responseData.id ?? '',
      member.responseData.displayName
    );
    await expect(
      page.getByTestId('team-users-table').getByText(member.responseData.name)
    ).toBeVisible();

    const removeResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/teams/${team.responseData.id}`) &&
        ['PATCH', 'DELETE'].includes(response.request().method())
    );
    await page.getByTestId(`remove-user-${member.responseData.name}`).click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('confirm-button').click();
    await removeResponse;

    await expect(
      page.getByTestId('team-users-table').getByText(member.responseData.name)
    ).toBeHidden();
  });

  test('Should render and update the team user count', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext, {
      users: [member.responseData.id].filter(Boolean) as string[],
    });
    await openCreatedTeam(page, team);

    await expect(page.getByTestId('team-user-count')).toContainText('1');
  });

  test('Should toggle show-deleted child teams', async ({ page }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    const deletedFetch = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/teams?') &&
        response.url().includes('include=deleted')
    );
    await page.getByTestId('show-deleted-teams').click();
    await deletedFetch;
  });

  test('Should add and remove a role on the team', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);
    await openTeamTab(page, /Roles/);

    const roleName = role.responseData.displayName;
    const rolesList = page.waitForResponse((response) =>
      response.url().includes('/api/v1/roles')
    );
    await page.getByTestId('add-role').click();
    await rolesList;

    await page
      .getByTestId('add-role-select')
      .getByRole('combobox')
      .fill(roleName);
    await page.getByRole('option', { name: roleName }).click();
    // Close the autocomplete dropdown so it doesn't intercept the Save click.
    await page.keyboard.press('Escape');

    const addPatch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByRole('button', { name: 'Save' }).click();
    await addPatch;

    const roleButton = page
      .getByTestId('team-roles-table')
      .getByRole('button', { name: roleName });
    await expect(roleButton).toBeVisible();

    const removePatch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByTestId(`remove-${roleName}`).click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('confirm-button').click();
    await removePatch;

    await expect(roleButton).toBeHidden();
  });

  test('Should add and remove a policy on the team', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);
    await openTeamTab(page, /Policies/);

    const policyName = policy.responseData.displayName;
    const policiesList = page.waitForResponse((response) =>
      response.url().includes('/api/v1/policies')
    );
    await page.getByTestId('add-policy').click();
    await policiesList;

    await page
      .getByTestId('add-policy-select')
      .getByRole('combobox')
      .fill(policyName);
    await page.getByRole('option', { name: policyName }).click();
    // Close the autocomplete dropdown so it doesn't intercept the Save click.
    await page.keyboard.press('Escape');

    const addPatch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByRole('button', { name: 'Save' }).click();
    await addPatch;

    const policyButton = page
      .getByTestId('team-policies-table')
      .getByRole('button', { name: policyName });
    await expect(policyButton).toBeVisible();

    const removePatch = waitForTeamPatch(page, team.responseData.id ?? '');
    await page.getByTestId(`remove-${policyName}`).click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('confirm-button').click();
    await removePatch;

    await expect(policyButton).toBeHidden();
  });

  test('Should navigate to a child team and back via breadcrumb', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);

    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await openTeamByLink(page, team.responseData.name);

    await page
      .getByTestId('profile-content-header')
      .getByRole('link', { name: 'Organization' })
      .click();
    await expect(page.getByTestId('team-detail')).toBeVisible();
  });

  test('Should join and leave a public team', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    // Public group team the admin is not a member of.
    const team = await makeTeam(apiContext, { isJoinable: true });
    await openCreatedTeam(page, team);

    // Joining patches the current (admin) user's teams, not the team entity.
    const joinResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/users/') &&
        response.request().method() === 'PATCH'
    );
    await page
      .getByTestId('profile-content-header')
      .getByTestId('join-team-button')
      .click();
    await joinResponse;

    const leaveButton = page
      .getByTestId('profile-content-header')
      .getByTestId('leave-team-button');
    await expect(leaveButton).toBeVisible();

    // Leaving removes the user from the team: DELETE /teams/<id>/users/<userId>.
    const leaveResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(`/api/v1/teams/${team.responseData.id}/users/`) &&
        response.request().method() === 'DELETE'
    );
    await leaveButton.click();
    await leaveResponse;

    await expect(
      page.getByTestId('profile-content-header').getByTestId('join-team-button')
    ).toBeVisible();
  });

  test('Should soft delete and restore a team', async ({ browser, page }) => {
    const { apiContext } = await performAdminLogin(browser);
    const team = await makeTeam(apiContext);
    await openCreatedTeam(page, team);

    await page
      .getByTestId('profile-content-header')
      .getByRole('button', { name: 'Open menu' })
      .click();
    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/teams/${team.responseData.id}`) &&
        response.request().method() === 'DELETE'
    );
    await page.getByTestId('delete-team').click();
    await page.getByTestId('delete-modal').waitFor();
    await page.getByTestId('soft-delete').click();
    await page.getByTestId('confirm-button').click();
    await deleteResponse;

    // Re-open with deleted teams shown, restore it.
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    const deletedFetch = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/teams?') &&
        response.url().includes('include=deleted')
    );
    await page.getByTestId('show-deleted-teams').click();
    await deletedFetch;
    await openTeamByLink(page, team.responseData.name);

    const restoreResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/teams/restore')
    );
    await page
      .getByTestId('profile-content-header')
      .getByRole('button', { name: 'Open menu' })
      .click();
    await page.getByTestId('restore-team').click();
    await restoreResponse;
  });

  test('Should export the Organization team to CSV', async ({ page }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    await page
      .getByTestId('profile-content-header')
      .getByRole('button', { name: 'Open menu' })
      .click();

    // A CSV-only export skips the type-picker modal and triggers the async job
    // directly (see EntityExportModalProvider `isCsvOnly`).
    const exportResponse = page.waitForResponse((response) =>
      response.url().includes('exportAsync')
    );
    await page.getByTestId('export-team').click();
    const exported = await exportResponse;

    expect(exported.ok()).toBeTruthy();
  });

  test('Should open the team import form and preview an uploaded CSV', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    // Department teams expose header import-team and can hold child teams.
    const team = await makeTeam(apiContext, { teamType: 'Department' });
    await openCreatedTeam(page, team);

    await page
      .getByTestId('profile-content-header')
      .getByRole('button', { name: 'Open menu' })
      .click();
    await page.getByTestId('import-team').click();
    await expect(page.getByTestId('members-import-container')).toBeVisible();

    const csv =
      'name*,displayName,description,teamType*,parents*,Owner,isJoinable,defaultRoles,policies\n' +
      `PW%imp-${uuid()},Imported Team,desc,Group,${
        team.responseData.name
      },,true,,`;

    const previewResponse = page.waitForResponse((response) =>
      response.url().includes('/import')
    );
    await page.getByTestId('members-import-input').setInputFiles({
      name: 'teams.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await page.getByTestId('next-preview').click();
    await previewResponse;

    await expect(page.getByTestId('confirm-import')).toBeVisible();
  });
});
