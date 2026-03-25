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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { GlobalSettingOptions } from '../constant/settings';
import { Domain } from '../support/domain/Domain';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { TableClass } from '../support/entity/TableClass';
import { TeamClass } from '../support/team/TeamClass';
import { UserClass } from '../support/user/UserClass';
import {
  assignDomain,
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from './common';
import {
  addMultiOwner,
  addOwner,
  waitForAllLoadersToDisappear,
} from './entity';
import { validateFormNameFieldInput } from './form';
import { settingClick } from './sidebar';

const TEAM_TYPES = ['Department', 'Division', 'Group'];

interface SearchTeamOptions {
  expectEmptyResults?: boolean;
  expectNotFound?: boolean;
}

export const openTeamsPage = async (page: Page) => {
  const searchBar = page.getByTestId('searchbar');
  if (await searchBar.isVisible().catch(() => false)) {
    return searchBar;
  }

  await page.goto('/settings/members/teams', { waitUntil: 'domcontentloaded' });

  if (!(await searchBar.isVisible().catch(() => false))) {
    await redirectToHomePage(page);
    await settingClick(page, GlobalSettingOptions.TEAMS);
  }

  await expect(searchBar).toBeVisible({ timeout: 60000 });

  return searchBar;
};

export const createTeam = async (
  page: Page,
  isPublic?: boolean,
  overrides?: Partial<{
    name: string;
    displayName: string;
    email: string;
    description: string;
    fullyQualifiedName: string;
  }>
) => {
  const teamData = {
    name: `pw%team-${uuid()}`,
    displayName: `PW ${uuid()}`,
    email: `pwteam${uuid()}@example.com`,
    description: 'This is a PW team',
    ...overrides,
  };

  await page.locator('[role="dialog"].ant-modal').waitFor();

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.fill('[data-testid="name"]', teamData.name);
  await page.fill('[data-testid="display-name"]', teamData.displayName);
  await page.fill('[data-testid="email"]', teamData.email);

  if (isPublic) {
    await page.getByTestId('isJoinable-switch-button').click();
  }

  await page.locator(descriptionBox).isVisible();
  await page.locator(descriptionBox).fill(teamData.description);

  const createTeamResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/teams') &&
      response.request().method() === 'POST'
  );

  await page.locator('button[type="submit"]').click();

  const response = await createTeamResponse;
  const createdTeam = await response.json();

  await waitForAllLoadersToDisappear(page);

  return {
    ...teamData,
    name: createdTeam.name ?? teamData.name,
    displayName: createdTeam.displayName ?? teamData.displayName,
    fullyQualifiedName:
      createdTeam.fullyQualifiedName ?? overrides?.fullyQualifiedName,
  };
};

export const softDeleteTeam = async (page: Page) => {
  await page
    .getByTestId('team-details-collapse')
    .getByTestId('manage-button')
    .click();
  await page.getByTestId('delete-button').click();

  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByTestId('confirmation-text-input')).toBeVisible();

  await page.click('[data-testid="soft-delete-option"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse(
    '/api/v1/teams/*?hardDelete=false&recursive=true'
  );

  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  await toastNotification(page, /deleted successfully!/);
};

export const hardDeleteTeam = async (page: Page) => {
  await page
    .getByTestId('team-details-collapse')
    .getByTestId('manage-button')
    .click();
  await page.getByTestId('delete-button').click();

  await page.locator('[role="dialog"].ant-modal').waitFor();

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.click('[data-testid="hard-delete-option"]');
  await page.check('[data-testid="hard-delete"]');
  await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

  const deleteResponse = page.waitForResponse(
    '/api/v1/teams/*?hardDelete=true&recursive=true'
  );

  await page.click('[data-testid="confirm-button"]');

  await deleteResponse;

  await toastNotification(page, /deleted successfully!/);
};

export const getNewTeamDetails = (teamName: string) => {
  return {
    name: teamName,
    displayName: teamName,
    teamType: 'BusinessUnit',
    description: `Team ${teamName} Description`,
    ownername: 'admin',
    email: 'team@gmail.com',
  };
};

