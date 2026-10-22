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
import { TableClass } from '../../../support/entity/TableClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  addUserToTeam,
  createMembersTeam,
  navigateToMembersPanel,
  openCreatedTeam,
  openOrganizationTeams,
  openTeamByLink,
  openTeamTab,
  waitForTeamPatch,
} from '../../../utils/aiProfile';
import { okJson } from '../../../utils/apiResponse';
import { uuid } from '../../../utils/common';
import { removeCustomPropertyViaApi } from '../../../utils/customProperty';
import { waitForOwnedAssetCount } from '../../../utils/polling';
import { expect, test } from '../../fixtures/pages';

// Ports the PORTABLE behaviours of e2e/Pages/Teams.spec.ts onto the AI-mode team
// detail (MembersTeamDetail), using core-ui selectors. Deferred (not ported):
// the full permission-role matrix (editOnly/dataConsumer/owner variants); the
// classic /settings routes and antd manage-button have no AI-profile equivalent.

let policy: PolicyClass;
let role: RolesClass;
let member: UserClass;
let createdTeams: TeamClass[] = [];

const makeTeam = (
  apiContext: APIRequestContext,
  overrides: Partial<ConstructorParameters<typeof TeamClass>[0]> = {}
): Promise<TeamClass> => createMembersTeam(apiContext, createdTeams, overrides);

