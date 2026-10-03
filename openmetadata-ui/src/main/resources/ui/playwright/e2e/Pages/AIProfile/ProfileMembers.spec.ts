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

import { expect, test } from '../../../support/fixtures/base';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import {
  navigateToMembersPanel,
  openAdminsPanel,
  openOnlineUsersPanel,
  openOrganizationTeams,
  openTeamByLink,
  openTeamTab,
  openUsersPanel,
  searchUserRow,
} from '../../../utils/aiProfile';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';

const clickMembersBreadcrumb = async (
  page: Parameters<typeof navigateToMembersPanel>[0]
): Promise<void> => {
  // The header breadcrumb is a react-aria link; scope to the header so it cannot
  // collide with the "Members" sidebar nav button.
  await page
    .getByTestId('profile-content-header')
    .getByRole('link', { name: 'Members' })
    .click();
  await expect(page.getByTestId('members-landing')).toBeVisible();
};

test.describe('AI Profile Members - navigation & basics', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction } = await performAdminLogin(browser);
    await afterAction();
  });

  test('Should render Members landing with 4 cards', async ({ page }) => {
    await navigateToMembersPanel(page);

    await expect(page.getByTestId('members-card-teams')).toBeVisible();
    await expect(page.getByTestId('members-card-users')).toBeVisible();
    await expect(page.getByTestId('members-card-admins')).toBeVisible();
    await expect(page.getByTestId('members-card-online-users')).toBeVisible();
  });

  test('Should navigate to each sub-page from the landing cards', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await expect(page.getByTestId('team-info-widgets')).toBeVisible();

    await navigateToMembersPanel(page);
    await openUsersPanel(page);

    await navigateToMembersPanel(page);
    await openAdminsPanel(page);

    await navigateToMembersPanel(page);
    await openOnlineUsersPanel(page);
  });

  test('Should navigate back to landing via breadcrumb from Teams', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await clickMembersBreadcrumb(page);
  });

  test('Should navigate back to landing via breadcrumb from Users', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await clickMembersBreadcrumb(page);
  });

  test('Should open and cancel the create-user form from Users', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openUsersPanel(page);

    await page.getByTestId('add-user').click();
    await expect(page.getByTestId('create-user-container')).toBeVisible();

    await page.getByTestId('cancel-user').click();
    await expect(page.getByTestId('users-list-container')).toBeVisible();
  });

  test('Should open and cancel the create-admin form from Admins', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openAdminsPanel(page);

    await page.getByTestId('add-user').click();
    await expect(page.getByTestId('create-user-container')).toBeVisible();
    await expect(page.getByTestId('admin')).toBeVisible();

    await page.getByTestId('cancel-user').click();
    await expect(page.getByTestId('users-list-container')).toBeVisible();
  });

  test('Should open and cancel the add-team form from Teams', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    await page.getByTestId('add-team').click();
    await expect(page.getByTestId('add-team-container')).toBeVisible();

    await page.getByTestId('cancel-btn').click();
    await expect(page.getByTestId('team-detail')).toBeVisible();
  });

  test('Should refetch online users when the time window changes', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOnlineUsersPanel(page);
    await expect(page.getByTestId('online-users-table')).toBeVisible();

    const windowChangeResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/users/online')
    );
    await page.getByTestId('time-window-select').click();
    await page.getByRole('option', { name: 'Last 7 days' }).click();
    await windowChangeResponse;

    await expect(page.getByTestId('online-users-table')).toBeVisible();
  });
});

