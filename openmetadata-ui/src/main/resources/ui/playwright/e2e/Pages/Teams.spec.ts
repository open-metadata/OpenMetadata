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
import { expect, Page, test as base } from '@playwright/test';
import { EDIT_USER_FOR_TEAM_RULES } from '../../constant/permission';
import { GlobalSettingOptions } from '../../constant/settings';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { addMultiOwner } from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';
import {
  addTeamOwnerToEntity,
  addUserInTeam,
  createTeam,
  hardDeleteTeam,
  searchTeam,
  softDeleteTeam,
  verifyAssetsInTeamsPage,
} from '../../utils/team';

const adminUser = new UserClass();
const editOnlyUser = new UserClass(); // this user will have only editUser permission in team
let team = new TeamClass();
const team2 = new TeamClass();
const policy = new PolicyClass();
const role = new RolesClass();
const user = new UserClass();
const user2 = new UserClass();
const userName = user.data.email.split('@')[0];

let teamDetails: {
  name?: string;
  displayName?: string;
  email?: string;
  description?: string;
  updatedName: string;
  teamType: string;
  updatedEmail: string;
} = {
  updatedName: `updated-pw%team-${uuid()}`,
  teamType: 'Group',
  updatedEmail: `pwteamUpdated${uuid()}@example.com`,
};

const test = base.extend<{
  adminPage: Page;
  editOnlyUserPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  editOnlyUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editOnlyUser.login(page);
    await use(page);
    await page.close();
  },
});

