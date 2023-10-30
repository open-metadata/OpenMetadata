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
import {
  descriptionBox,
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { SEARCH_ENTITY_TABLE } from '../../constants/constants';

const DATA = {
  ...SEARCH_ENTITY_TABLE.table_5,
  query: `select * from table ${SEARCH_ENTITY_TABLE.table_5.term}`,
  description: 'select all the field from table',
  owner: 'Aaron Johnson',
  tag: 'Personal',
  queryUsedIn: {
    table1: 'dim_address_clean',
    table2: 'raw_product_catalog',
  },
};

describe('Query Entity', () => {
  beforeEach(() => {
    cy.login();
    cy.get("[data-testid='welcome-screen-close-btn']").click();
  });

  it('Create query', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');
    interceptURL('POST', '/api/v1/queries', 'createQuery');
    visitEntityDetailsPage(DATA.term, DATA.serviceName, DATA.entity);
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    cy.get('[data-testid="add-query-btn"]').click();

    cy.get('[data-testid="code-mirror-container"]').type(DATA.query);
    cy.get(descriptionBox).scrollIntoView().type(DATA.description);
    cy.get('[data-testid="query-used-in"]').type(DATA.queryUsedIn.table1);
    verifyResponseStatusCode('@explorePageSearch', 200);
    cy.get(`[title="${DATA.queryUsedIn.table1}"]`).scrollIntoView().click();
    cy.clickOutside();

    cy.get('[data-testid="save-btn"]').click();
    verifyResponseStatusCode('@createQuery', 201);

    cy.get('[data-testid="query-card"]').should('have.length.above', 0);
    cy.get('[data-testid="query-card"]')
      .contains(DATA.query)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Update owner, description and tag', () => {
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');
    interceptURL('GET', '/api/v1/users?*', 'getUsers');
    interceptURL('PATCH', '/api/v1/queries/*', 'patchQuery');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
    visitEntityDetailsPage(DATA.term, DATA.serviceName, DATA.entity);
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    cy.get('[data-testid="query-card"]').should('have.length.above', 0);

    // Update owner
    cy.get(':nth-child(2) > [data-testid="edit-owner"]').click();
    verifyResponseStatusCode('@getUsers', 200);
    interceptURL(
      'GET',
      `api/v1/search/query?q=*${encodeURI(DATA.owner)}*`,
      'searchOwner'
    );
    cy.get('[data-testid="owner-select-users-search-bar"]').type(DATA.owner);
    verifyResponseStatusCode('@searchOwner', 200);
    cy.get(`.ant-popover [title="${DATA.owner}"]`).click();
    verifyResponseStatusCode('@patchQuery', 200);
    cy.get('[data-testid="owner-link"]').should('contain', DATA.owner);

    // Update Description
    cy.get('[data-testid="edit-description-btn"]').click();
    cy.get(descriptionBox).clear().type('updated description');
    cy.get('[data-testid="save"]').click();
    verifyResponseStatusCode('@patchQuery', 200);

    // Update Tags
    cy.get('[data-testid="entity-tags"] .ant-tag').click();
    cy.get('[data-testid="tag-selector"]').type(DATA.tag);
    cy.get('[data-testid="tag-PersonalData.Personal"]').click();
    cy.clickOutside();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@patchQuery', 200);
  });

  it('Update query and QueryUsedIn', () => {
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');
    interceptURL('GET', '/api/v1/users?&isBot=false&limit=15', 'getUsers');
    interceptURL('PATCH', '/api/v1/queries/*', 'patchQuery');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
    visitEntityDetailsPage(DATA.term, DATA.serviceName, DATA.entity);
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    cy.get('[data-testid="more-option-btn"]').click();
    cy.get('[data-menu-id*="edit-query"]').click();
    cy.get('.CodeMirror-line')
      .click()
      .type(`{selectAll}{selectAll}${DATA.queryUsedIn.table1}`);
    cy.get('[data-testid="edit-query-used-in"]').type(DATA.queryUsedIn.table2);
    verifyResponseStatusCode('@explorePageSearch', 200);
    cy.get(`[title="${DATA.queryUsedIn.table2}"]`).click();
    cy.clickOutside();

    cy.get('[data-testid="save-query-btn"]').click();
    verifyResponseStatusCode('@patchQuery', 200);
  });

  it('Visit full screen view of query', () => {
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');
    interceptURL('GET', '/api/v1/users?&isBot=false&limit=15', 'getUsers');
    interceptURL('GET', '/api/v1/queries/*', 'getQueryById');
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
    visitEntityDetailsPage(DATA.term, DATA.serviceName, DATA.entity);
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);
    cy.get('[data-testid="query-entity-expand-button"]').click();
    verifyResponseStatusCode('@getQueryById', 200);

    cy.get('[data-testid="more-option-btn"]').click();
    cy.get('.ant-dropdown').should('be.visible');
    cy.get('[data-menu-id*="delete-query"]').click();
    cy.get('[data-testid="save-button"]').click();
  });
});
