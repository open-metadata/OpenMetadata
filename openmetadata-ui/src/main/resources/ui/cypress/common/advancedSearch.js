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
import { MYSQL } from '../constants/service.constants';
import {
  interceptURL,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from './common';

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

export const FIELDS = {
  Owner: {
    name: 'Owner',
    testid: '[title="Owner"]',
    searchTerm1: 'Colin Ho',
    searchCriteriaFirstGroup: 'Colin Ho',
    responseValueFirstGroup: `"displayName":"Colin Ho"`,
    searchCriteriaSecondGroup: 'Aaron Singh',
    owner: true,
    responseValueSecondGroup: 'Aaron Singh',
  },
  Tags: {
    name: 'Tags',
    testid: '[title="Tags"]',
    searchCriteriaFirstGroup: 'PersonalData.Personal',
    responseValueFirstGroup: '"tagFQN":"PersonalData.Personal"',
    searchCriteriaSecondGroup: 'PersonalData.SpecialCategory',
    responseValueSecondGroup: '"tagFQN":"PersonalData.SpecialCategory"',
  },
  Tiers: {
    name: 'Tier',
    testid: '[title="Tier"]',
    searchCriteriaFirstGroup: 'Tier.Tier1',
    responseValueFirstGroup: '"tagFQN":"Tier.Tier1"',
    searchCriteriaSecondGroup: 'Tier.Tier2',
    responseValueSecondGroup: '"tagFQN":"Tier.Tier2"',
  },
  Service: {
    name: 'Service',
    testid: '[title="Service"]',
    searchCriteriaFirstGroup: 'sample_data',
    responseValueFirstGroup: `"name":"sample_data"`,
    searchCriteriaSecondGroup: MYSQL.serviceName,
    responseValueSecondGroup: `"name":"${MYSQL.serviceName}"`,
  },
  Database: {
    name: 'Database',
    testid: '[title="Database"]',
    searchCriteriaFirstGroup: 'default',
    responseValueFirstGroup: `"name":"default"`,
    searchCriteriaSecondGroup: 'ecommerce_db',
    responseValueSecondGroup: `"name":"ecommerce_db"`,
  },
  Database_Schema: {
    name: 'Database Schema',
    testid: '[title="Database Schema"]',
    searchCriteriaFirstGroup: 'shopify',
    responseValueFirstGroup: `"name":"shopify"`,
    searchCriteriaSecondGroup: 'cypress_integrations_test_db',
    responseValueSecondGroup: `"name":"cypress_integrations_test_db"`,
  },
  Column: {
    name: 'Column',
    testid: '[title="Column"]',
    searchCriteriaFirstGroup: 'SKU',
    responseValueFirstGroup: '"name":"SKU"',
    searchCriteriaSecondGroup: 'api_client_id',
    responseValueSecondGroup: '"name":"api_client_id"',
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
  interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
  // Click on field dropdown
  cy.get('.rule--field > .ant-select > .ant-select-selector')
    .eq(index)
    .should('be.visible')
    .click();
  // Select owner fields
  cy.get(`${fieldid}`).eq(index).should('be.visible').click();
  // Select the condition
  cy.get('.rule--operator > .ant-select > .ant-select-selector')
    .eq(index)
    .should('be.visible')
    .click();

  cy.get(`[title="${condition}"]`).eq(index).should('be.visible').click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index)
        .should('be.visible')
        .type(searchCriteria);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index)
        .should('be.visible')
        .type(searchCriteria);
      // select value from dropdown
      verifyResponseStatusCode('@suggestApi', 200);
      cy.get(`.ant-select-dropdown [title = '${searchCriteria}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });
};

export const goToAdvanceSearch = () => {
  interceptURL(
    'GET',
    '/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*&sort_field=_score&sort_order=desc',
    'explorePage'
  );
  // Navigate to explore page
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="tables-tab"]')
    .scrollIntoView()
    .should('exist')
    .and('be.visible');

  cy.wait('@explorePage').then(() => {
    // Click on advance search button
    cy.get('[data-testid="advance-search-button"]')
      .should('be.visible')
      .click();

    cy.get('.ant-btn')
      .contains('Reset')
      .scrollIntoView()
      .should('be.visible')
      .click();
  });
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
    )}*&sort_field=_score&sort_order=desc`,
    'search'
  );
  // //Click on apply filter
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
    )}*&sort_field=_score&sort_order=desc`,
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

export const addOwner = (searchTerm, ownerName) => {
  visitEntityDetailsPage(
    SEARCH_ENTITY_TABLE.table_1.term,
    SEARCH_ENTITY_TABLE.table_1.serviceName,
    SEARCH_ENTITY_TABLE.table_1.entity
  );

  interceptURL(
    'GET',
    '/api/v1/search/query?q=*%20AND%20teamType:Group&from=0&size=10&index=team_search_index',
    'waitForTeams'
  );

  cy.get('[data-testid="edit-Owner-icon"]').should('be.visible').click();

  verifyResponseStatusCode('@waitForTeams', 200);
  // Clicking on users tab
  cy.get('[data-testid="dropdown-tab"]')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${encodeURI(searchTerm)}*&from=0&size=*&index=*`,
    'searchOwner'
  );
  cy.get('[data-testid="searchInputText"]')
    .scrollIntoView()
    .should('be.visible')
    .and('exist')
    .trigger('click')
    .type(searchTerm);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', '/api/v1/tables/*', 'tablePatch');
  // Selecting the user
  cy.get(`[data-testid="user-tag"]`)
    .contains(ownerName)
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

export const addTier = (tier) => {
  visitEntityDetailsPage(
    SEARCH_ENTITY_TABLE.table_2.term,
    SEARCH_ENTITY_TABLE.table_2.serviceName,
    SEARCH_ENTITY_TABLE.table_2.entity
  );

  cy.get('[data-testid="edit-Tier-icon"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="select-tier-button"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="tags"] > [data-testid="add-tag"]').should(
    'contain',
    'Tier1'
  );
};

export const addTag = (tag) => {
  visitEntityDetailsPage(
    SEARCH_ENTITY_TABLE.table_3.term,
    SEARCH_ENTITY_TABLE.table_3.serviceName,
    SEARCH_ENTITY_TABLE.table_3.entity
  );

  cy.get('[data-testid="tags"] > [data-testid="add-tag"]')
    .eq(0)
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(tag);

  cy.get('.ant-select-item-option-content').should('be.visible').click();
  cy.get(
    '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
  ).contains(tag);
  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  cy.get('[data-testid="entity-tags"]')
    .scrollIntoView()
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
      interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
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
      interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
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
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*${searchCriteria_1}*&sort_field=_score&sort_order=desc`,
    'search'
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search').should(({ request, response }) => {
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
      interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');

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
      interceptURL('GET', '/api/v1/search/suggest?q=*', 'suggestApi');
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
    )}*${filter_2}*${encodeURI(response_2)}*&sort_field=_score&sort_order=desc`,
    'search'
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search').should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria_1));
    expect(resBody).to.not.include(response_2);
  });
};
