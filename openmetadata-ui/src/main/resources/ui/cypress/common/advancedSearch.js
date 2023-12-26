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

import { SEARCH_ENTITY_TABLE } from '../constants/constants';
import {
  DATABASE_DETAILS,
  DATABASE_SERVICE_DETAILS,
  SCHEMA_DETAILS,
  TABLE_DETAILS,
} from '../constants/EntityConstant';
import { USER_CREDENTIALS } from '../constants/SearchIndexDetails.constants';
import {
  interceptURL,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from './common';
import { createEntityTable } from './EntityUtils';

export const ADVANCE_SEARCH_TABLES = {
  table1: TABLE_DETAILS,
  table2: {
    name: `cy-table2-${uuid()}`,
    description: 'description',
    columns: [
      {
        name: 'cypress_first_name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'First name of the staff member.',
      },
      {
        name: 'cypress_last_name',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
      },
      {
        name: 'cypress_email',
        dataType: 'VARCHAR',
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Email address of the staff member.',
      },
    ],
    databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
  },
  table3: {
    name: `cy-table3-${uuid()}`,
    description: 'description',
    columns: [
      {
        name: 'cypress_user_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'Unique identifier for the user of your Shopify POS or your Shopify admin.',
      },
      {
        name: 'cypress_shop_id',
        dataType: 'NUMERIC',
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the store. This column is a foreign key reference to the shop_id column in the dim.shop table.',
      },
    ],
    databaseSchema: `${DATABASE_SERVICE_DETAILS.name}.${DATABASE_DETAILS.name}.${SCHEMA_DETAILS.name}`,
  },
};

export const ADVANCE_SEARCH_DATABASE_SERVICE = {
  service: DATABASE_SERVICE_DETAILS,
  database: DATABASE_DETAILS,
  schema: SCHEMA_DETAILS,
  tables: Object.values(ADVANCE_SEARCH_TABLES),
};

export const CONDITIONS_MUST = {
  equalTo: {
    name: '==',
    filter: 'must',
  },
  anyIn: {
    name: 'Any in',
    filter: 'must',
  },
  contains: {
    name: 'Contains',
    filter: 'must',
  },
};

export const CONDITIONS_MUST_NOT = {
  notEqualTo: {
    name: '!=',
    filter: 'must_not',
  },
  notIn: {
    name: 'Not in',
    filter: 'must_not',
  },
  notContains: {
    name: 'Not contains',
    filter: 'must_not',
  },
};
const ownerFullName = `${USER_CREDENTIALS.firstName}${USER_CREDENTIALS.lastName}`;

export const FIELDS = {
  Owner: {
    name: 'Owner',
    testid: '[title="Owner"]',
    searchTerm1: ownerFullName,
    searchCriteriaFirstGroup: ownerFullName,
    responseValueFirstGroup: `"displayName":"${ownerFullName}"`,
    searchCriteriaSecondGroup: 'Aaron Singh',
    owner: true,
    responseValueSecondGroup: 'Aaron Singh',
  },
  Tags: {
    name: 'Tags',
    testid: '[title="Tags"]',
    createTagName: 'Personal',
    searchCriteriaFirstGroup: 'PersonalData.Personal',
    responseValueFirstGroup: '"tagFQN":"PersonalData.Personal"',
    searchCriteriaSecondGroup: 'PersonalData.SpecialCategory',
    responseValueSecondGroup: '"tagFQN":"PersonalData.SpecialCategory"',
  },
  // skipping tier for now, as it is not working, BE need to fix it

  // Tiers: {
  //   name: 'Tier',
  //   testid: '[title="Tier"]',
  //   searchCriteriaFirstGroup: 'Tier.Tier1',
  //   responseValueFirstGroup: '"tagFQN":"Tier.Tier1"',
  //   searchCriteriaSecondGroup: 'Tier.Tier2',
  //   responseValueSecondGroup: '"tagFQN":"Tier.Tier2"',
  // },
  Service: {
    name: 'Service',
    testid: '[title="Service"]',
    searchCriteriaFirstGroup: 'sample_data',
    responseValueFirstGroup: `"name":"sample_data"`,
    searchCriteriaSecondGroup: DATABASE_SERVICE_DETAILS.name,
    responseValueSecondGroup: `"name":"${DATABASE_SERVICE_DETAILS.name}"`,
  },
  Database: {
    name: 'Database',
    testid: '[title="Database"]',
    searchCriteriaFirstGroup: 'ecommerce_db',
    responseValueFirstGroup: `"name":"ecommerce_db"`,
    searchCriteriaSecondGroup: DATABASE_DETAILS.name,
    responseValueSecondGroup: `"name":"${DATABASE_DETAILS.name}"`,
  },
  Database_Schema: {
    name: 'Database Schema',
    testid: '[title="Database Schema"]',
    searchCriteriaFirstGroup: 'shopify',
    responseValueFirstGroup: `"name":"shopify"`,
    searchCriteriaSecondGroup: SCHEMA_DETAILS.name,
    responseValueSecondGroup: `"name":"${SCHEMA_DETAILS.name}"`,
  },
  Column: {
    name: 'Column',
    testid: '[title="Column"]',
    searchCriteriaFirstGroup: 'cypress_first_name',
    responseValueFirstGroup: '"name":"cypress_first_name"',
    searchCriteriaSecondGroup: 'cypress_user_id',
    responseValueSecondGroup: '"name":"cypress_user_id"',
  },
};

export const OPERATOR = {
  AND: {
    name: 'AND',
    index: 1,
  },
  OR: {
    name: 'OR',
    index: 2,
  },
};

export const searchForField = (condition, fieldid, searchCriteria, index) => {
  interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
  // Click on field dropdown
  cy.get('.rule--field > .ant-select > .ant-select-selector').eq(index).click();
  // Select owner fields
  cy.get(`${fieldid}`).eq(index).click();
  // Select the condition
  cy.get('.rule--operator > .ant-select > .ant-select-selector')
    .eq(index)
    .click();

  cy.get(`[title="${condition}"]`).eq(index).click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item').should(
    'contain',
    `${condition}`
  );

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input').eq(index).type(searchCriteria);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index)
        .type(searchCriteria);
      // select value from dropdown
      verifyResponseStatusCode('@suggestApi', 200);
      cy.get(`.ant-select-dropdown [title = '${searchCriteria}']`)
        .trigger('mouseover')
        .trigger('click');
    }
  });
};