test.describe('AI Profile Members - cross-surface navigation', () => {
  const policy = new PolicyClass();
  const role = new RolesClass();
  const regularUser = new UserClass();
  const adminUser = new UserClass();
  let team: TeamClass;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await regularUser.create(apiContext);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await policy.create(apiContext, [
      {
        name: `rule-${uuid()}`,
        resources: ['All'],
        operations: ['ViewAll'],
        effect: 'allow',
      },
    ]);
    await role.create(apiContext, [policy.responseData.name]);

    await regularUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: { id: role.responseData.id, type: 'role' },
        },
      ],
    });

    const id = uuid();
    team = new TeamClass({
      name: `PW%team-nav-${id}`,
      displayName: `PW Team Nav ${id}`,
      description: 'playwright members navigation',
      teamType: 'Group',
      users: [regularUser.responseData.id, adminUser.responseData.id].filter(
        Boolean
      ) as string[],
      defaultRoles: [role.responseData.id].filter(Boolean) as string[],
      policies: [policy.responseData.id].filter(Boolean) as string[],
    });
    await team.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await team?.delete(apiContext, { recursive: true }).catch(() => undefined);
    await role.delete(apiContext).catch(() => undefined);
    await policy.delete(apiContext).catch(() => undefined);
    await regularUser.delete(apiContext).catch(() => undefined);
    await adminUser.delete(apiContext).catch(() => undefined);
    await afterAction();
  });

  test('Should navigate from team detail to a user profile', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);

    const teamUsersResponse = page.waitForResponse((response) =>
      response.url().includes('/api/v1/users?')
    );
    await openTeamByLink(page, team.responseData.name);
    await teamUsersResponse;

    const userResponse = page.waitForResponse((response) =>
      response
        .url()
        .includes(
          `/api/v1/users/name/${encodeURIComponent(
            regularUser.responseData.name
          )}`
        )
    );
    await page
      .getByTestId('team-users-table')
      .getByTestId(regularUser.responseData.name)
      .click();
    await userResponse;

    await expect(page.getByTestId('profile-content-header')).toContainText(
      regularUser.responseData.displayName
    );
  });

  test('Should navigate from team detail to a role detail', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await openTeamByLink(page, team.responseData.name);
    await openTeamTab(page, /Roles/);

    await page
      .getByTestId('team-roles-table')
      .getByRole('button', { name: role.responseData.displayName })
      .click();

    await expect(page.getByTestId('role-detail-container')).toBeVisible();
  });

  test('Should navigate from team detail to a policy detail', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await openTeamByLink(page, team.responseData.name);
    await openTeamTab(page, /Policies/);

    await page
      .getByTestId('team-policies-table')
      .getByRole('button', { name: policy.responseData.displayName })
      .click();

    await expect(page.getByTestId('policy-detail-container')).toBeVisible();
  });

  test('Should show an asset count badge on the Assets tab', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openOrganizationTeams(page);
    await openTeamByLink(page, team.responseData.name);

    await expect(
      page.getByRole('tab', { name: /Assets \(\d+\)/ })
    ).toBeVisible();
  });

  test('Should navigate from the users page to a team detail', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await searchUserRow(page, regularUser.responseData.name);

    const teamResponse = page.waitForResponse((response) =>
      response
        .url()
        .includes(
          `/api/v1/teams/name/${encodeURIComponent(team.responseData.name)}`
        )
    );
    await page
      .getByTestId('users-list-table')
      .getByRole('link', { name: team.responseData.displayName })
      .click();
    await teamResponse;

    await expect(page.getByTestId('team-detail')).toBeVisible();
  });

  test('Should navigate from the users page to a role detail', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openUsersPanel(page);
    await searchUserRow(page, regularUser.responseData.name);

    await page
      .getByTestId('users-list-table')
      .getByRole('link', { name: role.responseData.displayName })
      .click();

    await expect(page.getByTestId('role-detail-container')).toBeVisible();
  });

  test('Should navigate from the admins page to a team detail', async ({
    page,
  }) => {
    await navigateToMembersPanel(page);
    await openAdminsPanel(page);
    await searchUserRow(page, adminUser.responseData.name);

    const teamResponse = page.waitForResponse((response) =>
      response
        .url()
        .includes(
          `/api/v1/teams/name/${encodeURIComponent(team.responseData.name)}`
        )
    );
    await page
      .getByTestId('users-list-table')
      .getByRole('link', { name: team.responseData.displayName })
      .click();
    await teamResponse;

    await expect(page.getByTestId('team-detail')).toBeVisible();
  });
});
