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

import {
  addTeam,
  descriptionBox,
  interceptURL,
  toastNotification,
  updateOwner,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';

const updateddescription = 'This is updated description';

const teamName = `team-ct-test-${uuid()}`;
const TEAM_DETAILS = {
  name: teamName,
  updatedname: `${teamName}-updated`,
  teamType: 'Department',
  description: `This is ${teamName} description`,
  username: 'Aaron Johnson',
  assetname: 'dim_address',
};
const hardDeleteTeamName = `team-ct-test-${uuid()}`;
const HARD_DELETE_TEAM_DETAILS = {
  name: hardDeleteTeamName,
  displayName: hardDeleteTeamName,
  teamType: 'Department',
  description: `This is ${hardDeleteTeamName} description`,
};

describe('Teams flow should work properly', () => {
  beforeEach(() => {
    interceptURL('GET', `/api/v1/users?fields=*`, 'getUserDetails');
    cy.login();

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();

    // Clicking on teams
    cy.get('[data-testid="settings-left-panel"]')
      .should('exist')
      .should('be.visible')
      .click();
  });

  it('Add new team', () => {
    addTeam(TEAM_DETAILS);

    cy.reload();

    // asserting the added values
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .should('exist')
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

  // Todo:- Enable this once the issue is fixed -> https://github.com/open-metadata/OpenMetadata/issues/9801
  it.skip('Add user to created team', () => {
    interceptURL(
      'GET',
      `/api/v1/users?fields=teams,roles&team=${TEAM_DETAILS.name}&limit=15`,
      'getUsers'
    );
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}?*`,
      'getSelectedTeam'
    );
    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    cy.wait('@getSelectedTeam').then(() => {
      cy.get('[data-testid="team-heading"]')
        .should('be.visible')
        .and('contain', TEAM_DETAILS.name);
    });
    verifyResponseStatusCode('@getUsers', 200);
    // Clicking on users tab
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .trigger('click');

    interceptURL('GET', '/api/v1/users?limit=15', 'addUser');
    interceptURL('GET', '/api/v1/users/*', 'getUsers');
    cy.get('[data-testid="add-user"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@addUser', 200);
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="searchbar"]').type(TEAM_DETAILS.username);

    cy.wait(500);

    cy.get('[data-testid="data-container"]').should(
      'contain',
      TEAM_DETAILS.username
    );
    cy.get('[data-testid="checkboxAddUser"]')
      .first()
      .should('be.visible')
      .click();

    // Saving the added user
    interceptURL('PATCH', '/api/v1/teams/*', 'saveUser');
    interceptURL(
      'GET',
      'api/v1/teams/name/Organization?fields=parents&include=all',
      'getSelectedTeam'
    );
    cy.get('[id="save-button"]').should('be.visible').click();
    verifyResponseStatusCode('@saveUser', 200);
    verifyResponseStatusCode('@getSelectedTeam', 200);
    // Asseting the added user
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('.ant-table-row').should('contain', TEAM_DETAILS.username);
  });

  // Todo:- Enable this once the issue is fixed -> https://github.com/open-metadata/OpenMetadata/issues/9801
  it.skip('Remove added user from created team', () => {
    interceptURL(
      'GET',
      `/api/v1/users?fields=*&team=${TEAM_DETAILS.name}&limit=15`,
      'getUsers'
    );
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}?*`,
      'getSelectedTeam'
    );
    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    cy.wait('@getSelectedTeam').then(() => {
      cy.get('[data-testid="team-heading"]')
        .should('be.visible')
        .within(() => {
          cy.contains(TEAM_DETAILS.name).should('be.visible');
        });
    });
    verifyResponseStatusCode('@getUsers', 200);
    // Clicking on users tab
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .trigger('click');

    cy.get('.ant-table-row').should('contain', TEAM_DETAILS.username);

    cy.get('[data-testid="remove-user-btn"]')
      .should('exist')
      .should('be.visible')
      .click();

    // Validating the user added
    cy.get('[data-testid="body-text"]').should(
      'contain',
      `Are you sure you want to Remove ${TEAM_DETAILS.username}`
    );

    interceptURL('PATCH', '/api/v1/teams/*', 'deleteUser');
    // Click on confirm button
    cy.get('[data-testid="save-button"]').should('be.visible').click();

    cy.wait(['@deleteUser', '@getSelectedTeam', '@getUsers']);

    // Verify if user is removed
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('table').should('not.exist');

    cy.get('body').should('not.contain', TEAM_DETAILS.username);
  });

  it('Join team should work properly', () => {
    interceptURL('GET', '/api/v1/users*', 'getUsers');
    // Click on created team
    cy.get(`[data-row-key="${TEAM_DETAILS.name}"]`)
      .contains(TEAM_DETAILS.name)
      .click();

    verifyResponseStatusCode('@getUsers', 200);

    // Click on join teams button
    cy.get('[data-testid="join-teams"]').should('be.visible').click();

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
    verifyResponseStatusCode('@getUserDetails', 200);
    // Click on edit display name
    cy.get('[data-testid="edit-synonyms"]').should('be.visible').click();

    // Enter the updated team name
    cy.get('[data-testid="synonyms"]')
      .should('exist')
      .should('be.visible')
      .clear()
      .type(TEAM_DETAILS.updatedname);

    // Save the updated display name
    cy.get('[data-testid="saveAssociatedTag"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@patchTeam', 200);
    verifyResponseStatusCode('@getSelectedTeam', 200);
    verifyResponseStatusCode('@getUserDetails', 200);
    // Validate the updated display name
    cy.get('[data-testid="team-heading"]').then(($el) => {
      cy.wrap($el).should('have.text', TEAM_DETAILS.updatedname);
    });

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .should('contain', TEAM_DETAILS.updatedname);
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
    verifyResponseStatusCode('@getUserDetails', 200);

    // Validate the updated display name
    cy.get('[data-testid="team-heading"]').should(
      'contain',
      `${TEAM_DETAILS.updatedname}`
    );

    cy.get('[data-testid="inactive-link"]')
      .should('be.visible')
      .should('contain', TEAM_DETAILS.updatedname);

    // Click on edit description button
    cy.get('[data-testid="edit-description"]')
      .should('be.visible')
      .click({ force: true });

    // Entering updated description
    cy.get(descriptionBox).clear().type(updateddescription);

    cy.get('[data-testid="save"]').should('be.visible').click();
    verifyResponseStatusCode('@patchDescription', 200);

    // Validating the updated description
    cy.get('[data-testid="description"] p').should(
      'contain',
      updateddescription
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
    verifyResponseStatusCode('@getUserDetails', 200);
    // //Click on Leave team
    cy.get('[data-testid="leave-team-button"]').should('be.visible').click();

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
      .contains(TEAM_DETAILS.updatedname);
    verifyResponseStatusCode('@getUserDetails', 200);
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

    cy.get('[data-testid="teams-dropdown"]').should('exist').click();

    cy.get('[data-testid="deleted-menu-item-switch"').should('exist').click();

    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );

    cy.get('table').should('contain', TEAM_DETAILS.name).click();

    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    cy.get('[data-testid="team-heading"]')
      .should('be.visible')
      .contains(TEAM_DETAILS.updatedname);
    verifyResponseStatusCode('@getUserDetails', 200);

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
    verifyResponseStatusCode('@getUserDetails', 200);
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
