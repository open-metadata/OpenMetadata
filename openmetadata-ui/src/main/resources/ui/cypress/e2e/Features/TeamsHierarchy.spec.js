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
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../../common/common';

const buTeamName = `bu-${uuid()}`;
const divTeamName = `div-${uuid()}`;
const depTeamName = `dep-${uuid()}`;
const grpTeamName = `grp-${uuid()}`;
const teamNames = [buTeamName, divTeamName, depTeamName, grpTeamName];
const getTeam = (teamName) => {
  return {
    name: teamName,
    displayName: teamName,
    teamType: 'BusinessUnit',
    description: `Team ${teamName} Description`,
    ownername: 'admin',
  };
};

describe('Add nested teams and test TeamsSelectable', () => {
  beforeEach(() => {
    cy.login();

    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    interceptURL('GET', '/api/v1/users*', 'getTeams');
    // Clicking on teams
    cy.get('[data-menu-id*="teams"]')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getTeams', 200);
  });

  it('Add teams', () => {
    interceptURL('GET', '/api/v1/permissions/team/*', 'getPermissions');
    teamNames.forEach((teamName) => {
      addTeam(getTeam(teamName));

      cy.reload();
      interceptURL(
        'GET',
        '/api/v1/search/query?q=*&from=*&size=*&index=*',
        'getCreatedTeam'
      );
      // asserting the added values
      cy.get('table').find('.ant-table-row').contains(teamName).click();

      verifyResponseStatusCode('@getCreatedTeam', 200);
    });

    verifyResponseStatusCode('@getPermissions', 200);
    cy.wait(1000);
  });

  it('Check hierarchy in Add User page', () => {
    // Clicking on users
    cy.get('[data-menu-id*="users"]')
      .should('exist')
      .should('be.visible')
      .click();

    cy.get('[data-testid="add-user"]').should('be.visible').click();

    // Enter team name
    cy.get('#create-user-bot-form .ant-select-selector')
      .should('exist')
      .scrollIntoView()
      .should('be.visible')
      .click()
      .type(buTeamName);

    teamNames.forEach((teamName) => {
      cy.get('.ant-tree-select-dropdown')
        .contains(teamName)
        .should('be.visible');
    });

    teamNames.forEach((teamName) => {
      cy.get('#create-user-bot-form .ant-select-selector')
        .should('exist')
        .scrollIntoView()
        .should('be.visible')
        .click()
        .type(teamName);
      cy.get('.ant-tree-select-dropdown')
        .contains(teamName)
        .should('be.visible');
    });
  });
});
