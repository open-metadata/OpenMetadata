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
} from '../../common/common';
import {
  createEntityTable,
  createQueryByTableName,
  generateRandomTable,
  hardDeleteService,
} from '../../common/EntityUtils';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { DATA_ASSETS } from '../../constants/constants';
import {
  DATABASE_SERVICE,
  DATABASE_SERVICE_DETAILS,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const queryTable = {
  term: DATABASE_SERVICE.entity.name,
  displayName: DATABASE_SERVICE.entity.name,
  entity: DATA_ASSETS.tables,
  serviceName: DATABASE_SERVICE.service.name,
  entityType: 'Table',
};
const table1 = generateRandomTable();
const table2 = generateRandomTable();

const DATA = {
  ...queryTable,
  query: `select * from table ${queryTable.term}`,
  description: 'select all the field from table',
  owner: 'Aaron Johnson',
  tag: 'Personal',
  queryUsedIn: {
    table1: table1.name,
    table2: table2.name,
  },
};

describe('Query Entity', { tags: 'DataAssets' }, () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity, table1, table2],
      });
      // get Table by name and create query in the table
      createQueryByTableName(token, table1);
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
  });

  it('Create query', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');
    interceptURL('POST', '/api/v1/queries', 'createQuery');
    visitEntityDetailsPage({
      term: DATA.term,
      serviceName: DATA.serviceName,
      entity: DATA.entity,
    });
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    cy.get('[data-testid="add-query-btn"]').click();

    cy.get('[data-testid="code-mirror-container"]').type(DATA.query);
    cy.get(descriptionBox).scrollIntoView().type(DATA.description);
    cy.get('[data-testid="query-used-in"]').type(DATA.queryUsedIn.table1);
    verifyResponseStatusCode('@explorePageSearch', 200);
    cy.get(`[title="${DATA.queryUsedIn.table1}"]`).click();
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
    visitEntityDetailsPage({
      term: DATA.term,
      serviceName: DATA.serviceName,
      entity: DATA.entity,
    });
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
    cy.get('[data-testid="entity-tags"] .ant-tag').filter(':visible').click();
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
    visitEntityDetailsPage({
      term: DATA.term,
      serviceName: DATA.serviceName,
      entity: DATA.entity,
    });
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    cy.get('[data-testid="query-btn"]').click();
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

    visitEntityDetailsPage({
      term: DATA.term,
      serviceName: DATA.serviceName,
      entity: DATA.entity,
    });
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);
    cy.get('[data-testid="query-entity-expand-button"]').click();
    verifyResponseStatusCode('@getQueryById', 200);

    cy.get('[data-testid="query-btn"]').click();
    cy.get('.ant-dropdown').should('be.visible');
    cy.get('[data-menu-id*="delete-query"]').click();
    cy.get('[data-testid="save-button"]').click();
  });

  it('Verify query duration', () => {
    interceptURL('GET', '/api/v1/queries?*', 'fetchQuery');

    visitEntityDetailsPage({
      term: table1.name,
      serviceName: DATABASE_SERVICE_DETAILS.name,
      entity: DATA.entity,
    });

    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);

    // Validate that the duration is in sec or not
    cy.get('[data-testid="query-run-duration"]')
      .should('be.visible')
      .should('contain', '6.199 sec');
  });
});