test.describe('Teams Page', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ adminPage }) => {
    await redirectToHomePage(adminPage);
    const fetchOrganizationResponse = adminPage.waitForResponse(
      '/api/v1/teams?parentTeam=Organization&include=all&fields=**'
    );
    await settingClick(adminPage, GlobalSettingOptions.TEAMS);
    await fetchOrganizationResponse;
  });

  test('Teams Page Flow', async ({ adminPage }) => {
    await test.step('Create a new team', async () => {
      await settingClick(adminPage, GlobalSettingOptions.TEAMS);
      await adminPage.waitForLoadState('networkidle');

      await adminPage.waitForSelector('[data-testid="add-team"]');

      await adminPage.getByTestId('add-team').click();

      const newTeamData = await createTeam(adminPage);

      teamDetails = {
        ...teamDetails,
        ...newTeamData,
      };
    });

    await test.step('Add owner to created team', async () => {
      const getTeamResponse = adminPage.waitForResponse(
        `/api/v1/teams/name/*?*`
      );
      await adminPage
        .getByRole('link', { name: teamDetails.displayName })
        .click();
      await getTeamResponse;

      await addMultiOwner({
        page: adminPage,
        ownerNames: [user.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.Teams,
        type: 'Users',
      });
    });

    await test.step('Update email of created team', async () => {
      // Edit email
      await adminPage.locator('[data-testid="edit-email"]').click();
      await adminPage
        .locator('[data-testid="email-input"]')
        .fill(teamDetails.updatedEmail);

      const saveEditEmailResponse =
        adminPage.waitForResponse('/api/v1/teams/*');
      await adminPage.locator('[data-testid="save-edit-email"]').click();
      await saveEditEmailResponse;

      // Reload the page
      await adminPage.reload();

      // Check for updated email

      await expect(
        adminPage.locator('[data-testid="email-value"]')
      ).toContainText(teamDetails.updatedEmail);
    });

    await test.step('Add user to created team', async () => {
      // Navigate to users tab and add new user
      await adminPage.locator('[data-testid="users"]').click();

      const fetchUsersResponse = adminPage.waitForResponse(
        '/api/v1/users?limit=25&isBot=false'
      );
      await adminPage.locator('[data-testid="add-new-user"]').click();
      await fetchUsersResponse;

      // Search and select the user
      await adminPage
        .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
        .fill(user.getUserName());

      await adminPage
        .locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
        .click();

      await expect(
        adminPage.locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
      ).toHaveClass(/active/);

      const updateTeamResponse = adminPage.waitForResponse('/api/v1/users*');

      // Update the team with the new user
      await adminPage
        .locator('[data-testid="selectable-list-update-btn"]')
        .click();
      await updateTeamResponse;

      // Verify the user is added to the team

      await expect(
        adminPage.locator(`[data-testid="${userName.toLowerCase()}"]`)
      ).toBeVisible();
    });

    await test.step('Remove added user from created team', async () => {
      await adminPage.locator('[data-testid="users"]').click();

      // Click on add new user
      const fetchUsersResponse = adminPage.waitForResponse(
        '/api/v1/users?limit=25&isBot=false'
      );
      await adminPage.locator('[data-testid="add-new-user"]').click();
      await fetchUsersResponse;

      // Select the user to remove
      await adminPage
        .locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
        .click();

      const updateTeamResponse = adminPage.waitForResponse('/api/v1/users*');
      await adminPage
        .locator('[data-testid="selectable-list-update-btn"]')
        .click();
      await updateTeamResponse;

      // Verify the user is removed from the team
      await expect(
        adminPage.locator(`[data-testid="${userName.toLowerCase()}"]`)
      ).not.toBeVisible();
    });

    await test.step('Join team should work properly', async () => {
      await adminPage.locator('[data-testid="users"]').click();

      // Click on join teams button
      await adminPage.locator('[data-testid="join-teams"]').click();

      await toastNotification(adminPage, 'Team joined successfully!');

      // Verify leave team button exists
      await expect(
        adminPage.locator('[data-testid="leave-team-button"]')
      ).toBeVisible();
    });

    await test.step('Update display name for created team', async () => {
      // Click on edit display name
      await adminPage.locator('[data-testid="edit-team-name"]').click();

      // Enter the updated team name
      await adminPage
        .locator('[data-testid="team-name-input"]')
        .fill(teamDetails.updatedName);

      // Save the updated display name
      const patchTeamResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/teams/') &&
          response.request().method() === 'PATCH'
      );
      await adminPage.locator('[data-testid="saveAssociatedTag"]').click();
      await patchTeamResponse;

      // Validate the updated display name
      await expect(
        adminPage.locator('[data-testid="team-heading"]')
      ).toHaveText(teamDetails.updatedName);

      await expect(
        adminPage.locator('[data-testid="inactive-link"]')
      ).toContainText(teamDetails.updatedName);
    });

    await test.step('Update description for created team', async () => {
      // Validate the updated display name
      await expect(
        adminPage.locator('[data-testid="team-heading"]')
      ).toContainText(teamDetails.updatedName);

      await expect(
        adminPage.locator('[data-testid="inactive-link"]')
      ).toContainText(teamDetails.updatedName);

      await adminPage.locator('[role="tablist"] [data-icon="right"]').click();

      // Click on edit description button
      await adminPage.locator('[data-testid="edit-description"]').click();
      await adminPage.waitForLoadState('domcontentloaded');

      // Entering updated description
      const updatedDescription = 'This is an updated team description';

      await adminPage.click(descriptionBox);
      await adminPage.keyboard.type(updatedDescription);

      const patchDescriptionResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/teams/') &&
          response.request().method() === 'PATCH'
      );
      await adminPage.locator('[data-testid="save"]').click();
      await patchDescriptionResponse;

      // Validating the updated description
      await expect(
        adminPage.locator('[data-testid="asset-description-container"] p')
      ).toContainText(updatedDescription);
    });

    await test.step('Leave team flow should work properly', async () => {
      await expect(
        adminPage.locator('[data-testid="team-heading"]')
      ).toContainText(teamDetails?.updatedName ?? '');

      // Click on Leave team
      await adminPage.locator('[data-testid="leave-team-button"]').click();

      const leaveTeamResponse = adminPage.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/users/') &&
          response.request().method() === 'PATCH'
      );
      // Click on confirm button
      await adminPage.locator('.ant-modal-footer').getByText('Confirm').click();
      await leaveTeamResponse;

      // Verify that the "Join Teams" button is now visible
      await expect(
        adminPage.locator('[data-testid="join-teams"]')
      ).toBeVisible();
    });

    await test.step('Soft Delete Team', async () => {
      await softDeleteTeam(adminPage);

      const fetchOrganizationResponse = adminPage.waitForResponse(
        '/api/v1/teams?*parentTeam=Organization*fields=*'
      );
      await settingClick(adminPage, GlobalSettingOptions.TEAMS);
      await fetchOrganizationResponse;

      // Check if the table does not contain the team name
      await expect(adminPage.locator('table')).not.toContainText(
        teamDetails?.displayName ?? ''
      );

      // Click on the show deleted button
      await adminPage.locator('[data-testid="show-deleted"]').click();

      // Check if the table contains the team name and click on it
      await expect(
        adminPage.getByRole('link', { name: teamDetails?.updatedName })
      ).toBeVisible();
    });

    await test.step('Hard Delete Team', async () => {
      const fetchTeamResponse =
        adminPage.waitForResponse(`/api/v1/teams/name/*`);

      await adminPage
        .getByRole('link', { name: teamDetails.updatedName })
        .click();

      await fetchTeamResponse;

      // Verify the team heading contains the updated name
      await expect(
        adminPage.locator('[data-testid="team-heading"]')
      ).toContainText(teamDetails?.updatedName ?? '');

      await hardDeleteTeam(adminPage);

      // Validate the deleted team
      await expect(
        adminPage.getByRole('link', { name: teamDetails?.updatedName })
      ).not.toBeVisible();
    });
  });

  test('Create a new public team', async ({ adminPage }) => {
    await settingClick(adminPage, GlobalSettingOptions.TEAMS);

    await adminPage.waitForSelector('[data-testid="add-team"]');

    await adminPage.getByTestId('add-team').click();

    const publicTeam = await createTeam(adminPage, true);

    await adminPage.getByRole('link', { name: publicTeam.displayName }).click();

    await adminPage
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(adminPage.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await adminPage.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(adminPage);
  });

  test('Create a new private team', async ({ adminPage }) => {
    await settingClick(adminPage, GlobalSettingOptions.TEAMS);

    await adminPage.waitForSelector('[data-testid="add-team"]');

    await adminPage.getByTestId('add-team').click();

    const publicTeam = await createTeam(adminPage);

    await adminPage.getByRole('link', { name: publicTeam.displayName }).click();

    await adminPage
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(adminPage.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await adminPage.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(adminPage);
  });

  test('Permanently deleting a team without soft deleting should work properly', async ({
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const team = new TeamClass();
    await team.create(apiContext);
    await settingClick(adminPage, GlobalSettingOptions.TEAMS);
    await adminPage.waitForLoadState('networkidle');
    const getTeamResponse = adminPage.waitForResponse(`/api/v1/teams/name/*?*`);
    await adminPage
      .getByRole('link', { name: team.responseData?.['displayName'] })
      .click();
    await getTeamResponse;

    await expect(
      adminPage.locator('[data-testid="team-heading"]')
    ).toContainText(team.responseData?.['displayName']);

    await hardDeleteTeam(adminPage);
    await afterAction();
  });

  test('Team search should work properly', async ({ adminPage }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const id = uuid();
    const team1 = new TeamClass();
    const team2 = new TeamClass({
      name: `pw team space-${id}`,
      displayName: `pw team space ${id}`,
      description: 'playwright team with space description',
      teamType: 'Group',
    });
    const team3 = new TeamClass({
      name: `pw.team.dot-${id}`,
      displayName: `pw.team.dot ${id}`,
      description: 'playwright team with dot description',
      teamType: 'Group',
    });

    await team1.create(apiContext);
    await team2.create(apiContext);
    await team3.create(apiContext);

    try {
      await settingClick(adminPage, GlobalSettingOptions.TEAMS);
      await adminPage.waitForLoadState('networkidle');

      for (const team of [team1, team2, team3]) {
        await searchTeam(adminPage, team.responseData?.['displayName']);
      }

      // Should not find the organization team and show errorPlaceholder
      await searchTeam(adminPage, 'Organization', true);
    } finally {
      await team1.delete(apiContext);
      await team2.delete(apiContext);
      await team3.delete(apiContext);
      await afterAction();
    }
  });

  test('Export team', async ({ adminPage }) => {
    const { apiContext } = await getApiContext(adminPage);
    const id = uuid();
    const team = new TeamClass({
      name: `pw%team.export-${id}`,
      displayName: `pw team export ${id}`,
      description: 'playwright team export description',
      teamType: 'Department',
    });

    await team.create(apiContext);

    try {
      await settingClick(adminPage, GlobalSettingOptions.TEAMS);
      await adminPage.waitForLoadState('networkidle');

      await searchTeam(adminPage, team.responseData?.['displayName']);

      await adminPage
        .locator(`[data-row-key="${team.data.name}"]`)
        .getByRole('link')
        .click();

      await adminPage.waitForLoadState('networkidle');

      await expect(adminPage.getByTestId('team-heading')).toHaveText(
        team.data.displayName
      );

      const downloadPromise = adminPage.waitForEvent('download');

      await adminPage.getByTestId('manage-button').click();
      await adminPage.getByTestId('export-details-container').click();
      await adminPage.fill('#fileName', team.data.name);
      await adminPage.click('#submit-button');
      const download = await downloadPromise;
      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    } finally {
      await team.delete(apiContext);
    }
  });

  test('Team assets should', async ({ adminPage }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const id = uuid();

    const table1 = new TableClass();
    const table2 = new TableClass();
    const table3 = new TableClass();
    const table4 = new TableClass();

    const team1 = new TeamClass({
      name: `pw%percent-${id}`,
      displayName: `pw team percent ${id}`,
      description: 'playwright team with percent description',
      teamType: 'Group',
    });
    const team2 = new TeamClass({
      name: `pw&amp-${id}`,
      displayName: `pw team ampersand ${id}`,
      description: 'playwright team with ampersand description',
      teamType: 'Group',
    });
    const team3 = new TeamClass({
      name: `pw.team.dot-${id}`,
      displayName: `pw.team.dot ${id}`,
      description: 'playwright team with dot description',
      teamType: 'Group',
    });
    const team4 = new TeamClass({
      name: `pw team space-${id}`,
      displayName: `pw team space ${id}`,
      description: 'playwright team with space description',
      teamType: 'Group',
    });

    await table1.create(apiContext);
    await table2.create(apiContext);
    await table3.create(apiContext);
    await table4.create(apiContext);
    await team1.create(apiContext);
    await team2.create(apiContext);
    await team3.create(apiContext);
    await team4.create(apiContext);

    try {
      await addTeamOwnerToEntity(adminPage, table1, team1);
      await addTeamOwnerToEntity(adminPage, table2, team2);
      await addTeamOwnerToEntity(adminPage, table3, team3);
      await addTeamOwnerToEntity(adminPage, table4, team4);

      await verifyAssetsInTeamsPage(adminPage, table1, team1, 1);
      await verifyAssetsInTeamsPage(adminPage, table2, team2, 1);
      await verifyAssetsInTeamsPage(adminPage, table3, team3, 1);
      await verifyAssetsInTeamsPage(adminPage, table4, team4, 1);
    } finally {
      await table1.delete(apiContext);
      await table2.delete(apiContext);
      await table3.delete(apiContext);
      await table4.delete(apiContext);
      await team1.delete(apiContext);
      await team2.delete(apiContext);
      await team3.delete(apiContext);
      await team4.delete(apiContext);
      await afterAction();
    }
  });

  test('Delete a user from the table', async ({ adminPage }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const id = uuid();

    const table1 = new TableClass();

    const team1 = new TeamClass({
      name: `pw%percent-${id}`,
      displayName: `pw team percent ${id}`,
      description: 'playwright team with percent description',
      teamType: 'Group',
    });

    await table1.create(apiContext);
    await team1.create(apiContext);

    await addTeamOwnerToEntity(adminPage, table1, team1);
    await verifyAssetsInTeamsPage(adminPage, table1, team1, 1);

    // Navigate to users tab and add new user
    await adminPage.locator('[data-testid="users"]').click();

    const fetchUsersResponse = adminPage.waitForResponse(
      '/api/v1/users?limit=25&isBot=false'
    );
    await adminPage.locator('[data-testid="add-new-user"]').click();
    await fetchUsersResponse;

    // Search and select the user
    await adminPage
      .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
      .fill(user.getUserName());

    await adminPage
      .locator(
        `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
      )
      .click();

    await expect(
      adminPage.locator(
        `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
      )
    ).toHaveClass(/active/);

    const updateTeamResponse = adminPage.waitForResponse('/api/v1/users*');

    // Update the team with the new user
    await adminPage
      .locator('[data-testid="selectable-list-update-btn"]')
      .click();
    await updateTeamResponse;

    // Verify the user is added to the team
    await expect(
      adminPage.locator(`[data-row-key="${userName.toLowerCase()}"]`)
    ).toBeVisible();

    await adminPage
      .locator(`[data-row-key="${userName.toLowerCase()}"]`)
      .getByTestId('remove-user-btn')
      .click();

    const updatedTeamResponse = adminPage.waitForResponse('api/v1/users*');

    await adminPage.getByRole('button', { name: 'confirm' }).click();
    await updatedTeamResponse;

    await expect(
      adminPage.locator(`[data-row-key="${userName.toLowerCase()}"]`)
    ).not.toBeVisible();

    await afterAction();
  });
});

