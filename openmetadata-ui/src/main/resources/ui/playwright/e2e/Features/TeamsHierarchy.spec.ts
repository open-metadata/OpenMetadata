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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { expect, test } from '../../support/fixtures/base';
import { TeamClass } from '../../support/team/TeamClass';
import {
  getApiContext,
  redirectToHomePage,
  uuid,
  visitOwnProfilePage,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import {
  addTeamHierarchy,
  getNewTeamDetails,
  searchTeam,
  visitTeamsPage,
} from '../../utils/team';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.configure({ mode: 'serial' });

const businessTeamName = `business-${uuid()}`;
const divisionTeamName = `division-${uuid()}`;
const departmentTeamName = `department-${uuid()}`;
const groupTeamName = `group-${uuid()}`;
const teamNames = [
  businessTeamName,
  divisionTeamName,
  departmentTeamName,
  groupTeamName,
];

test.describe(
  'Add Nested Teams and Test TeamsSelectable',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await visitTeamsPage(page);
    });

    test('Add teams in hierarchy', async ({ page }) => {
      for (const [index, teamName] of teamNames.entries()) {
        const getOrganizationResponse = page.waitForResponse(
          '/api/v1/teams/name/*'
        );
        await addTeamHierarchy(page, getNewTeamDetails(teamName), index, true);
        await getOrganizationResponse;

        // Asserting the added values
        const permissionResponse = page.waitForResponse(
          '/api/v1/permissions/team/name/*'
        );
        await page.getByRole('link', { name: teamName }).click();
        await permissionResponse;
      }
    });

    test('Check hierarchy in Add User page', async ({ page }) => {
      // Clicking on users
      await settingClick(page, GlobalSettingOptions.USERS);

      // Click on add user button
      const teamHierarchyResponse = page.waitForResponse(
        '/api/v1/teams/hierarchy?isJoinable=false'
      );
      await page.locator('[data-testid="add-user"]').click();
      await teamHierarchyResponse;

      // Enter team name
      await page.click('[data-testid="team-select"]');
      await page.keyboard.type(businessTeamName);

      for (const teamName of teamNames) {
        const dropdown = page.locator('.ant-tree-select-dropdown');

        await expect(dropdown).toContainText(teamName);
        await expect(dropdown.getByText(teamName)).toHaveCount(1);
      }

      for (const teamName of teamNames) {
        await expect(page.getByTestId('team-select')).toBeVisible();

        await page.click('[data-testid="team-select"]');
        await page.keyboard.type(teamName);

        await expect(page.locator('.ant-tree-select-dropdown')).toContainText(
          teamName
        );
      }
    });

    test('Only Group teams are selectable in Add User team dropdown', async ({
      page,
    }) => {
      const childlessDepartmentName = `pw-childless-department-${uuid()}`;
      const childlessDepartment = new TeamClass({
        name: childlessDepartmentName,
        displayName: childlessDepartmentName,
        description: 'playwright childless department team',
        teamType: 'Department',
      });
      const { apiContext, afterAction } = await getApiContext(page);
      await childlessDepartment.create(apiContext);

      try {
        await settingClick(page, GlobalSettingOptions.USERS);

        const teamHierarchyResponse = page.waitForResponse(
          '/api/v1/teams/hierarchy?isJoinable=false'
        );
        await page.locator('[data-testid="add-user"]').click();
        await teamHierarchyResponse;

        const teamSelect = page.getByTestId('team-select');
        const teamSelectInput = teamSelect.getByRole('combobox');
        const dropdown = page.locator('.ant-tree-select-dropdown');
        const selectedTeamChips = teamSelect.locator(
          '.ant-select-selection-item'
        );

        await test.step(
          'Non-Group team with children is visible but not selectable',
          async () => {
            await teamSelect.click();
            await teamSelectInput.fill(departmentTeamName);

            const departmentOption = dropdown.getByText(departmentTeamName);

            await expect(departmentOption).toBeVisible();

            await departmentOption.click();

            await expect(
              selectedTeamChips.filter({ hasText: departmentTeamName })
            ).toHaveCount(0);
          }
        );

        await test.step(
          'Non-Group team without children is hidden',
          async () => {
            await teamSelectInput.fill(childlessDepartmentName);

            await expect(dropdown).not.toContainText(childlessDepartmentName);
          }
        );

        await test.step('Group team is selectable', async () => {
          await teamSelectInput.fill(groupTeamName);

          const groupOption = dropdown.getByText(groupTeamName);

          await expect(groupOption).toBeVisible();

          await groupOption.click();

          await expect(
            selectedTeamChips.filter({ hasText: groupTeamName })
          ).toHaveCount(1);
        });
      } finally {
        await childlessDepartment.delete(apiContext);
        await afterAction();
      }
    });

    test('Only Group teams are selectable in user profile teams edit', async ({
      page,
    }) => {
      const childlessDivisionName = `pw-childless-division-${uuid()}`;
      const childlessDivision = new TeamClass({
        name: childlessDivisionName,
        displayName: childlessDivisionName,
        description: 'playwright childless division team',
        teamType: 'Division',
      });
      const { apiContext, afterAction } = await getApiContext(page);
      await childlessDivision.create(apiContext);

      try {
        await visitOwnProfilePage(page);

        const teamHierarchyResponse = page.waitForResponse(
          '/api/v1/teams/hierarchy?isJoinable=false'
        );
        await page.getByTestId('edit-teams-button').click();
        await teamHierarchyResponse;

        const popover = page.getByTestId('profile-teams-edit-popover');

        await expect(popover).toBeVisible();

        const teamSelect = popover.getByTestId('team-select');
        const teamSelectInput = teamSelect.getByRole('combobox');
        const dropdown = page.locator('.teams-custom-dropdown-class');
        // Chips truncate long labels, so selection is asserted on the tree
        // node's selected state where the full team name is rendered.
        const selectedTreeNodes = dropdown.locator(
          '.ant-select-tree-treenode-selected'
        );

        await test.step(
          'Non-Group team with children is visible but not selectable',
          async () => {
            await teamSelectInput.fill(departmentTeamName);

            const departmentOption = dropdown.getByText(departmentTeamName);

            await expect(departmentOption).toBeVisible();

            await departmentOption.click();

            await expect(
              selectedTreeNodes.filter({ hasText: departmentTeamName })
            ).toHaveCount(0);
          }
        );

        await test.step(
          'Non-Group team without children is hidden',
          async () => {
            await teamSelectInput.fill(childlessDivisionName);

            await expect(dropdown).not.toContainText(childlessDivisionName);
          }
        );

        await test.step('Group team is selectable', async () => {
          await teamSelectInput.fill(groupTeamName);

          const groupOption = dropdown.getByText(groupTeamName);

          await expect(groupOption).toBeVisible();

          await groupOption.click();

          await expect(
            selectedTreeNodes.filter({ hasText: groupTeamName })
          ).toHaveCount(1);
        });

        // Close without saving so the admin's team memberships stay untouched
        await page.getByTestId('teams-edit-close-btn').click();

        await expect(popover).not.toBeVisible();
      } finally {
        await childlessDivision.delete(apiContext);
        await afterAction();
      }
    });

    test('Delete Parent Team', async ({ page }) => {
      await page.getByRole('link', { name: businessTeamName }).click();

      await page.click('[data-testid="manage-button"]');

      await page.click('[data-testid="delete-button-title"]');

      await page.click(`[data-testid="hard-delete"]`);

      const deleteResponse = page.waitForResponse(
        `/api/v1/teams/*?hardDelete=true&recursive=true`
      );

      await page.click('[data-testid="confirm-button"]');
      await deleteResponse;

      await test.step('Deleted team is no longer searchable', async () => {
        await searchTeam(page, businessTeamName, { expectEmptyResults: true });
      });
    });
  }
);