const getTeamType = (
  currentTeam: string
): {
  childTeamType: string;
  teamTypeOptions: typeof TEAM_TYPES;
} => {
  switch (currentTeam) {
    case 'BusinessUnit':
      return {
        childTeamType: 'Division',
        teamTypeOptions: TEAM_TYPES,
      };

    case 'Division':
      return {
        childTeamType: 'Department',
        teamTypeOptions: TEAM_TYPES,
      };

    case 'Department':
      return {
        childTeamType: 'Group',
        teamTypeOptions: ['Department', 'Group'],
      };
  }

  return {
    childTeamType: '',
    teamTypeOptions: [],
  };
};

const checkTeamTypeOptions = async (page: Page, type: string) => {
  const teamTypeOptions = getTeamType(type)?.teamTypeOptions;
  if (teamTypeOptions) {
    for (const teamType of teamTypeOptions) {
      const teamTypeElement = page.locator(
        `.ant-select-dropdown [title="${teamType}"]`
      );

      await expect(teamTypeElement).toBeVisible();
    }
  }
};

export const selectTeamHierarchy = async (page: Page, index: number) => {
  if (index > 0) {
    const teamTypeElement = page.locator('[data-testid="team-type"]');
    const text = await teamTypeElement.innerText();
    checkTeamTypeOptions(page, text);
    const childTeamType = getTeamType(text).childTeamType;
    await page
      .locator(`.ant-select-dropdown [title="${childTeamType}"]`)
      .click();
  } else {
    checkTeamTypeOptions(page, 'BusinessUnit');
    await page.locator(`.ant-select-dropdown [title='BusinessUnit']`).click();
  }
};

export const addTeamHierarchy = async (
  page: Page,
  teamDetails: {
    name: string;
    displayName?: string;
    teamType: string;
    description: string;
    ownername?: string;
    email: string;
    updatedName?: string;
    username?: string;
    userId?: string;
    assetname?: string;
    updatedEmail?: string;
  },
  index?: number,
  isHierarchy = false
) => {
  const getTeamsResponse = page.waitForResponse('/api/v1/teams*');

  // Fetching the add button and clicking on it
  if (index && index > 0) {
    await page.click('[data-testid="add-placeholder-button"]');
  } else {
    await page.click('[data-testid="add-team"]');
  }

  await getTeamsResponse;

  // Entering team details
  await validateFormNameFieldInput({
    page,
    value: teamDetails.name,
    fieldName: 'Name',
    fieldSelector: '[data-testid="name"]',
    errorDivSelector: '#add-team-nest-messages_name_help',
  });

  await page.fill('[data-testid="display-name"]', teamDetails.name);
  await page.fill('[data-testid="email"]', teamDetails.email);
  await page.click('[data-testid="team-selector"]');

  if (isHierarchy) {
    await selectTeamHierarchy(page, index ?? 0);
  } else {
    await page.click(`.ant-select-dropdown [title="${teamDetails.teamType}"]`);
  }

  await page.locator(descriptionBox).fill(teamDetails.description);

  // Saving the created team
  const saveTeamResponse = page.waitForResponse('/api/v1/teams');
  await page.click('[form="add-team-form"]');
  await saveTeamResponse;
};

