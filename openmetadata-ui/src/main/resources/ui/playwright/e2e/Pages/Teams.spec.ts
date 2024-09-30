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
import test, { expect } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { addMultiOwner } from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';
import {
  createTeam,
  hardDeleteTeam,
  searchTeam,
  softDeleteTeam,
} from '../../utils/team';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const user = new UserClass();
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

test.describe('Teams Page', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit Home Page', async ({ page }) => {
    await redirectToHomePage(page);
    const fetchOrganizationResponse = page.waitForResponse(
      '/api/v1/teams?parentTeam=Organization&include=all&fields=**'
    );
    await settingClick(page, GlobalSettingOptions.TEAMS);
    await fetchOrganizationResponse;
  });

  test('Teams Page Flow', async ({ page }) => {
    await test.step('Create a new team', async () => {
      await settingClick(page, GlobalSettingOptions.TEAMS);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="add-team"]');

      await page.getByTestId('add-team').click();

      const newTeamData = await createTeam(page);

      teamDetails = {
        ...teamDetails,
        ...newTeamData,
      };
    });

    await test.step('Add owner to created team', async () => {
      const getTeamResponse = page.waitForResponse(`/api/v1/teams/name/*?*`);
      await page.getByRole('link', { name: teamDetails.displayName }).click();
      await getTeamResponse;

      await addMultiOwner({
        page,
        ownerNames: [user.getUserName()],
        activatorBtnDataTestId: 'edit-owner',
        endpoint: EntityTypeEndpoint.Teams,
        type: 'Users',
      });
    });

    await test.step('Update email of created team', async () => {
      // Edit email
      await page.locator('[data-testid="edit-email"]').click();
      await page
        .locator('[data-testid="email-input"]')
        .fill(teamDetails.updatedEmail);

      const saveEditEmailResponse = page.waitForResponse('/api/v1/teams/*');
      await page.locator('[data-testid="save-edit-email"]').click();
      await saveEditEmailResponse;

      // Reload the page
      await page.reload();

      // Check for updated email

      await expect(page.locator('[data-testid="email-value"]')).toContainText(
        teamDetails.updatedEmail
      );
    });

    await test.step('Add user to created team', async () => {
      // Navigate to users tab and add new user
      await page.locator('[data-testid="users"]').click();

      const fetchUsersResponse = page.waitForResponse(
        '/api/v1/users?limit=25&isBot=false'
      );
      await page.locator('[data-testid="add-new-user"]').click();
      await fetchUsersResponse;

      // Search and select the user
      await page
        .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
        .fill(user.getUserName());

      await page
        .locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
        .click();

      await expect(
        page.locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
      ).toHaveClass(/active/);

      const updateTeamResponse = page.waitForResponse('/api/v1/teams/*');

      // Update the team with the new user
      await page.locator('[data-testid="selectable-list-update-btn"]').click();
      await updateTeamResponse;

      // Verify the user is added to the team

      await expect(
        page.locator(`[data-testid="${userName.toLowerCase()}"]`)
      ).toBeVisible();
    });

    await test.step('Remove added user from created team', async () => {
      await page.locator('[data-testid="users"]').click();

      // Click on add new user
      const fetchUsersResponse = page.waitForResponse(
        '/api/v1/users?limit=25&isBot=false'
      );
      await page.locator('[data-testid="add-new-user"]').click();
      await fetchUsersResponse;

      // Select the user to remove
      await page
        .locator(
          `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
        )
        .click();

      const updateTeamResponse = page.waitForResponse('/api/v1/teams/*');
      await page.locator('[data-testid="selectable-list-update-btn"]').click();
      await updateTeamResponse;

      // Verify the user is removed from the team
      await expect(
        page.locator(`[data-testid="${userName.toLowerCase()}"]`)
      ).not.toBeVisible();
    });

    await test.step('Join team should work properly', async () => {
      await page.locator('[data-testid="users"]').click();

      // Click on join teams button
      await page.locator('[data-testid="join-teams"]').click();

      await toastNotification(page, 'Team joined successfully!');

      // Verify leave team button exists
      await expect(
        page.locator('[data-testid="leave-team-button"]')
      ).toBeVisible();
    });

    await test.step('Update display name for created team', async () => {
      // Click on edit display name
      await page.locator('[data-testid="edit-team-name"]').click();

      // Enter the updated team name
      await page
        .locator('[data-testid="team-name-input"]')
        .fill(teamDetails.updatedName);

      // Save the updated display name
      const patchTeamResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/teams/') &&
          response.request().method() === 'PATCH'
      );
      await page.locator('[data-testid="saveAssociatedTag"]').click();
      await patchTeamResponse;

      // Validate the updated display name
      await expect(page.locator('[data-testid="team-heading"]')).toHaveText(
        teamDetails.updatedName
      );

      await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
        teamDetails.updatedName
      );
    });

    await test.step('Update description for created team', async () => {
      // Validate the updated display name
      await expect(page.locator('[data-testid="team-heading"]')).toContainText(
        teamDetails.updatedName
      );

      await expect(page.locator('[data-testid="inactive-link"]')).toContainText(
        teamDetails.updatedName
      );

      await page.locator('[role="tablist"] [data-icon="right"]').click();

      // Click on edit description button
      await page.locator('[data-testid="edit-description"]').click();
      await page.waitForLoadState('domcontentloaded');

      // Entering updated description
      const updatedDescription = 'This is an updated team description';

      await page.click(descriptionBox);
      await page.keyboard.type(updatedDescription);

      const patchDescriptionResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/teams/') &&
          response.request().method() === 'PATCH'
      );
      await page.locator('[data-testid="save"]').click();
      await patchDescriptionResponse;

      // Validating the updated description
      await expect(
        page.locator('[data-testid="asset-description-container"] p')
      ).toContainText(updatedDescription);
    });

    await test.step('Leave team flow should work properly', async () => {
      await expect(page.locator('[data-testid="team-heading"]')).toContainText(
        teamDetails?.updatedName ?? ''
      );

      // Click on Leave team
      await page.locator('[data-testid="leave-team-button"]').click();

      const leaveTeamResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/users/') &&
          response.request().method() === 'PATCH'
      );
      // Click on confirm button
      await page.locator('.ant-modal-footer').getByText('Confirm').click();
      await leaveTeamResponse;

      // Verify that the "Join Teams" button is now visible
      await expect(page.locator('[data-testid="join-teams"]')).toBeVisible();
    });

    await test.step('Soft Delete Team', async () => {
      await softDeleteTeam(page);

      const fetchOrganizationResponse = page.waitForResponse(
        '/api/v1/teams?*parentTeam=Organization*fields=*'
      );
      await settingClick(page, GlobalSettingOptions.TEAMS);
      await fetchOrganizationResponse;

      // Check if the table does not contain the team name
      await expect(page.locator('table')).not.toContainText(
        teamDetails?.displayName ?? ''
      );

      // Click on the show deleted button
      await page.locator('[data-testid="show-deleted"]').click();

      // Check if the table contains the team name and click on it
      await expect(
        page.getByRole('link', { name: teamDetails?.updatedName })
      ).toBeVisible();
    });

    await test.step('Hard Delete Team', async () => {
      const fetchTeamResponse = page.waitForResponse(`/api/v1/teams/name/*`);

      await page.getByRole('link', { name: teamDetails.updatedName }).click();

      await fetchTeamResponse;

      // Verify the team heading contains the updated name
      await expect(page.locator('[data-testid="team-heading"]')).toContainText(
        teamDetails?.updatedName ?? ''
      );

      await hardDeleteTeam(page);

      // Validate the deleted team
      await expect(
        page.getByRole('link', { name: teamDetails?.updatedName })
      ).not.toBeVisible();
    });
  });

  test('Create a new public team', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    await page.waitForSelector('[data-testid="add-team"]');

    await page.getByTestId('add-team').click();

    const publicTeam = await createTeam(page, true);

    await page.getByRole('link', { name: publicTeam.displayName }).click();

    await page
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(page.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await page.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(page);
  });

  test('Create a new private team', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    await page.waitForSelector('[data-testid="add-team"]');

    await page.getByTestId('add-team').click();

    const publicTeam = await createTeam(page);

    await page.getByRole('link', { name: publicTeam.displayName }).click();

    await page
      .getByTestId('team-details-collapse')
      .getByTestId('manage-button')
      .click();

    await expect(page.locator('button[role="switch"]')).toHaveAttribute(
      'aria-checked',
      'false'
    );

    await page.click('body'); // Equivalent to clicking outside

    await hardDeleteTeam(page);
  });

  test('Permanently deleting a team without soft deleting should work properly', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const team = new TeamClass();
    await team.create(apiContext);
    await settingClick(page, GlobalSettingOptions.TEAMS);
    await page.waitForLoadState('networkidle');
    const getTeamResponse = page.waitForResponse(`/api/v1/teams/name/*?*`);
    await page
      .getByRole('link', { name: team.responseData?.['displayName'] })
      .click();
    await getTeamResponse;

    await expect(page.locator('[data-testid="team-heading"]')).toContainText(
      team.responseData?.['displayName']
    );

    await hardDeleteTeam(page);
    await afterAction();
  });

  test('Team search should work properly', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
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
      await settingClick(page, GlobalSettingOptions.TEAMS);
      await page.waitForLoadState('networkidle');

      for (const team of [team1, team2, team3]) {
        await searchTeam(page, team.responseData?.['displayName']);
      }
    } finally {
      await team1.delete(apiContext);
      await team2.delete(apiContext);
      await team3.delete(apiContext);
      await afterAction();
    }
  });

  test('Export team', async ({ page }) => {
    const { apiContext } = await getApiContext(page);
    const id = uuid();
    const team = new TeamClass({
      name: `pw%team.export-${id}`,
      displayName: `pw team export ${id}`,
      description: 'playwright team export description',
      teamType: 'Department',
    });

    await team.create(apiContext);

    try {
      await settingClick(page, GlobalSettingOptions.TEAMS);
      await page.waitForLoadState('networkidle');

      await searchTeam(page, team.responseData?.['displayName']);

      await page
        .locator(`[data-row-key="${team.data.name}"]`)
        .getByRole('link')
        .click();

      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('team-heading')).toHaveText(
        team.data.displayName
      );

      const downloadPromise = page.waitForEvent('download');

      await page.getByTestId('manage-button').click();
      await page.getByTestId('export-details-container').click();
      await page.fill('#fileName', team.data.name);
      await page.click('#submit-button');
      const download = await downloadPromise;
      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    } finally {
      await team.delete(apiContext);
    }
  });
});