test.describe('AI Profile Team Detail', () => {
  test.beforeAll(async ({ browser }) => {
    createdTeams = [];
    // The add-role/add-policy picker fetches one unsearched page of 100 and
    // filters it in the browser (MembersTeamDetail.handleStartAdd), and the
    // API returns them sorted ascending by name. On an instance with 100+
    // roles/policies a default `PW%...` fixture sorts past that window and the
    // option never renders, so prefix with '0' — digits sort before letters,
    // putting these fixtures on the first page whatever else exists.
    const policyId = uuid();
    const roleId = uuid();
    policy = new PolicyClass({
      name: `0PW%Policy-${policyId}`,
      displayName: `0PW Policy ${policyId}`,
      description: 'playwright for policy description',
    });
    role = new RolesClass({
      name: `0PW%Roles-${roleId}`,
      displayName: `0PW Roles ${roleId}`,
      description: 'playwright for roles description',
    });
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

  test('Should show a sub-team asset count from the team asset counts', async ({
    browser,
    page,
  }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const parent = await makeTeam(apiContext, { teamType: 'Department' });
    const child = await makeTeam(apiContext, {
      parents: [parent.responseData.id ?? ''],
    });
    const table = new TableClass();
    await table.create(apiContext);

    try {
      await table.setOwner(apiContext, {
        id: child.responseData.id ?? '',
        type: 'team',
      });
      // The sub-teams table reads the counts once, when the parent team opens.
      await waitForOwnedAssetCount(apiContext, child.responseData.id, 1);

      await openCreatedTeam(page, parent);

      await expect(
        page.getByTestId(`team-asset-count-${child.responseData.name}`)
      ).toHaveText('1');
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
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

  // Role and policy add/remove differ only by tab, testids, list endpoint and the
  // entity name — parameterize so the flow lives once.
  const addRemoveCases = [
    {
      label: 'role',
      tab: /Roles/,
      listUrl: '/api/v1/roles',
      addTestId: 'add-role',
      selectTestId: 'add-role-select',
      tableTestId: 'team-roles-table',
      getName: () => role.responseData.displayName,
    },
    {
      label: 'policy',
      tab: /Policies/,
      listUrl: '/api/v1/policies',
      addTestId: 'add-policy',
      selectTestId: 'add-policy-select',
      tableTestId: 'team-policies-table',
      getName: () => policy.responseData.displayName,
    },
  ];

  for (const entityCase of addRemoveCases) {
    test(`Should add and remove a ${entityCase.label} on the team`, async ({
      browser,
      page,
    }) => {
      const { apiContext } = await performAdminLogin(browser);
      const team = await makeTeam(apiContext);
      await openCreatedTeam(page, team);
      await openTeamTab(page, entityCase.tab);

      const name = entityCase.getName();
      const optionsList = page.waitForResponse((response) =>
        response.url().includes(entityCase.listUrl)
      );
      await page.getByTestId(entityCase.addTestId).click();
      await optionsList;

      const select = page.getByTestId(entityCase.selectTestId);
      const combobox = select.getByRole('combobox');
      await combobox.fill(name);

      // Commit with Enter on the focused option rather than clicking it.
      // Autocomplete drops a selection whenever `isLeavingRef` is set, and
      // that ref is armed by `onBlurCapture` for a microtask — so a click
      // whose actionability scroll blurs the input lands inside that window
      // and `onSelectionChange` returns early. The option looks clicked, but
      // no chip is added and Save stays disabled. Enter never leaves the
      // input, so it cannot trip the guard.
      // ArrowDown highlights the list's *first* option, so wait for the list
      // to have narrowed to the typed name before pressing it, rather than
      // acting on the unfiltered list still on screen.
      const options = page.getByRole('option');
      await expect(options.filter({ hasText: name })).toHaveCount(1);
      await expect(options).toHaveCount(1);
      await combobox.press('ArrowDown');
      await combobox.press('Enter');

      // Prove the value actually committed before relying on Save: a dropped
      // selection is otherwise only visible 60s later as a disabled button.
      await expect(select.getByText(name, { exact: true })).toBeVisible();

      // Close the autocomplete dropdown so it doesn't intercept the Save click.
      await page.keyboard.press('Escape');

      const addPatch = waitForTeamPatch(page, team.responseData.id ?? '');
      await page.getByRole('button', { name: 'Save' }).click();
      await addPatch;

      const entityButton = page
        .getByTestId(entityCase.tableTestId)
        .getByRole('button', { name });
      await expect(entityButton).toBeVisible();

      const removePatch = waitForTeamPatch(page, team.responseData.id ?? '');
      await page.getByTestId(`remove-${name}`).click();
      await page.getByTestId('delete-modal').waitFor();
      await page.getByTestId('confirm-button').click();
      await removePatch;

      await expect(entityButton).toBeHidden();
    });
  }

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
    const restored = await restoreResponse;

    expect(restored.ok()).toBeTruthy();
    await expect(page.getByTestId('team-detail')).toBeVisible();
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

  // The Custom Properties tab is native to MembersTeamDetail (it renders the
  // shared CustomPropertiesList): one pass covers that a property defined for
  // the `team` entity shows up in it and that a value set inline is saved.
  test('Should set a team custom property value inline from the Custom Properties tab', async ({
    browser,
    page,
  }) => {
    const { apiContext } = await performAdminLogin(browser);
    const propertyName = `pwTeamCp${uuid().replace(/-/g, '')}`;

    // Defined through the metadata type API rather than the settings UI: this
    // test is about the tab rendering the property, not about creating one.
    const teamType = await okJson<{ id: string }>(
      await apiContext.get('/api/v1/metadata/types/name/team'),
      'Read the team type'
    );
    const stringType = (
      await okJson<{ data: { id: string; name: string }[] }>(
        await apiContext.get('/api/v1/metadata/types?category=field&limit=50'),
        'Read the property types'
      )
    ).data.find((item) => item.name === 'string');

    await okJson(
      await apiContext.put(`/api/v1/metadata/types/${teamType.id}`, {
        data: {
          name: propertyName,
          description: propertyName,
          propertyType: { id: stringType?.id, type: 'type' },
        },
      }),
      'Add the team property'
    );

    try {
      const team = await makeTeam(apiContext);
      await openCreatedTeam(page, team);

      const tab = page.getByRole('tab', { name: /Custom Properties/ });

      await expect(tab).toBeVisible();

      await openTeamTab(page, /Custom Properties/);

      await expect(tab).toHaveAttribute('aria-selected', 'true');

      const row = page.getByTestId(`custom-property-row-${propertyName}`);

      await expect(row).toBeVisible();

      const value = `team value ${uuid()}`;
      await row.getByTestId(`edit-${propertyName}`).click();
      await row.getByRole('textbox').fill(value);
      const patch = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          new URL(response.url()).pathname ===
            `/api/v1/teams/${team.responseData.id}`
      );
      await row.getByTestId('inline-save-btn').click();

      expect((await patch).ok()).toBeTruthy();
      await expect(row).toContainText(value);

      const saved = await okJson<{ extension?: Record<string, unknown> }>(
        await apiContext.get(
          `/api/v1/teams/${team.responseData.id}?fields=extension`
        ),
        'Read the team extension'
      );

      expect(saved.extension?.[propertyName]).toBe(value);
    } finally {
      // Leaving the property behind would alter every later team's tab.
      await removeCustomPropertyViaApi(apiContext, 'team', propertyName);
    }
  });
});
