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
/// <reference types="cypress" />
import {
  addTeam,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import { DATA_ASSETS } from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const teamName = `team-group-test-${uuid()}`;
const TEAM_DETAILS = {
  name: teamName,
  teamType: 'Group',
  description: `This is ${teamName} description`,
  email: 'team@gmail.com',
  term: DATABASE_SERVICE.entity.name,
  displayName: DATABASE_SERVICE.entity.name,
  entity: DATA_ASSETS.tables,
  serviceName: DATABASE_SERVICE.service.name,
  entityType: 'Table',
};

describe('Create a team and add that team as a owner of the entity', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
    });
  });

  beforeEach(() => {
    cy.login();
    interceptURL(
      'GET',
      `/api/v1/search/query?q=*teamType:Group&from=0&size=*&index=team_search_index`,
      'waitForTeams'
    );
    interceptURL('PATCH', `/api/v1/tables/*`, 'updateTable');
  });

  /**
   * Here we are adding team of type group as
   * Only team of type group can own the entities
   */
  it('Add a group team type and assign it as a owner of the entity', () => {
    interceptURL('GET', '/api/v1/teams/name/*', 'getTeams');

    cy.get('[data-testid="app-bar-item-settings"]').click();

    // Clicking on teams
    cy.get('[data-testid="settings-left-panel"]').contains('Teams').click();

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
  });

  it('Add newly created group type team as owner, and remove it', () => {
    visitEntityDetailsPage({
      term: TEAM_DETAILS.term,
      serviceName: TEAM_DETAILS.serviceName,
      entity: TEAM_DETAILS.entity,
    });

    cy.get('[data-testid="edit-owner"]').click();
    verifyResponseStatusCode('@waitForTeams', 200);
    cy.get('[data-testid="owner-select-teams-search-bar"]').type(
      TEAM_DETAILS.name
    );

    // Selecting the team
    cy.get(`[title="${TEAM_DETAILS.name}"]`).click();

    verifyResponseStatusCode('@updateTable', 200);

    cy.get('[data-testid="owner-link"]')
      .scrollIntoView()
      .invoke('text')
      .then((text) => {
        expect(text).equal(TEAM_DETAILS.name);
      });
  });

  it('Remove newly created group type team as owner', () => {
    visitEntityDetailsPage({
      term: TEAM_DETAILS.term,
      serviceName: TEAM_DETAILS.serviceName,
      entity: TEAM_DETAILS.entity,
    });

    cy.get('[data-testid="edit-owner"]').click();
    verifyResponseStatusCode('@waitForTeams', 200);
    cy.get('[data-testid="owner-select-teams-search-bar"]').type(
      TEAM_DETAILS.name
    );

    cy.get('[data-testid="remove-owner"]').click();
    verifyResponseStatusCode('@updateTable', 200);
    cy.get('[data-testid="owner-link"]').should(
      'not.contain',
      TEAM_DETAILS.name
    );
  });

  it('Delete newly created team', () => {
    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'GET',
      url: `/api/v1/teams/name/${teamName}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      cy.request({
        method: 'GET',
        url: `/api/v1/teams/${response.body.id}?hardDelete=true&recursive=true`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        expect(response.status).to.eq(200);
      });
    });
  });
});
