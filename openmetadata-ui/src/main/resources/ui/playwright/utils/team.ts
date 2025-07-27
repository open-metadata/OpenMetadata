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
import { TableClass } from '../support/entity/TableClass';
import { TeamClass } from '../support/team/TeamClass';
import { UserClass } from '../support/user/UserClass';
import {
  descriptionBox,
  redirectToHomePage,
  toastNotification,
  uuid,
} from './common';
import { addOwner } from './entity';
import { validateFormNameFieldInput } from './form';
import { settingClick } from './sidebar';

const TEAM_TYPES = ['Department', 'Division', 'Group'];

export const createTeam = async (page: Page, isPublic?: boolean) => {
  const teamData = {
    name: `pw%team-${uuid()}`,
    displayName: `PW ${uuid()}`,
    email: `pwteam${uuid()}@example.com`,
    description: 'This is a PW team',
  };

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.fill('[data-testid="name"]', teamData.name);
  await page.fill('[data-testid="display-name"]', teamData.displayName);
  await page.fill('[data-testid="email"]', teamData.email);

  if (isPublic) {
    await page.getByTestId('isJoinable-switch-button').click();
  }

  await page.locator(descriptionBox).isVisible();
  await page.locator(descriptionBox).fill(teamData.description);

  const createTeamResponse = page.waitForResponse('/api/v1/teams');

  await page.locator('button[type="submit"]').click();

  await createTeamResponse;

  return teamData;
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

  await page.waitForSelector('[role="dialog"].ant-modal');

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
  searchWillBeEmpty?: boolean
) => {
  const searchResponse = page.waitForResponse('/api/v1/search/query?q=**');

  await page.fill('[data-testid="searchbar"]', teamName);
  await searchResponse;

  if (searchWillBeEmpty) {
    await expect(page.getByTestId('search-error-placeholder')).toBeVisible();
  } else {
    await expect(page.getByRole('cell', { name: teamName })).toBeVisible();
  }
};

export const addTeamOwnerToEntity = async (
  page: Page,
  table: TableClass,
  team: TeamClass
) => {
  await redirectToHomePage(page);
  await table.visitEntityPageWithCustomSearchBox(page);
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
  await redirectToHomePage(page);
  await table.visitEntityPageWithCustomSearchBox(page);

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

export const addUserInTeam = async (page: Page, user: UserClass) => {
  const userName = user.data.email.split('@')[0];
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
    .locator(`[data-testid="selectable-list"] [title="${user.getUserName()}"]`)
    .click();

  await expect(
    page.locator(
      `[data-testid="selectable-list"] [title="${user.getUserName()}"]`
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
    '/api/v1/teams/name/*?fields=*childrenCount*include=all'
  );

  await settingClick(page, GlobalSettingOptions.TEAMS);

  const response = await fetchResponse;
  const jsonRes = await response.json();

  await expect(
    page.locator(
      '[data-testid="teams"] [data-testid="count"] [data-testid="filter-count"]'
    )
  ).toContainText(jsonRes.childrenCount.toString());
};
