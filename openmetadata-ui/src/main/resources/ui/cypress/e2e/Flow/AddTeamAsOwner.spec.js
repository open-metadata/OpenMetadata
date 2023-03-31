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
  visitEntityDetailsPage,
} from '../../common/common';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

const teamName = `team-group-test-${uuid()}`;
const TEAM_DETAILS = {
  name: teamName,
  teamType: 'Group',
  description: `This is ${teamName} description`,
  ...SEARCH_ENTITY_TABLE.table_1,
};

describe('Create a team and add that team as a owner of the entity', () => {
  beforeEach(() => {
    cy.login();
  });

  /**
   * Here we are adding team of type group as
   * Only team of type group can own the entities
   */
  it('Add a group team type and assign it as a owner of the entity', () => {
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    interceptURL('GET', '/api/v1/users*', 'getTeams');

    // Clicking on teams
    cy.get('[data-testid="settings-left-panel"]')
      .contains('Teams')
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getTeams', 200);

    addTeam(TEAM_DETAILS);

    cy.reload();

    /**
     * Check for added team details
     */
    cy.get('table').find('.ant-table-row').should('contain', TEAM_DETAILS.name);
    cy.get('table')
      .find('.ant-table-row')
      .should('contain', TEAM_DETAILS.description);

    visitEntityDetailsPage(
      TEAM_DETAILS.term,
      TEAM_DETAILS.serviceName,
      TEAM_DETAILS.entity
    );

    interceptURL(
      'GET',
      '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=15&index=team_search_index',
      'waitForTeams'
    );

    cy.get('[data-testid="edit-owner"]').should('be.visible').click();

    verifyResponseStatusCode('@waitForTeams', 200);

    interceptURL('PATCH', '/api/v1/tables/*', 'validateOwner');

    interceptURL(
      'GET',
      `/api/v1/search/query?q=*${TEAM_DETAILS.name}*%20AND%20teamType:Group&from=0&size=15&index=team_search_index`,
      'searchTeamName'
    );
    cy.get('.user-team-select-popover  [data-testid="searchbar"]')
      .should('be.visible')
      .type(TEAM_DETAILS.name);
    verifyResponseStatusCode('@searchTeamName', 200);

    // Selecting the team
    cy.get(`[title="${TEAM_DETAILS.name}"]`)
      .should('exist')
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@validateOwner', 200);

    cy.get('[data-testid="owner-link"]')
      .scrollIntoView()
      .invoke('text')
      .then((text) => {
        expect(text).equal(TEAM_DETAILS.name);
      });
  });
});
