/*
 *  Copyright 2021 Collate
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

import { descriptionBox, interceptURL, toastNotification, updateOwner, uuid, verifyResponseStatusCode } from '../../common/common';

const updateddescription = 'This is updated description';

const teamName = `team-ct-test-${uuid()}`;
const TEAM_DETAILS = {
  name: teamName,
  displayName: teamName,
  updatedname: `${teamName}-updated`,
  description: `This is ${teamName} description`,
  ownername: 'Aaron Johnson',
  assetname: 'dim_address',
};

describe('Teams flow should work properly', () => {
  beforeEach(() => {
    cy.goToHomePage();

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    interceptURL('GET', '/api/v1/users*', 'getTeams');
    //Clicking on teams
    cy.get('[data-menu-id*="teams"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getTeams', 200);
  });

  it('Add new team', () => {
    interceptURL('GET', '/api/v1/teams*', 'addTeam');
    //Fetching the add button and clicking on it
    cy.get('button')
      .find('span')
      .contains('Add Team')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@addTeam', 200);

    //Entering team details
    cy.get('[data-testid="name"]')
      .should('exist')
      .should('be.visible')
      .type(TEAM_DETAILS.name);

    cy.get('[data-testid="display-name"]')
      .should('exist')
      .should('be.visible')
      .type(TEAM_DETAILS.displayName);

    cy.get(descriptionBox)
      .should('exist')
      .should('be.visible')
      .type(TEAM_DETAILS.description);
    interceptURL('POST', '/api/v1/teams', 'saveTeam');
    interceptURL('GET', '/api/v1/team*', 'createTeam');

    //Saving the created team
    cy.get('[form="add-team-form"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@saveTeam', 201);
    verifyResponseStatusCode('@createTeam', 200);

    cy.reload();

    //asserting the added values
    cy.get('table').find('.ant-table-row').should('contain', TEAM_DETAILS.name);
    cy.get('table')
      .find('.ant-table-row')
      .should('contain', TEAM_DETAILS.description);
  });

  it('Add owner to created team', () => {
    //Clicking on created team
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();
    updateOwner();
  });

  it('Add user to created team', () => {
    //Click on created team
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    //Clicking on users tab
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .click();

    interceptURL('GET', '/api/v1/users?limit=100000', 'addUser');
    interceptURL('GET', '/api/v1/users/*', 'getUsers');
    cy.get('[data-testid="add-user"]')
      .scrollIntoView()
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@addUser', 200);
    verifyResponseStatusCode('@getUsers', 200);
    cy.get('[data-testid="searchbar"]').type(TEAM_DETAILS.ownername);

    cy.wait(500);

    cy.get('[data-testid="data-container"]').should(
      'contain',
      TEAM_DETAILS.ownername
    );
    cy.get('[data-testid="checkboxAddUser"]')
      .first()
      .should('be.visible')
      .click();

    //Saving the added user
    interceptURL('PATCH', '/api/v1/teams/*', 'saveUser');
    cy.get('[data-testid="AddUserSave"]').should('be.visible').click();
    verifyResponseStatusCode('@saveUser', 200);
    //Asseting the added user
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('.ant-table-row').should('contain', TEAM_DETAILS.ownername);

    //Removing the added user
    cy.get('[data-testid="remove-user-btn"] > [data-testid="image"]')
      .should('exist')
      .should('be.visible')
      .click();

    //Validating the user added
    cy.get('[data-testid="body-text"]').should(
      'contain',
      TEAM_DETAILS.ownername
    );

    //Click on confirm button
    cy.get('[data-testid="save-button"]').should('be.visible').click();

    verifyResponseStatusCode('@saveUser', 200);

    //Verify if user is removed
    cy.get('[data-testid="Users"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="add-user"]').should(
      'not.contain',
      TEAM_DETAILS.ownername
    );
  });

  it('Join team should work properly', () => {
    //Click on created team
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    //Click on join teams button
    cy.get('[data-testid="join-teams"]').should('be.visible').click();

    //Verify toast notification
    toastNotification('Team joined successfully!');

    cy.get('body').find('[data-testid="leave-team-button"]').should('exist');
  });

  it('Update description and display name for created team', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );
    //Click on created team name
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    //Click on edit display name
    cy.get('[data-testid="edit-synonyms"]').should('be.visible').click();

    //Enter the updated team name
    cy.get('[data-testid="synonyms"]')
      .should('exist')
      .should('be.visible')
      .clear()
      .type(TEAM_DETAILS.updatedname);

    interceptURL('PATCH', 'api/v1/teams/*', 'saveTeamName');
    interceptURL('GET', '/api/v1/users*', 'updatedTeam');
    //Save the updated display name
    cy.get('[data-testid="saveAssociatedTag"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@saveTeamName', 200);
    //Validate the updated display name
    cy.get('[data-testid="header"]')
      .find('.ant-typography')
      .should('contain', TEAM_DETAILS.updatedname);
    verifyResponseStatusCode('@updatedTeam', 200);

    //Click on edit description button
    cy.get('[data-testid="edit-description"]').should('be.visible').click();

    //Entering updated description
    cy.get(descriptionBox).clear().type(updateddescription);

    cy.get('[data-testid="save"]').should('be.visible').click();
    //Validating the updated description
    cy.get('[data-testid="description"] p').should(
      'contain',
      updateddescription
    );
  });

  it.skip('Asset tab should work properly', () => {
    //Click on created team name
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    cy.wait(500);

    //Click on Asset tab
    cy.get('[data-testid="Assets"]').should('be.visible').click();

    //Click on explore tab
    cy.get('.button-comp').contains('Explore').should('be.visible').click();

    cy.wait(1000);

    //Navigate to the asset name
    cy.get('[data-testid="searchBox"]')
      .should('exist')
      .type(TEAM_DETAILS.assetname);

    cy.get('[data-testid="data-name"]')
      .contains(TEAM_DETAILS.assetname)
      .should('exist')
      .should('be.visible')
      .click();

    //Click on owner icon
    cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

    cy.wait(1000);

    //Select the created team
    cy.get('[data-testid="list-item"]')
      .contains(TEAM_DETAILS.updatedname)
      .should('be.visible')
      .click();

    cy.wait(1000);

    cy.reload();

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    //Clicking on teams
    cy.get('[data-menu-id*="teams"]')
      .should('exist')
      .should('be.visible')
      .click();

    //Click on created table
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();
    //Click on asset tab
    cy.get('[data-testid="Assets"]').should('be.visible').click();

    //Verify the added asset
    cy.get('[data-testid="user-card-container"]')
      .find('[data-testid="dataset-link"]')
      .should('contain', TEAM_DETAILS.assetname);
  });

  it('Leave team flow should work properly', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );

    //Click on created team
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

    verifyResponseStatusCode('@getSelectedTeam', 200);
    // //Click on Leave team
    cy.get('[data-testid="leave-team-button"]').should('be.visible').click();

    // //Click on confirm button
    cy.get('[data-testid="save-button"]').should('be.visible').click();

    toastNotification('Left the team successfully');

    cy.get('body').find('[data-testid="join-teams"]').should('exist');
  });

  it('Delete created team', () => {
    interceptURL(
      'GET',
      `/api/v1/teams/name/${TEAM_DETAILS.name}*`,
      'getSelectedTeam'
    );
    //Click on created team
    cy.get('table').find('.ant-table-row').contains(TEAM_DETAILS.name).click();

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

    //Click on permanent delete option
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

    //Verify the toast message
    toastNotification('Team deleted successfully!');

    //Validating the deleted team

    cy.get('table').should('not.contain', TEAM_DETAILS.name);
  });
});
