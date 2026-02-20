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
import { TableClass } from '../../support/entity/TableClass';
import { TeamClass } from '../../support/team/TeamClass';
import {
  createNewPage,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { settingClick } from '../../utils/sidebar';
import {
  addTeamHierarchy,
  addTeamOwnerToEntity,
  getNewTeamDetails,
  verifyAssetsInTeamsPage,
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

// ── Self-contained asset count aggregation test ──
// Creates hierarchy (API): aggBU (BusinessUnit) → aggGroup (Group)
// Creates 1 table (API), assigns Group as owner via UI,
// then verifies asset count + assets tab on the parent team via UI.

const aggId = uuid();
const aggBUName = `agg-bu-${aggId}`;
const aggGroupName = `agg-grp-${aggId}`;

const aggBU = new TeamClass({
  name: aggBUName,
  displayName: aggBUName,
  description: 'Aggregation test BU',
  teamType: 'BusinessUnit',
});
const aggGroup = new TeamClass({
  name: aggGroupName,
  displayName: aggGroupName,
  description: 'Aggregation test Group',
  teamType: 'Group',
});

const aggTable = new TableClass();

test.describe('Verify Asset Count Aggregation', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeAll('Setup hierarchy and table', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Create BU → Group hierarchy via API
    await aggBU.create(apiContext);

    const grpRes = await apiContext.post('/api/v1/teams', {
      data: { ...aggGroup.data, parents: [aggBU.responseData.id] },
    });
    expect(grpRes.ok()).toBeTruthy();
    aggGroup.responseData = await grpRes.json();

    // Create a table via API
    await aggTable.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await aggTable.delete(apiContext);
    await aggBU.delete(apiContext);
    await afterAction();
  });

  test('Assign asset to sub-team and verify aggregated count on parent', async ({
    page,
  }) => {
    test.slow();
    await redirectToHomePage(page);
    // Step 1: Visit the table page and assign the Group team as owner (via UI)
    await addTeamOwnerToEntity(page, aggTable, aggGroup);

    // Step 2: Verify the asset appears in the Group team's Assets tab
    await verifyAssetsInTeamsPage(page, aggTable, aggGroup, 1);

    // Step 3: Navigate to the parent BU team page
    await redirectToHomePage(page);
    const getOrganizationResponse = page.waitForResponse(
      '/api/v1/teams/name/*'
    );
    await settingClick(page, GlobalSettingOptions.TEAMS);
    await getOrganizationResponse;

    // Step 3: Verify asset count for the BU in the Organization-level table
    // Wait for skeleton in the BU row to resolve and verify aggregated count
    const buRow = page.locator(`[data-row-key="${aggBUName}"]`);
    await buRow.locator('.ant-skeleton-active').waitFor({ state: 'hidden' });
    await expect(buRow.getByTestId('asset-count')).toHaveText('1');

    // Click on the BU team to see its children
    const permissionResponse = page.waitForResponse(
      '/api/v1/permissions/team/name/*'
    );
    await page.getByRole('link', { name: aggBUName }).click();
    await permissionResponse;

    // Step 4: Verify asset count shown in the hierarchy table for the Group child
    // Wait for the skeleton loader to disappear, then assert the count
    const groupRow = page.locator(
      `[data-row-key="${aggGroupName}"]`
    );

    await groupRow.locator('.ant-skeleton-active').waitFor({ state: 'hidden' });

    await expect(groupRow.getByTestId('asset-count')).toHaveText('1');

    // Step 5: Open the Assets tab on the BU team page and verify aggregated count
    const assetsRes = page.waitForResponse('/api/v1/search/query?*size=15*');
    await page.getByTestId('assets').click();
    await assetsRes;

    // Verify the BU's Assets tab shows count = 1 (aggregated from Group child)
    await expect(
      page.getByTestId('assets').getByTestId('filter-count')
    ).toContainText('1');

    // Verify the table card is visible in the BU's Assets tab
    const tableFqn = aggTable.entityResponseData?.['fullyQualifiedName'];
    await expect(
      page.locator(`[data-testid="table-data-card_${tableFqn}"]`)
    ).toBeVisible();
  });
});