export const removeOrganizationPolicyAndRole = async (
  apiContext: APIRequestContext
) => {
  const organizationTeamResponse = await apiContext
    .get(`/api/v1/teams/name/Organization`)
    .then((res) => res.json());

  await apiContext.patch(`/api/v1/teams/${organizationTeamResponse.id}`, {
    data: [
      {
        op: 'replace',
        path: '/defaultRoles',
        value: [],
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
};

export const searchTeam = async (
  page: Page,
  teamName: string,
  options?: SearchTeamOptions
) => {
  const searchBar = await openTeamsPage(page);
  await page.fill('[data-testid="searchbar"]', teamName);

  if (options?.expectEmptyResults) {
    await expect
      .poll(
        async () => {
          const hasPlaceholder = await page
            .getByTestId('search-error-placeholder')
            .isVisible()
            .catch(() => false);
          const matchingRows = await page
            .getByRole('cell', { name: teamName })
            .count();

          return hasPlaceholder || matchingRows === 0;
        },
        { timeout: 30000, intervals: [500, 1000, 2000] }
      )
      .toBe(true);
  } else if (options?.expectNotFound) {
    await expect
      .poll(async () => page.getByRole('cell', { name: teamName }).count(), {
        timeout: 30000,
        intervals: [500, 1000, 2000],
      })
      .toBe(0);
  } else {
    await expect
      .poll(
        async () =>
          page
            .getByRole('cell', { name: teamName })
            .isVisible()
            .catch(() => false),
        { timeout: 30000, intervals: [500, 1000, 2000] }
      )
      .toBe(true);
  }
};

export const addTeamOwnerToEntity = async (
  page: Page,
  table: TableClass,
  team: TeamClass
) => {
  await table.visitEntityPage(page);
  await addOwner({
    page,
    owner: team.data.displayName,
    type: 'Teams',
    endpoint: table.endpoint,
    dataTestId: 'data-assets-header',
  });
};

export const verifyAssetsInTeamsPage = async (
  page: Page,
  table: TableClass,
  team: TeamClass,
  assetCount: number
) => {
  const fullyQualifiedName = table.entityResponseData?.['fullyQualifiedName'];
  await table.visitEntityPage(page);

  await expect(
    page.getByTestId('data-assets-header').getByTestId('owner-link')
  ).toContainText(team.data.displayName);

  await page
    .getByTestId('data-assets-header')
    .locator(`a:has-text("${team.data.displayName}")`)
    .click();

  const res = page.waitForResponse('/api/v1/search/query?*size=15*');
  await page.getByTestId('assets').click();
  await res;

  await expect(
    page.locator(`[data-testid="table-data-card_${fullyQualifiedName}"]`)
  ).toBeVisible();

  await expect(
    page.getByTestId('assets').getByTestId('filter-count')
  ).toContainText(assetCount.toString());
};

export const verifyTeamListingAssetCount = async (
  page: Page,
  team: TeamClass,
  expectedCount: number
) => {
  await page
    .goto(`/settings/members/teams/${encodeURIComponent(team.data.name)}`, {
      waitUntil: 'commit',
    })
    .catch(() => undefined);
  await expect(page).toHaveURL(
    new RegExp(
      `/settings/members/teams/${encodeURIComponent(team.data.name).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      )}$`
    )
  );

  const res = page.waitForResponse('/api/v1/search/query?*size=15*');
  await page.getByTestId('assets').click();
  await res;

  await expect(
    page.getByTestId('assets').getByTestId('filter-count')
  ).toHaveText(expectedCount.toString());
};

export const addUserInTeam = async (page: Page, user: UserClass) => {
  const userName = user.data.email.split('@')[0];
  const fetchUsersResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/users') &&
      response.url().includes('limit=25') &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );
  await page.locator('[data-testid="add-new-user"]').click();
  await fetchUsersResponse;

  // Search and select the user
  await page
    .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
    .fill(user.getUserDisplayName());

  await page
    .locator(
      `[data-testid="selectable-list"] [title="${user.getUserDisplayName()}"]`
    )
    .click();

  await expect(
    page.locator(
      `[data-testid="selectable-list"] [title="${user.getUserDisplayName()}"]`
    )
  ).toHaveClass(/active/);

  const updateTeamResponse = page.waitForResponse('/api/v1/users*');

  // Update the team with the new user
  await page.locator('[data-testid="selectable-list-update-btn"]').click();
  await updateTeamResponse;

  // Verify the user is added to the team

  await expect(
    page.locator(`[data-testid="${userName.toLowerCase()}"]`)
  ).toBeVisible();
};

export const checkTeamTabCount = async (page: Page) => {
  const fetchResponse = page.waitForResponse(
    '/api/v1/teams?parentTeam=Organization&include=non-deleted&fields=**'
  );

  await settingClick(page, GlobalSettingOptions.TEAMS);

  const response = await fetchResponse;
  const jsonRes = await response.json();

  const childrenCount = jsonRes.data?.length ?? 0;

  await expect(
    page.locator(
      '[data-testid="teams"] [data-testid="count"] [data-testid="filter-count"]'
    )
  ).toContainText(childrenCount.toString());
};

export const addEmailTeam = async (page: Page, email: string) => {
  // Edit email
  await page.locator('[data-testid="edit-email"]').click();
  await page.locator('[data-testid="email-input"]').fill(email);

  const saveEditEmailResponse = page.waitForResponse('/api/v1/teams/*');
  await page.locator('[data-testid="save-edit-email"]').click();
  await saveEditEmailResponse;

  // Reload the page
  await page.reload();

  await waitForAllLoadersToDisappear(page);

  // Check for updated email
  await expect(page.locator('[data-testid="email-value"]')).toContainText(
    email
  );
};

export const addUserTeam = async (
  page: Page,
  user: UserClass,
  userName: string
) => {
  // Navigate to users tab and add new user
  await page.locator('[data-testid="users"]').click();

  const fetchUsersResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/users') &&
      response.url().includes('limit=25') &&
      response.request().method() === 'GET' &&
      response.status() === 200
  );
  await page.locator('[data-testid="add-new-user"]').click();
  await fetchUsersResponse;

  // Search and select the user
  await page
    .locator('[data-testid="selectable-list"] [data-testid="searchbar"]')
    .fill(user.getUserDisplayName());

  await page
    .locator(
      `[data-testid="selectable-list"] [title="${user.getUserDisplayName()}"]`
    )
    .click();

  await expect(
    page.locator(
      `[data-testid="selectable-list"] [title="${user.getUserDisplayName()}"]`
    )
  ).toHaveClass(/active/);

  const updateTeamResponse = page.waitForResponse('/api/v1/users*');

  // Update the team with the new user
  await page.locator('[data-testid="selectable-list-update-btn"]').click();
  await updateTeamResponse;

  // Verify the user is added to the team

  await expect(
    page.locator(`[data-testid="${userName.toLowerCase()}"]`)
  ).toBeVisible();
};

export const executionOnOwnerTeam = async (
  page: Page,
  team: TeamClass,
  data: {
    domain: Domain;
    email: string;
    user: string;
  }
) => {
  await team.visitTeamPage(page);

  await expect(page.getByTestId('manage-button')).toBeVisible();

  await expect(page.getByTestId('edit-team-subscription')).toBeVisible();
  await expect(page.getByTestId('edit-team-type-icon')).toBeVisible();

  await assignDomain(page, data.domain.responseData);

  await addMultiOwner({
    page,
    ownerNames: [data.user],
    activatorBtnDataTestId: 'edit-owner',
    resultTestId: 'teams-info-header',
    endpoint: EntityTypeEndpoint.Teams,
    type: 'Users',
    clearAll: false,
  });

  await addEmailTeam(page, data.email);

  await page.getByTestId('add-placeholder-button').click();

  const newTeamData = await createTeam(page);

  await waitForAllLoadersToDisappear(page);

  await expect(
    page.getByRole('cell', { name: newTeamData.displayName })
  ).toBeVisible();
};

export const executionOnOwnerGroupTeam = async (
  page: Page,
  team: TeamClass,
  data: {
    domain: Domain;
    email: string;
    user: UserClass;
    userName: string;
  }
) => {
  await team.visitTeamPage(page);

  await expect(
    page.getByTestId('team-details-collapse').getByTestId('manage-button')
  ).toBeVisible();

  await expect(page.getByTestId('edit-team-subscription')).toBeVisible();
  await expect(page.getByTestId('edit-team-type-icon')).not.toBeVisible();

  await assignDomain(page, data.domain.responseData);

  await addEmailTeam(page, data.email);

  await addUserTeam(page, data.user, data.userName);
};
