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
import { getToken } from '../../common/Utils/LocalStorage';
import { generateRandomUser } from '../../common/Utils/Owner';
import { EntityType } from '../../constants/Entity.interface';
import {
  DATABASE_SERVICE,
  DATABASE_SERVICE_DETAILS,
} from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

const queryTable = {
  term: DATABASE_SERVICE.entity.name,
  displayName: DATABASE_SERVICE.entity.name,
  entity: EntityType.Table,
  serviceName: DATABASE_SERVICE.service.name,
  entityType: 'Table',
};
const table1 = generateRandomTable();
const table2 = generateRandomTable();
const user = generateRandomUser();
let userId = '';

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

const queryFilters = ({
  key,
  filter,
  apiKey,
}: {
  key: string;
  filter: string;
  apiKey: string;
}) => {
  cy.get(`[data-testid="search-dropdown-${key}"]`).click();
  cy.get('[data-testid="search-input"]').type(filter);
  verifyResponseStatusCode(apiKey, 200);
  cy.get(`[data-testid="search-dropdown-${key}"]`).trigger('mouseout');
  cy.get(`[data-testid="drop-down-menu"] [title="${filter}"]`).click();
  cy.get('[data-testid="update-btn"]').click();
  verifyResponseStatusCode('@fetchQuery', 200);
};

describe('Query Entity', { tags: 'DataAssets' }, () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity, table1, table2],
      });
      // get Table by name and create query in the table
      createQueryByTableName(token, table1);

      // Create a new user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: user,
      }).then((response) => {
        userId = response.body.id;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${userId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  beforeEach(() => {
    cy.login();
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&index=query_search_index*',
      'fetchQuery'
    );
  });

  it('Create query', () => {
    interceptURL(
      'GET',
      '/api/v1/search/query?q=*&from=0&size=15&index=table_search_index',
      'explorePageSearch'
    );
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
    cy.get('[data-testid="loader"]').should('not.exist');
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
    cy.get('[data-testid="edit-description"]').filter(':visible').click();
    cy.get(descriptionBox).clear().type('updated description');
    cy.get('[data-testid="save"]').click();
    verifyResponseStatusCode('@patchQuery', 200);

    // Update Tags
    cy.get('[data-testid="entity-tags"] .ant-tag').filter(':visible').click();
    cy.get('[data-testid="tag-selector"]').type(DATA.tag);
    cy.get('[data-testid="tag-PersonalData.Personal"]').click();
    cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
    verifyResponseStatusCode('@patchQuery', 200);
  });

  it('Verify query filter', () => {
    visitEntityDetailsPage({
      term: DATA.term,
      serviceName: DATA.serviceName,
      entity: DATA.entity,
    });
    cy.get('[data-testid="table_queries"]').click();
    verifyResponseStatusCode('@fetchQuery', 200);
    const userName = `${user.firstName}${user.lastName}`;
    interceptURL(
      'GET',
      `/api/v1/search/query?*${encodeURI(
        userName
      )}*index=user_search_index,team_search_index*`,
      'searchUserName'
    );
    queryFilters({
      filter: `${user.firstName}${user.lastName}`,
      apiKey: '@searchUserName',
      key: 'Owner',
    });
    interceptURL(
      'GET',
      `/api/v1/search/query?*${encodeURI(
        DATA.owner
      )}*index=user_search_index,team_search_index*`,
      'searchOwner'
    );
    cy.get('[data-testid="no-data-placeholder"]').should('be.visible');
    queryFilters({
      filter: DATA.owner,
      apiKey: '@searchOwner',
      key: 'Owner',
    });
    interceptURL(
      'GET',
      '/api/v1/search/query?*None*index=tag_search_index*',
      'noneTagSearch'
    );
    cy.get('[data-testid="query-card"]').should('have.length.above', 0);
    queryFilters({
      filter: 'None',
      apiKey: '@noneTagSearch',
      key: 'Tag',
    });
    interceptURL(
      'GET',
      `/api/v1/search/query?*${DATA.tag}*index=tag_search_index*`,
      'personalTagSearch'
    );
    cy.get('[data-testid="no-data-placeholder"]').should('be.visible');
    queryFilters({
      filter: DATA.tag,
      apiKey: '@personalTagSearch',
      key: 'Tag',
    });
    cy.get('[data-testid="query-card"]').should('have.length.above', 0);
  });

  it('Update query and QueryUsedIn', () => {
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
