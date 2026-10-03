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

import { expect, Page } from '@playwright/test';
import { enableAiAppMode } from '../e2e/Utils/appMode';
import { redirectToHomePage } from './common';

/**
 * Open the AI-mode profile and land on the Members landing view. The profile is
 * a hash-driven surface reached from the AI user menu (not a route), so the only
 * stable entry is: enable AI mode → home → user menu → profile → Members nav.
 */
export const navigateToMembersPanel = async (page: Page): Promise<void> => {
  await enableAiAppMode(page);
  await redirectToHomePage(page);

  await expect(page.getByTestId('ask-ai-user-menu-trigger')).toBeVisible();

  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await page.getByTestId('ai-profile-page').waitFor();

  await page.getByTestId('profile-nav-members').click();
  await expect(page.getByTestId('members-landing')).toBeVisible();
};

/**
 * From the Members landing, open the Teams card which renders the Organization
 * team detail. The container only paints after the team + child-teams fetches
 * resolve — both waits are hoisted so the assertion cannot race them.
 */
export const openOrganizationTeams = async (page: Page): Promise<void> => {
  const orgResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/teams/name/Organization')
  );
  const childTeamsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams?') &&
      response.url().includes('parentTeam=')
  );
  await page.getByTestId('members-card-teams').click();
  await orgResponse;
  await childTeamsResponse;

  await expect(page.getByTestId('team-detail')).toBeVisible();
};

/**
 * Drill from the Organization team into a specific child team via its row link.
 * All child teams are fetched in one page (no server-side paging), so the link
 * is always present in the DOM.
 */
export const openTeamByLink = async (
  page: Page,
  teamName: string
): Promise<void> => {
  const teamResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(`/api/v1/teams/name/${encodeURIComponent(teamName)}`)
  );
  await page.getByTestId(`team-link-${teamName}`).click();
  await teamResponse;

  await expect(page.getByTestId('team-detail')).toBeVisible();
};

/** Switch the team-detail tab (Users / Roles / Policies) by its react-aria role. */
export const openTeamTab = async (
  page: Page,
  tabName: RegExp
): Promise<void> => {
  await page.getByRole('tab', { name: tabName }).click();
};

/** Open the Users list panel from the Members landing. */
export const openUsersPanel = async (page: Page): Promise<void> => {
  const usersResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/users')
  );
  await page.getByTestId('members-card-users').click();
  await usersResponse;

  await expect(page.getByTestId('users-list-container')).toBeVisible();
};

/** Open the Admins list panel from the Members landing. */
export const openAdminsPanel = async (page: Page): Promise<void> => {
  const usersResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/users')
  );
  await page.getByTestId('members-card-admins').click();
  await usersResponse;

  await expect(page.getByTestId('users-list-container')).toBeVisible();
};

/** Open the Online Users panel from the Members landing. */
export const openOnlineUsersPanel = async (page: Page): Promise<void> => {
  const onlineResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/users/online')
  );
  await page.getByTestId('members-card-online-users').click();
  await onlineResponse;

  await expect(page.getByTestId('online-users-panel')).toBeVisible();
};

/**
 * Search the Users/Admins list (TableV2 search box) for a user and return the
 * username cell locator. The list is ES-backed, so a freshly-created user can lag
 * the index — re-issue the search until the row appears.
 */
export const searchUserRow = (page: Page, userName: string) => {
  const searchInput = page
    .getByTestId('search-bar-container')
    .getByRole('textbox');
  const userCell = page.getByTestId('users-list-table').getByTestId(userName);

  return expect(async () => {
    await searchInput.fill('');
    await searchInput.fill(userName);
    await expect(userCell).toBeVisible({ timeout: 5000 });
  })
    .toPass({ timeout: 30000 })
    .then(() => userCell);
};
