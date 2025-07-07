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
import { expect, test } from '@playwright/test';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  confirmationDragAndDropTeam,
  dragAndDropElement,
  openDragDropDropdown,
} from '../../utils/dragDrop';
import { settingClick } from '../../utils/sidebar';
import { addTeamHierarchy, hardDeleteTeam } from '../../utils/team';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

const commonTeamDetails = {
  username: 'Aaron Johnson',
  userId: 'aaron_johnson0',
  assetname: 'dim_address',
  email: 'team1@gmail.com',
  updatedEmail: 'updatedemail@gmail.com',
};

const teamNameGroup = `team-ct-test-${uuid()}`;
const teamNameBusiness = `team-ct-test-${uuid()}`;
const teamNameDivision = `team-ct-test-${uuid()}`;
const teamNameDepartment = `team-ct-test-${uuid()}`;

const TEAM_TYPE_BY_NAME = {
  [teamNameBusiness]: 'BusinessUnit',
  [teamNameDivision]: 'Division',
  [teamNameDepartment]: 'Department',
  [teamNameGroup]: 'Group',
};

const teams = [teamNameBusiness, teamNameDivision, teamNameDepartment];

const DRAG_AND_DROP_TEAM_DETAILS = [
  {
    name: teamNameBusiness,
    updatedName: `${teamNameBusiness}-updated`,
    teamType: 'BusinessUnit',
    description: `This is ${teamNameBusiness} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameDivision,
    updatedName: `${teamNameDivision}-updated`,
    teamType: 'Division',
    description: `This is ${teamNameDivision} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameDepartment,
    updatedName: `${teamNameDepartment}-updated`,
    teamType: 'Department',
    description: `This is ${teamNameDepartment} description`,
    ...commonTeamDetails,
  },
  {
    name: teamNameGroup,
    updatedName: `${teamNameGroup}-updated`,
    teamType: 'Group',
    description: `This is ${teamNameGroup} description`,
    ...commonTeamDetails,
  },
];

test.describe('Teams drag and drop should work properly', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);

    const getOrganizationResponse = page.waitForResponse(
      '/api/v1/teams/name/*'
    );
    const permissionResponse = page.waitForResponse(
      '/api/v1/permissions/team/name/*'
    );

    await settingClick(page, GlobalSettingOptions.TEAMS);
    await permissionResponse;
    await getOrganizationResponse;
  });

  test('Add teams in hierarchy', async ({ page }) => {
    for (const teamDetails of DRAG_AND_DROP_TEAM_DETAILS) {
      await addTeamHierarchy(page, teamDetails);
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.locator(`[data-row-key="${teamDetails.name}"]`)
      ).toContainText(teamDetails.description);
    }
  });

  test('Should fail when drop team type is Group', async ({ page }) => {
    for (const team of teams) {
      await dragAndDropElement(page, team, teamNameGroup);
      await toastNotification(
        page,
        `You cannot move to this team as Team Type ${TEAM_TYPE_BY_NAME[team]} can't be Group children`
      );
    }
  });

  test('Should fail when droppable team type is Department', async ({
    page,
  }) => {
    const teams = [teamNameBusiness, teamNameDivision];

    for (const team of teams) {
      await dragAndDropElement(page, team, teamNameDepartment);
      await toastNotification(
        page,
        `You cannot move to this team as Team Type ${TEAM_TYPE_BY_NAME[team]} can't be Department children`
      );
    }
  });

  test('Should fail when draggable team type is BusinessUnit and droppable team type is Division', async ({
    page,
  }) => {
    await dragAndDropElement(page, teamNameBusiness, teamNameDivision);
    await toastNotification(
      page,
      "You cannot move to this team as Team Type BusinessUnit can't be Division children"
    );
  });

  for (const [index, droppableTeamName] of teams.entries()) {
    test(`Should drag and drop on ${TEAM_TYPE_BY_NAME[droppableTeamName]} team type`, async ({
      page,
    }) => {
      // Nested team will be shown once anything is moved under it
      if (index !== 0) {
        await openDragDropDropdown(page, teams[index - 1]);
      }

      await dragAndDropElement(page, teamNameGroup, droppableTeamName);
      await confirmationDragAndDropTeam(page, teamNameGroup, droppableTeamName);

      // Verify the team is moved under the business team
      await openDragDropDropdown(page, droppableTeamName);
      const movedTeam = page.locator(
        `.ant-table-row-level-1[data-row-key="${teamNameGroup}"]`
      );

      await expect(movedTeam).toBeVisible();
    });
  }

  test(`Should drag and drop team on table level`, async ({ page }) => {
    // Open department team dropdown as it is moved under it from last test
    await openDragDropDropdown(page, teamNameDepartment);

    await dragAndDropElement(
      page,
      teamNameGroup,
      '.ant-table-thead > tr',
      true
    );
    await confirmationDragAndDropTeam(page, teamNameGroup, 'Organization');

    // Verify the team is moved under the table level
    const movedTeam = page.locator(
      `.ant-table-row-level-0[data-row-key="${teamNameGroup}"]`
    );
    await movedTeam.scrollIntoViewIfNeeded();

    await expect(movedTeam).toBeVisible();
  });

  test('Delete Teams', async ({ page }) => {
    for (const teamName of [
      teamNameBusiness,
      teamNameDivision,
      teamNameDepartment,
      teamNameGroup,
    ]) {
      const getTeamResponse = page.waitForResponse(
        `/api/v1/teams/name/${teamName}*`
      );

      await page.getByRole('link', { name: teamName }).click();
      await getTeamResponse;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await hardDeleteTeam(page);

      // Validate the deleted team
      await expect(
        page.getByRole('cell', { name: teamName })
      ).not.toBeVisible();
    }
  });
});
