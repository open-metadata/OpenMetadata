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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
} from '../common';

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
  interceptURL('PUT', `/api/v1/teams`, 'putTeam');

  // confirmation message before the transfer
  cy.get('[data-testid="transfer-message"]')
    .contains(
      `Click on Confirm if you’d like to move ${dragTeam} team under ${dropTeam} team.`
    )
    .should('be.visible');

  // click on submit modal button to confirm the transfer
  cy.get('.ant-modal-footer > .ant-btn-primary').click();

  verifyResponseStatusCode('@putTeam', 200);

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
