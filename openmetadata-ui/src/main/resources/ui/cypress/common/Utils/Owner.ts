/*
 *  Copyright 2023 Collate.
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
import { interceptURL, verifyResponseStatusCode } from '../common';

export const addOwner = (ownerName: string) => {
  interceptURL('GET', '/api/v1/users?limit=*&isBot=false*', 'getUsers');

  cy.get('[data-testid="edit-owner"]').click();

  cy.get("[data-testid='select-owner-tabs']").should('be.visible');
  cy.log('/api/v1/users?limit=*&isBot=false*');
  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(ownerName)}*&index=user_search_index`,
    'searchOwner'
  );

  cy.get('[data-testid="owner-select-users-search-bar"]').type(ownerName);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');

  cy.get(`.ant-popover [title="${ownerName}"]`).click();
  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="owner-link"]').should('contain', ownerName);
};

export const addTeamAsOwner = (teamName: string) => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*&from=0&size=*&index=team_search_index',
    'getTeams'
  );

  cy.get('[data-testid="edit-owner"]').click();

  cy.get("[data-testid='select-owner-tabs']").should('be.visible');

  verifyResponseStatusCode('@getTeams', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(teamName)}*`,
    'searchTeams'
  );

  cy.get('[data-testid="owner-select-teams-search-bar"]').type(teamName);

  verifyResponseStatusCode('@searchTeams', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');

  cy.get(`.ant-popover [title="${teamName}"]`).click();
  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="owner-link"]').should('contain', teamName);
};

export const removeOwner = (ownerName: string) => {
  interceptURL('GET', '/api/v1/users?limit=*&isBot=false*', 'getUsers');

  cy.get('[data-testid="edit-owner"]').click();

  cy.get("[data-testid='select-owner-tabs']").should('be.visible');
  cy.log('/api/v1/users?limit=*&isBot=false*');
  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(ownerName)}*`,
    'searchOwner'
  );

  cy.get('[data-testid="owner-select-users-search-bar"]').type(ownerName);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');

  cy.get('[data-testid="remove-owner"]').click();
  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="owner-link"]').should('not.contain', ownerName);
};

export const addRemoveAsOwner = (teamName: string) => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=*&from=0&size=*&index=team_search_index',
    'getTeams'
  );

  cy.get('[data-testid="edit-owner"]').click();

  cy.get("[data-testid='select-owner-tabs']").should('be.visible');

  verifyResponseStatusCode('@getTeams', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(teamName)}*&index=team_search_index`,
    'searchTeams'
  );

  cy.get('[data-testid="owner-select-teams-search-bar"]').type(teamName);

  verifyResponseStatusCode('@searchTeams', 200);

  interceptURL('PATCH', `/api/v1/**`, 'patchOwner');

  cy.get('[data-testid="remove-owner"]').click();
  verifyResponseStatusCode('@patchOwner', 200);

  cy.get('[data-testid="owner-link"]').should('not.contain', teamName);
};