export const goToAdvanceSearch = () => {
  // Navigate to explore page
  cy.get('[data-testid="app-bar-item-explore"]').click();
  cy.get('[data-testid="advance-search-button"]').click();
  cy.get('[data-testid="reset-btn"]').click();
};

export const checkmustPaths = (
  condition,
  field,
  searchCriteria,
  index,
  responseSearch
) => {
  goToAdvanceSearch();

  // Search with advance search
  searchForField(condition, field, searchCriteria, index);

  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*must*${encodeURI(
      searchCriteria
    )}*`,
    'search'
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search').should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria));
    expect(resBody).to.include(`${responseSearch}`);
  });
};

export const checkmust_notPaths = (
  condition,
  field,
  searchCriteria,
  index,
  responseSearch
) => {
  goToAdvanceSearch();

  // Search with advance search
  searchForField(condition, field, searchCriteria, index);
  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*must_not*${encodeURI(
      searchCriteria
    )}*`,
    'search_must_not'
  );
  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search_must_not').should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria));
    expect(resBody).to.not.include(`${responseSearch}`);
  });
};

export const removeOwner = () => {
  visitEntityDetailsPage({
    term: SEARCH_ENTITY_TABLE.table_1.term,
    serviceName: SEARCH_ENTITY_TABLE.table_1.serviceName,
    entity: SEARCH_ENTITY_TABLE.table_1.entity,
  });
  interceptURL(
    'PATCH',
    `/api/v1/${SEARCH_ENTITY_TABLE.table_1.entity}/*`,
    'patchOwner'
  );
  cy.get('[data-testid="edit-owner"]').click();
  cy.get('[data-testid="remove-owner"]').click();
  verifyResponseStatusCode('@patchOwner', 200);
  cy.get('[data-testid="owner-link"]').should('contain', 'No Owner');
};

