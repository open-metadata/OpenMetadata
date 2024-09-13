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
import { descriptionBox, toastNotification, uuid } from './common';
import { validateFormNameFieldInput } from './form';

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

  await page
    .locator('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .isVisible();
  await page
    .locator('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .fill(teamData.description);

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

  await page.waitForSelector('[role="dialog"].ant-modal');

  await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

  await page.click('[data-testid="soft-delete-option"]');
  await page.check('[data-testid="soft-delete"]');
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

  await page.fill(descriptionBox, teamDetails.description);

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
