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
import { ACTION_TIMEOUT } from '../constant/common';
import { clickOutside, redirectToHomePage } from './common';
import { waitForResponseWithStatus } from './waitHelpers';

export const redirectToUserPage = async (page: Page) => {
  await redirectToHomePage(page);

  await page.getByTestId('dropdown-profile').click();

  await page.locator('.profile-dropdown').waitFor({ state: 'visible' });

  const getUserDetails = page.waitForResponse(`/api/v1/users/name/*`);

  await page.locator('.profile-dropdown').getByTestId('user-name').click();

  await getUserDetails;

  // Close the profile dropdown
  await clickOutside(page);
};

export const openTeamEditorAndSelect = async (page: Page, teamName: string) => {
  const teamHierarchyResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/teams/hierarchy?isJoinable=false'),
    'ok'
  );
  await page.getByTestId('edit-teams-button').click();
  await teamHierarchyResponse;

  const teamSelect = page.getByTestId('team-select');
  await expect(teamSelect).toBeVisible();
  await teamSelect.click();

  await selectTeamInPicker(page, teamName);
};

/**
 * Picks a team in the core TreeSelect team picker. The tree opens in its own
 * overlay (`team-select-popover`), and searching first keeps nested teams
 * reachable without expanding their parents. The multi-select overlay stays
 * open after a pick and swallows the next outside click, so close it before
 * the caller saves.
 */
export const selectTeamInPicker = async (page: Page, teamName: string) => {
  const popover = page.getByTestId('team-select-popover');
  await expect(popover).toBeVisible({ timeout: ACTION_TIMEOUT });

  await page.getByTestId('team-select').getByRole('combobox').fill(teamName);

  const teamOption = popover.getByText(teamName, { exact: true }).first();

  await expect(teamOption).toBeVisible({ timeout: ACTION_TIMEOUT });
  await teamOption.click();
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
};