export const addOwner = ({ ownerName, term, serviceName, entity }) => {
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });

  interceptURL(
    'GET',
    '/api/v1/search/query?q=**%20AND%20teamType:Group&from=0&size=25&index=team_search_index',
    'waitForTeams'
  );

  cy.get('[data-testid="edit-owner"]').click();

  verifyResponseStatusCode('@waitForTeams', 200);
  interceptURL('GET', '/api/v1/users?limit=25&isBot=false', 'getUsers');

  cy.get('.ant-tabs [id*=tab-users]').click();
  verifyResponseStatusCode('@getUsers', 200);

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(ownerName)}*`,
    'searchOwner'
  );

  cy.get('[data-testid="owner-select-users-search-bar"]').type(ownerName);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', '/api/v1/tables/*', 'tablePatch');

  // Selecting the user
  cy.get(`[title="${ownerName}"]`)
    .should('exist')
    .scrollIntoView()
    .and('be.visible')
    .click();

  verifyResponseStatusCode('@tablePatch', 200);

  cy.get('[data-testid="owner-link"]')
    .scrollIntoView()
    .invoke('text')
    .then((text) => {
      expect(text).equal(ownerName);
    });
};

export const addTier = ({ term, serviceName, entity }) => {
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });

  cy.get('[data-testid="edit-tier"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="select-tier-button"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="tier-dropdown"]').should('contain', 'Tier1');
};

export const addTag = ({ tag, term, serviceName, entity }) => {
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });

  cy.get('[data-testid="entity-right-panel"] [data-testid="entity-tags"]')
    .eq(0)
    .scrollIntoView()
    .click();

  cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(tag);

  cy.get('.ant-select-item-option-content')
    .contains(tag)
    .should('be.visible')
    .click();

  // to close popup
  cy.clickOutside();

  cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(tag);

  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  cy.get('[data-testid="entity-right-panel"] [data-testid="entity-tags"]')
    .should('be.visible')
    .contains(tag);
};

export const checkAddGroupWithOperator = (
  condition_1,
  condition_2,
  fieldid,
  searchCriteria_1,
  searchCriteria_2,
  index_1,
  index_2,
  operatorindex,
  filter_1,
  filter_2,
  response_1,
  response_2
) => {
  goToAdvanceSearch();
  // Click on field dropdown
  cy.get('.rule--field > .ant-select > .ant-select-selector')
    .eq(index_1)
    .should('be.visible')
    .click();
  // Select owner fields
  cy.get(fieldid).eq(0).should('be.visible').click();
  // Select the condition
  cy.get('.rule--operator > .ant-select > .ant-select-selector')
    .eq(index_1)
    .should('be.visible')
    .click();

  cy.get(`[label="${condition_1}"]`).eq(index_1).should('be.visible').click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_1}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);

      verifyResponseStatusCode('@suggestApi', 200);
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_1}"]`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });

  // To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  // Select add-group button
  cy.get('.action--ADD-GROUP')
    .eq(0)
    .scrollIntoView()
    .should('be.visible')
    .click();

  // Select the AND/OR condition
  cy.get(
    `.group--conjunctions > .ant-btn-group > :nth-child(${operatorindex})`
  ).click();

  // Click on field dropdown
  cy.get('.rule--field').eq(index_2).should('be.visible').click();

  cy.get(fieldid).eq(2).should('be.visible').click();

  // Select the condition
  cy.get('.rule--operator').eq(index_2).should('be.visible').click();

  cy.get(`[label="${condition_2}"]`).eq(index_2).should('be.visible').click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_2}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
      verifyResponseStatusCode('@suggestApi', 200);

      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_2}"]`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });

  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*${encodeURI(
      searchCriteria_1
    )}*`,
    `search${searchCriteria_1}`
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait(`@search${searchCriteria_1}`).should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria_1));
    expect(resBody).to.not.include(response_2);
  });
};

export const checkAddRuleWithOperator = (
  condition_1,
  condition_2,
  fieldid,
  searchCriteria_1,
  searchCriteria_2,
  index_1,
  index_2,
  operatorindex,
  filter_1,
  filter_2,
  response_1,
  response_2
) => {
  goToAdvanceSearch();
  // Click on field dropdown
  cy.get('.rule--field').eq(index_1).should('be.visible').click();
  // Select owner fields
  cy.get(fieldid).eq(0).should('be.visible').click();
  // Select the condition
  cy.get('.rule--operator').eq(index_1).should('be.visible').click();

  cy.get(`[label="${condition_1}"]`).eq(index_1).should('be.visible').click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_1}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');

      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);

      verifyResponseStatusCode('@suggestApi', 200);

      cy.get(`[title = '${searchCriteria_1}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });

  // To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  // Select add-group button
  cy.get('.action--ADD-RULE').eq(1).should('be.visible').click();

  // Select the AND/OR condition
  cy.get(
    `.group--conjunctions > .ant-btn-group > :nth-child(${operatorindex})`
  ).click();

  // Click on field dropdown
  cy.get('.rule--field').eq(index_2).should('be.visible').click();

  cy.get(fieldid).eq(2).should('be.visible').click();

  // Select the condition
  cy.get('.rule--operator').eq(index_2).should('be.visible').click();

  cy.get(`[label="${condition_2}"]`).eq(index_2).should('be.visible').click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_2}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);

      verifyResponseStatusCode('@suggestApi', 200);

      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_2}"]`)
        .should('be.visible')
        .contains(searchCriteria_2)
        .click();
    }
  });

  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*${filter_1}*${encodeURI(
      searchCriteria_1
    )}*${filter_2}*${encodeURI(response_2)}*`,
    `search${searchCriteria_1}`
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait(`@search${searchCriteria_1}`).should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria_1));
    expect(resBody).to.not.include(response_2);
  });
};

export const advanceSearchPreRequests = (token) => {
  // Create Table hierarchy

  createEntityTable({
    token,
    ...ADVANCE_SEARCH_DATABASE_SERVICE,
  });

  // Create a new user
  cy.request({
    method: 'POST',
    url: `/api/v1/users/signup`,
    headers: { Authorization: `Bearer ${token}` },
    body: USER_CREDENTIALS,
  }).then((response) => {
    USER_CREDENTIALS.id = response.body.id;
  });

  // Add owner to table 1
  cy.request({
    method: 'GET',
    url: `/api/v1/tables/name/${ADVANCE_SEARCH_TABLES.table1.databaseSchema}.${ADVANCE_SEARCH_TABLES.table1.name}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'PATCH',
      url: `/api/v1/tables/${response.body.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: [
        {
          op: 'add',
          path: '/owner',
          value: {
            id: USER_CREDENTIALS.id,
            type: 'user',
          },
        },
      ],
    });
  });

  // Add Tier to table 2
  cy.request({
    method: 'GET',
    url: `/api/v1/tables/name/${ADVANCE_SEARCH_TABLES.table2.databaseSchema}.${ADVANCE_SEARCH_TABLES.table2.name}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'PATCH',
      url: `/api/v1/tables/${response.body.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: 'Tier1',
            tagFQN: 'Tier.Tier1',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            name: 'SpecialCategory',
            tagFQN: 'PersonalData.SpecialCategory',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ],
    });
  });

  // Add Tag to table 3
  cy.request({
    method: 'GET',
    url: `/api/v1/tables/name/${ADVANCE_SEARCH_TABLES.table3.databaseSchema}.${ADVANCE_SEARCH_TABLES.table3.name}`,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => {
    cy.request({
      method: 'PATCH',
      url: `/api/v1/tables/${response.body.id}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json-patch+json',
      },
      body: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            tagFQN: 'PersonalData.Personal',
            source: 'Classification',
            name: 'Personal',
            description:
              'Data that can be used to directly or indirectly identify a person.',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            name: 'Tier2',
            tagFQN: 'Tier.Tier2',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ],
    });
  });
};