test.describe('Teams Page with EditUser Permission', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await editOnlyUser.create(apiContext);

    const id = uuid();
    await policy.create(apiContext, EDIT_USER_FOR_TEAM_RULES);
    await role.create(apiContext, [policy.responseData.name]);

    team = new TeamClass({
      name: `PW%edit-user-team-${id}`,
      displayName: `PW Edit User Team ${id}`,
      description: 'playwright edit user team description',
      teamType: 'Group',
      users: [editOnlyUser.responseData.id],
      defaultRoles: role.responseData.id ? [role.responseData.id] : [],
    });
    await team.create(apiContext);
    await team2.create(apiContext);
    await user.create(apiContext);
    await user2.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.delete(apiContext);
    await user2.delete(apiContext);
    await editOnlyUser.delete(apiContext);
    await team.delete(apiContext);
    await team2.delete(apiContext);
    await policy.delete(apiContext);
    await role.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ editOnlyUserPage }) => {
    await redirectToHomePage(editOnlyUserPage);
    const fetchOrganizationResponse = editOnlyUserPage.waitForResponse(
      '/api/v1/teams?parentTeam=Organization&include=all&fields=**'
    );
    await settingClick(editOnlyUserPage, GlobalSettingOptions.TEAMS);
    await fetchOrganizationResponse;

    await team2.visitTeamPage(editOnlyUserPage);
  });

  test('Add and Remove User for Team', async ({ editOnlyUserPage }) => {
    await test.step('Add user in Team for the placeholder', async () => {
      await addUserInTeam(editOnlyUserPage, user);
    });

    await test.step('Add user in Team for the header manage area', async () => {
      await addUserInTeam(editOnlyUserPage, user2);
    });

    await test.step('Remove user from Team', async () => {
      await editOnlyUserPage
        .getByRole('row', {
          name: `${user.data.firstName.slice(0, 1).toUpperCase()} ${
            user.data.firstName
          }.`,
        })
        .getByTestId('remove-user-btn')
        .click();

      const userResponse = editOnlyUserPage.waitForResponse(
        '/api/v1/users?fields=**'
      );
      await editOnlyUserPage.getByRole('button', { name: 'Confirm' }).click();
      await userResponse;

      await expect(
        editOnlyUserPage.locator(`[data-testid="${userName.toLowerCase()}"]`)
      ).not.toBeVisible();
    });
  });
});
