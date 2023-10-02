/*
 *  Copyright 2022 Collate.
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

// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

import {
  addTeam,
  descriptionBox,
  interceptURL,
  toastNotification,
  updateOwner,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';

const updatedDescription = 'This is updated description';

const teamName = 'team-group-test-430116' ?? `team-ct-test-${uuid()}`;
const TEAM_DETAILS = {
  name: teamName,
  updatedName: `${teamName}-updated`,
  teamType: 'Group',
  description: `This is ${teamName} description`,
  username: 'Aaron Johnson',
  userId: 'aaron_johnson0',
  assetname: 'dim_address',
  email: 'team1@gmail.com',
  updatedEmail: 'updatedemail@gmail.com',
};
const hardDeleteTeamName = `team-ct-test-${uuid()}`;
const HARD_DELETE_TEAM_DETAILS = {
  name: hardDeleteTeamName,
  displayName: hardDeleteTeamName,
  teamType: 'Department',
  description: `This is ${hardDeleteTeamName} description`,
  email: 'team@gmail.com',
};

describe('Teams flow should work properly', () => {
  beforeEach(() => {
    interceptURL('GET', `/api/v1/users?fields=*`, 'getUserDetails');
    interceptURL('GET', `/api/v1/permissions/team/name/*`, 'permissions');
    cy.login();

    cy.get('[data-testid="app-bar-item-settings"]')
      .should('be.visible')
      .click();

    // Clicking on teams
    cy.get('[data-testid="settings-left-panel"]')
      .should('exist')
      .should('be.visible')
      .contains('Teams')
      .click();
  });

  it('Add new team', () => {
    addTeam(TEAM_DETAILS);

    cy.reload();

    // asserting the added values
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .scrollIntoView()
      .should('be.visible');
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`).should(
      'contain',
      TEAM_DETAILS.description
    );
  });

  it('Add owner to created team', () => {
    // Clicking on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();
    updateOwner();
  });

  it('Update email of created team', () => {
    interceptURL('PATCH', '/api/v1/teams/*', 'updateEmail');
    interceptURL('GET', '/api/v1/teams/name/*', 'getTeam');

    // Clicking on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();
    verifyResponseStatusCode('@getTeam', 200);

    cy.get('[data-testid="edit-email"]').should('be.visible').scrollIntoView();
    cy.get('[data-testid="edit-email"]').click();
    cy.get('[data-testid="email-input"]')
      .should('be.visible')
      .clear()
      .type(TEAM_DETAILS.updatedEmail);

    cy.get('[data-testid="save-edit-email"]').should('be.visible').click();

    verifyResponseStatusCode('@updateEmail', 200);

    cy.reload();

    // check for updated email
    cy.get('[data-testid="email-value"]')
      .should('be.visible')
      .contains(TEAM_DETAILS.updatedEmail);
  });

  it('Add user to created team', () => {
    interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');
    interceptURL('PATCH', '/api/v1/teams/*', 'updateTeam');
    // Clicking on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();
    verifyResponseStatusCode('@permissions', 200);
    cy.get('[data-testid="users"]').click();
    cy.get('[data-testid="add-new-user"]').scrollIntoView().click();
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="selectable-list"] [data-testid="searchbar"]').type(
      TEAM_DETAILS.username
    );
    cy.get('[data-testid="selectable-list"]')
      .find(`[title="${TEAM_DETAILS.username}"]`)
      .click();
    cy.get('[data-testid="selectable-list"]')
      .find(`[title="${TEAM_DETAILS.username}"] input[type='checkbox']`)
      .should('be.checked');

    cy.get('[data-testid="selectable-list-update-btn"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@updateTeam', 200);
    cy.get(`[data-testid="${TEAM_DETAILS.userId}"]`).should('be.visible');
  });

  it('Remove added user from created team', () => {
    interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');
    interceptURL('PATCH', '/api/v1/teams/*', 'updateTeam');
    // Clicking on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();
    cy.get('[data-testid="users"]').click();
    verifyResponseStatusCode('@getUserDetails', 200);
    verifyResponseStatusCode('@permissions', 200);
    cy.get('[data-testid="add-new-user"]').should('be.visible').click();
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="selectable-list"]')
      .find(`[title="${TEAM_DETAILS.username}"]`)
      .click();
    cy.get('[data-testid="selectable-list-update-btn"]')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@updateTeam', 200);
    verifyResponseStatusCode('@getUserDetails', 200);
    cy.get(`[data-testid="${TEAM_DETAILS.userId}"]`).should('not.exist');
  });

  it('Join team should work properly', () => {
    interceptURL('GET', '/api/v1/users*', 'getUsers');
    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    cy.get('[data-testid="users"]').click();

    verifyResponseStatusCode('@getUsers', 200);

    // Click on join teams button
    cy.get('[data-testid="join-teams"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    // Verify toast notification
    toastNotification('Team joined successfully!');

    cy.get('body').find('[data-testid="leave-team-button"]').should('exist');
  });

  it('Update display name for created team', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );
    interceptURL('PATCH', `/api/v1/teams/*`, 'patchTeam');
    // Click on created team name
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    // Click on edit display name
    cy.get('[data-testid="edit-team-name"]').should('be.visible').click();

    // Enter the updated team name
    cy.get('[data-testid="team-name-input"]')
      .should('exist')
      .should('be.visible')
      .clear()
      .type(TEAM_DETAILS.updatedName);

    // Save the updated display name
    cy.get('[data-testid="saveAssociatedTag"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@patchTeam', 200);
    verifyResponseStatusCode('@getSelectedTeam', 200);
    // Validate the updated display name
    cy.get('[data-testid="team-heading"]').then(($el) => {
      cy.wrap($el).should('have.text', TEAM_DETAILS.updatedName);
    });

    cy.get('[data-testid="inactive-link"]')
      .scrollIntoView()
      .should('contain', TEAM_DETAILS.updatedName);
  });

  it('Update description for created team', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}?fields=*&include=all`,
      'getSelectedTeam'
    );
    interceptURL('PATCH', '/api/v1/teams/*', 'patchDescription');
    // Click on created team name
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getSelectedTeam', 200);

    // Validate the updated display name
    cy.get('[data-testid="team-heading"]').should(
      'contain',
      `${TEAM_DETAILS.updatedName}`
    );

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .should('contain', TEAM_DETAILS.updatedName);

    // Click on edit description button
    cy.get('[data-testid="edit-description"]')
      .should('be.visible')
      .click({ force: true });

    // Entering updated description
    cy.get(descriptionBox).clear().type(updatedDescription);

    cy.get('[data-testid="save"]').should('be.visible').click();
    verifyResponseStatusCode('@patchDescription', 200);

    // Validating the updated description
    cy.get('[data-testid="description"] p').should(
      'contain',
      updatedDescription
    );
  });

  it('Leave team flow should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );

    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .contains(TEAM_DETAILS.name);
    // //Click on Leave team
    cy.get('[data-testid="leave-team-button"]').click();

    // //Click on confirm button
    cy.get('[data-testid="save-button"]').should('be.visible').click();

    toastNotification('Left the team successfully');

    cy.get('body').find('[data-testid="join-teams"]').should('exist');
  });

  it('Permanently deleting soft deleted team should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );

    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .contains(TEAM_DETAILS.updatedName);
    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]').should('be.visible');

    cy.get('[data-testid="delete-button-title"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.disabled');

    // Click on soft delete option
    cy.get('[data-testid="soft-delete-option"]')
      .should('contain', TEAM_DETAILS.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

    interceptURL('DELETE', '/api/v1/teams/*', 'softDeleteTeam');

    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@softDeleteTeam', 200);

    // Verify the toast message
    toastNotification('Team deleted successfully!');

    // Check if soft deleted team is shown when 'Deleted Teams' switch is on
    cy.get('table').should('not.contain', TEAM_DETAILS.name);

    cy.get('[data-testid="show-deleted"').should('exist').click();

    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );
    interceptURL(
      'GET',
      `/api/v1/teams?limit=100000&parentTeam=${TEAM_DETAILS.name}&include=all`,
      'getTeamParent'
    );
    interceptURL(
      'GET',
      `/api/v1/teams?fields=userCount%2CchildrenCount%2Cowns%2Cparents&limit=100000&parentTeam=${TEAM_DETAILS.name}&include=all`,
      'getChildrenCount'
    );

    cy.get('table').should('contain', TEAM_DETAILS.name).click();

    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    verifyResponseStatusCode('@getTeamParent', 200);
    verifyResponseStatusCode('@getChildrenCount', 200);

    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .contains(TEAM_DETAILS.updatedName);

    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]').should('be.visible');

    cy.get('[data-testid="delete-button-title"]')
      .should('exist')
      .should('be.visible')
      .click();

    // Check if soft delete option is not present
    cy.get('[data-testid="soft-delete-option"]').should('not.exist');

    // Click on permanent delete option
    cy.get('[data-testid="hard-delete-option"]')
      .should('contain', TEAM_DETAILS.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

    interceptURL('DELETE', '/api/v1/teams/*', 'deleteTeam');
    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@deleteTeam', 200);

    // Verify the toast message
    toastNotification('Team deleted successfully!');

    // Validating the deleted team

    cy.get('table').should('not.contain', TEAM_DETAILS.name);
  });

  it('Permanently deleting a team without soft deleting should work properly', () => {
    // Add a new team
    addTeam(HARD_DELETE_TEAM_DETAILS);

    interceptURL(
      'GET',
      `/api/v1/teams/name/${HARD_DELETE_TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );
    // Click on created team
    cy.get(`[data-row-key="${HARD_DELETE_TEAM_DETAILS.name}"]`)
      .contains(HARD_DELETE_TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    cy.get('[data-testid="manage-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-menu-id*="delete-button"]').should('be.visible');

    cy.get('[data-testid="delete-button-title"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.disabled');

    // Check if soft delete option is present
    cy.get('[data-testid="soft-delete-option"]')
      .should('contain', HARD_DELETE_TEAM_DETAILS.name)
      .should('be.visible');

    // Click on permanent delete option
    cy.get('[data-testid="hard-delete-option"]')
      .should('contain', HARD_DELETE_TEAM_DETAILS.name)
      .should('be.visible')
      .click();

    cy.get('[data-testid="confirmation-text-input"]').type('DELETE');

    interceptURL('DELETE', '/api/v1/teams/*', 'deleteTeam');
    cy.get('[data-testid="confirm-button"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@deleteTeam', 200);

    // Verify the toast message
    toastNotification('Team deleted successfully!');

    // Validating the deleted team

    cy.get('table').should('not.contain', HARD_DELETE_TEAM_DETAILS.name);
  });
});
