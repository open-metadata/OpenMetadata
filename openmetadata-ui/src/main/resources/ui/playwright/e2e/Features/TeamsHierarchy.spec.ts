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
import { DELETE_TERM } from '../../constant/common';
import { GlobalSettingOptions } from '../../constant/settings';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';
import {
  addTeamHierarchy,
  getNewTeamDetails,
  hardDeleteTeam,
  softDeleteTeam,
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

test.describe('Add Nested Teams and Test TeamsSelectable', () => {
  test.slow(true);

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

  test('verifies that deleted teams are excluded from organization list', async ({
    page,
  }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    const parentTeamName = teamNames[0];
    const parentTeam = getNewTeamDetails(parentTeamName);
    const childTeamName = teamNames[1];
    const childTeam = getNewTeamDetails(childTeamName);
    await waitForAllLoadersToDisappear(page);
    const getOrganizationResponse = page.waitForResponse(
      '/api/v1/teams/name/*'
    );
    await addTeamHierarchy(page, parentTeam, 0, true);
    await getOrganizationResponse;
    const permissionResponse = page.waitForResponse(
      '/api/v1/permissions/team/name/*'
    );
    await page.getByRole('link', { name: parentTeamName }).click();
    await waitForAllLoadersToDisappear(page);
    await permissionResponse;

    await addTeamHierarchy(page, childTeam, 1, true);
    await getOrganizationResponse;

    await page.getByRole('link', { name: childTeamName }).click();
    await waitForAllLoadersToDisappear(page);
    await permissionResponse;

    await page.getByRole('link', { name: 'Organization' }).click();
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');
    await getOrganizationResponse;
    await page
      .getByRole('cell', { name: parentTeamName })
      .locator('svg')
      .nth(1)
      .click();

    await expect(page.locator('tbody')).toContainText(childTeamName);

    await page.getByRole('link', { name: childTeamName }).click();
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');
    await permissionResponse;
    await softDeleteTeam(page);

    await expect(page.getByTestId('deleted-badge')).toContainText('Deleted');

    await page.getByRole('link', { name: 'Organization' }).click();
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');
    await getOrganizationResponse;
    await page
      .getByRole('cell', { name: parentTeamName })
      .locator('svg')
      .nth(1)
      .click();

    await expect(page.locator('tbody')).not.toContainText(childTeamName);

    await page.getByRole('link', { name: parentTeamName }).click();
    await waitForAllLoadersToDisappear(page);
    await page.waitForLoadState('networkidle');
    await permissionResponse;
    await hardDeleteTeam(page);
  });

  test('Delete Parent Team', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.TEAMS);

    await page.getByRole('link', { name: businessTeamName }).click();

    await page.click('[data-testid="manage-button"]');

    await page.click('[data-testid="delete-button-title"]');

    await expect(page.locator('.ant-modal-header')).toContainText(
      businessTeamName
    );

    await page.click(`[data-testid="hard-delete-option"]`);

    await expect(page.locator('[data-testid="confirm-button"]')).toBeDisabled();

    await page
      .locator('[data-testid="confirmation-text-input"]')
      .fill(DELETE_TERM);

    const deleteResponse = page.waitForResponse(
      `/api/v1/teams/*?hardDelete=true&recursive=true`
    );

    await expect(
      page.locator('[data-testid="confirm-button"]')
    ).not.toBeDisabled();

    await page.click('[data-testid="confirm-button"]');
    await deleteResponse;

    await toastNotification(
      page,
      `"${businessTeamName}" deleted successfully!`
    );
  });
});
