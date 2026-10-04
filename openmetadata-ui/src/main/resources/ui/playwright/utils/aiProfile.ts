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
import { TeamClass } from '../support/team/TeamClass';
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
  // Scope to the panel: the home page behind the modal has its own search box.
  const searchInput = page
    .getByTestId('users-list-container')
    .getByTestId('searchbar');
  const userCell = page.getByTestId('users-list-table').getByTestId(userName);

  return expect(async () => {
    await searchInput.fill('');
    await searchInput.fill(userName);
    await expect(userCell).toBeVisible({ timeout: 5000 });
  })
    .toPass({ timeout: 30000 })
    .then(() => userCell);
};

/** Navigate from the Members landing into a previously-created team's detail. */
export const openCreatedTeam = async (
  page: Page,
  team: TeamClass
): Promise<void> => {
  await navigateToMembersPanel(page);
  await openOrganizationTeams(page);
  await openTeamByLink(page, team.responseData.name);
};

/** Wait for the PATCH that updates a given team. */
export const waitForTeamPatch = (page: Page, teamId: string) =>
  page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/teams/${teamId}`) &&
      response.request().method() === 'PATCH'
  );

/**
 * Drive the add-user UserTeamSelectableList popover (same widget as owner pick).
 * The option row renders the user's display name, so search/filter by that.
 */
export const addUserToTeam = async (
  page: Page,
  teamId: string,
  userDisplayName: string
): Promise<void> => {
  await page.getByTestId('add-user').click();
  await page
    .getByTestId('select-owner-tabs')
    .getByRole('tab', { name: 'Users' })
    .click();

  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=user')
  );
  await page
    .locator('[data-testid="owner-select-users-search-bar"]')
    .fill(userDisplayName);
  await searchResponse;

  await page
    .locator('[data-testid="owner-option"]')
    .filter({ hasText: userDisplayName })
    .click();

  const patchResponse = waitForTeamPatch(page, teamId);
  await page
    .locator('[data-testid="owner-select-users-panel"]')
    .getByTestId('selectable-list-update-btn')
    .click();
  await patchResponse;
};

/** Open a user's profile-details panel from the Users list. */
export const openUserProfile = async (
  page: Page,
  userName: string
): Promise<void> => {
  await navigateToMembersPanel(page);
  await openUsersPanel(page);
  const userCell = await searchUserRow(page, userName);

  const profileResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(`/api/v1/users/name/${encodeURIComponent(userName)}`)
  );
  await userCell.click();
  await profileResponse;

  await expect(page.getByTestId('profile-details-panel')).toBeVisible();
};

/** Click the "Members" breadcrumb in the profile content header. */
export const clickMembersBreadcrumb = async (page: Page): Promise<void> => {
  // The header breadcrumb is a react-aria link; scope to the header so it cannot
  // collide with the "Members" sidebar nav button.
  await page
    .getByTestId('profile-content-header')
    .getByRole('link', { name: 'Members' })
    .click();
  await expect(page.getByTestId('members-landing')).toBeVisible();
};
