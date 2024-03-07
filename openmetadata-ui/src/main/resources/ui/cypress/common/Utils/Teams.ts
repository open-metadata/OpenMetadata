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

import {
  descriptionBox,
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

const TEAM_TYPES = ['Department', 'Division', 'Group'];

export const commonTeamDetails = {
  username: 'Aaron Johnson',
  userId: 'aaron_johnson0',
  assetname: 'dim_address',
  email: 'team1@gmail.com',
  updatedEmail: 'updatedemail@gmail.com',
};
export const confirmationDragAndDropTeam = (
  dragTeam: string,
  dropTeam: string
) => {
  interceptURL('PATCH', `/api/v1/teams/*`, 'patchTeam');

  // confirmation message before the transfer
  cy.get('[data-testid="confirmation-modal"] .ant-modal-body')
    .contains(
      `Click on Confirm if you’d like to move ${dragTeam} team under ${dropTeam} team.`
    )
    .should('be.visible');

  // click on submit modal button to confirm the transfer
  cy.get('.ant-modal-footer > .ant-btn-primary').click();

  verifyResponseStatusCode('@patchTeam', 200);

  toastNotification('Team moved successfully!');
};

export const deleteTeamPermanently = (teamName: string) => {
  interceptURL('GET', `/api/v1/teams/name/${teamName}*`, 'getSelectedTeam');
  // Click on created team
  cy.get(`[data-row-key="${teamName}"]`).contains(teamName).click();

  verifyResponseStatusCode('@getSelectedTeam', 200);
  cy.get(
    '[data-testid="team-detail-header"] [data-testid="manage-button"]'
  ).click();

  cy.get('[data-menu-id*="delete-button"]').should('be.visible');

  cy.get('[data-testid="delete-button-title"]').click();

  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.disabled');

  // Check if soft delete option is present
  cy.get('[data-testid="soft-delete-option"]').should('contain', teamName);

  // Click on permanent delete option
  cy.get('[data-testid="hard-delete-option"]')
    .should('contain', teamName)
    .click();

  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

  interceptURL('DELETE', '/api/v1/teams/*', 'deleteTeam');
  cy.get('[data-testid="confirm-button"]').click();

  verifyResponseStatusCode('@deleteTeam', 200);

  // Verify the toast message
  toastNotification(`"${teamName}" deleted successfully!`);

  // Validating the deleted team

  cy.get('table').should('not.contain', teamName);
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

const checkTeamTypeOptions = (type: string) => {
  for (const teamType of getTeamType(type)?.teamTypeOptions) {
    cy.get(`.ant-select-dropdown [title="${teamType}"]`)
      .should('exist')
      .should('be.visible');
  }
};

export const selectTeamHierarchy = (index: number) => {
  if (index > 0) {
    cy.get('[data-testid="team-type"]')
      .invoke('text')
      .then((text) => {
        cy.log(text);
        checkTeamTypeOptions(text);
        cy.log('check type', text);
        cy.get(
          `.ant-select-dropdown [title="${getTeamType(text).childTeamType}"]`
        ).click();
      });
  } else {
    checkTeamTypeOptions('BusinessUnit');

    cy.get(`.ant-select-dropdown [title='BusinessUnit']`)
      .should('exist')
      .should('be.visible')
      .click();
  }
};

export const addTeam = (
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
  interceptURL('GET', '/api/v1/teams*', 'addTeam');
  // Fetching the add button and clicking on it
  if (index > 0) {
    cy.get('[data-testid="add-placeholder-button"]').click();
  } else {
    cy.get('[data-testid="add-team"]').click();
  }

  verifyResponseStatusCode('@addTeam', 200);

  // Entering team details
  cy.get('[data-testid="name"]').type(teamDetails.name);

  cy.get('[data-testid="display-name"]').type(teamDetails.name);

  cy.get('[data-testid="email"]').type(teamDetails.email);

  cy.get('[data-testid="team-selector"]').click();

  if (isHierarchy) {
    selectTeamHierarchy(index);
  } else {
    cy.get(`.ant-select-dropdown [title="${teamDetails.teamType}"]`).click();
  }

  cy.get(descriptionBox).type(teamDetails.description);

  interceptURL('POST', '/api/v1/teams', 'saveTeam');
  interceptURL('GET', '/api/v1/team*', 'createTeam');

  // Saving the created team
  cy.get('[form="add-team-form"]').scrollIntoView().click();

  verifyResponseStatusCode('@saveTeam', 201);
  verifyResponseStatusCode('@createTeam', 200);
};
