/*
 *  Copyright 2025 Collate.
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
import { expect, Page } from '@playwright/test';
import { clickOutside, redirectToHomePage } from './common';

export const redirectToUserPage = async (page: Page) => {
  await redirectToHomePage(page);

  await page.getByTestId('dropdown-profile').click();

  // Hover on the profile avatar to close the name tooltip. Scope to the
  // navbar trigger button — ProfilePicture (which owns the "profile-avatar"
  // testid) is a widely reused component, so an unscoped lookup can match
  // other avatars rendered elsewhere on the home page.
  await page
    .getByTestId('dropdown-profile')
    .getByTestId('profile-avatar')
    .hover();

  await page.locator('.profile-dropdown').waitFor({ state: 'visible' });

  const getUserDetails = page.waitForResponse(`/api/v1/users/name/*`);

  await page.locator('.profile-dropdown').getByTestId('user-name').click();

  await getUserDetails;

  // Close the profile dropdown
  await clickOutside(page);
};

export const openTeamEditorAndSelect = async (page: Page, teamName: string) => {
  const teamHierarchyResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams/hierarchy?isJoinable=false') &&
      response.ok()
  );
  await page.getByTestId('edit-teams-button').click();
  await teamHierarchyResponse;

  const teamSelect = page.getByTestId('team-select');
  await expect(teamSelect).toBeVisible();
  await teamSelect.click();

  // eslint-disable-next-line om-playwright/no-positional-locator -- antd leaves closed tree-select dropdowns mounted (hidden), so .last() targets the one just opened
  const teamDropdown = page.locator('.ant-tree-select-dropdown').last();
  await expect(teamDropdown).toBeVisible({ timeout: 30000 });

  const directTeamOption = teamDropdown
    .locator('.ant-select-tree-title')
    .filter({ hasText: new RegExp(`^${teamName}$`) });

  if (await directTeamOption.isVisible().catch(() => false)) {
    // eslint-disable-next-line playwright/no-force-option -- element obscured by overlay
    await directTeamOption.click({ force: true });

    return;
  }

  await teamSelect.locator('input:not([disabled])').click();
  await page.keyboard.type(teamName);

  await expect(teamDropdown).toContainText(teamName, { timeout: 30000 });

  const teamOption = teamDropdown.getByText(teamName, {
    exact: true,
  });

  await expect(teamOption).toBeVisible({ timeout: 30000 });
  // eslint-disable-next-line playwright/no-force-option -- element obscured by overlay
  await teamOption.click({ force: true });
};
