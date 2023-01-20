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
import { MYSQL } from '../constants/service.constants';
import { interceptURL, verifyResponseStatusCode } from './common';

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
    searchTerm1: 'admin',
    searchCriteriaFirstGroup: 'admin',
    responseValueFirstGroup: `"displayName":"admin"`,
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
  cy.wait(500);

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
    }
  });

  cy.wait(1000);
  // if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if ($body.find(`.ant-select-dropdown [title="${searchCriteria}"]`).length) {
      cy.get(`[title = '${searchCriteria}']`)
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
  cy.wait(1000);
  // Click on advance search button
  cy.get('[data-testid="advance-search-button"]').should('be.visible').click();

  cy.wait(1000);
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
  cy.get(
    '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
  )
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="user-name"]').should('exist').and('be.visible').click();

  verifyResponseStatusCode('@userProfile', 200);

  cy.get('[data-testid="hiden-layer"]').should('exist').click();

  cy.get('[data-testid="edit-displayName"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="displayName"]')
    .should('exist')
    .and('be.visible')
    .clear()
    .type(ownerName);

  cy.get('[data-testid="save-displayName"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('#tabledatacard0-title')
    .first()
    .scrollIntoView()
    .should('be.visible')
    .click();

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
    `api/v1/search/query?q=*${searchTerm}*&from=0&size=*&index=*`,
    'searchOwner'
  );
  cy.get('[data-testid="searchInputText"]')
    .scrollIntoView()
    .should('be.visible')
    .and('exist')
    .trigger('click')
    .type(searchTerm);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', '/api/v1/tables/*', 'validateOwner');
  // Selecting the user
  cy.get('[data-testid="user-tag"]')
    .contains(ownerName)
    .should('exist')
    .and('be.visible')
    .click();

  verifyResponseStatusCode('@validateOwner', 200);

  cy.get('[data-testid="owner-link"]')
    .scrollIntoView()
    .invoke('text')
    .then((text) => {
      expect(text).equal(ownerName);
    });
};

export const addTier = (tier) => {
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('#tabledatacard0-title')
    .first()
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.get('[data-testid="edit-Tier-icon"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="select-tier-buuton"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.wait(1000);

  cy.get('[data-testid="tags"] > [data-testid="add-tag"]').should(
    'contain',
    'Tier1'
  );
};

export const addTag = (tag) => {
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('#tabledatacard0-title')
    .first()
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="tags"] > [data-testid="add-tag"]')
    .eq(0)
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.wait(500);
  cy.get('[data-testid="tag-selector"]').should('be.visible').click().type(tag);
  cy.wait(500);
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
  cy.wait(500);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    }
  });

  cy.wait(1000);
  // if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_1}"]`).length
    ) {
      cy.get(`[title = '${searchCriteria_1}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });
  // To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  // Select add-group button
  cy.get('.action--ADD-GROUP').eq(0).should('be.visible').click();

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
  cy.wait(500);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    }
  });

  cy.wait(1000);
  // if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_2}"]`).length &&
      searchCriteria_2 === 'Tier.Tier2'
    ) {
      cy.get(`[title = "${searchCriteria_2}"]`)
        .eq(1)
        .contains(searchCriteria_2)
        .click({ force: true });
    } else if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_2}"]`).length
    ) {
      cy.get(`[title = "${searchCriteria_2}"]`)
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
  cy.wait(500);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .should('be.visible')
        .type(searchCriteria_1);
    }
  });

  cy.wait(1000);
  // if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_1}"]`).length
    ) {
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
  cy.wait(500);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    } else {
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .should('be.visible')
        .type(searchCriteria_2);
    }
  });

  cy.wait(1000);
  // if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_2}"]`).length &&
      searchCriteria_2 === 'Tier.Tier2'
    ) {
      cy.get(`[title = "${searchCriteria_2}"]`)
        .eq(1)
        .contains(searchCriteria_2)
        .click({ force: true });
    } else if (
      $body.find(`.ant-select-dropdown [title="${searchCriteria_2}"]`).length
    ) {
      cy.get(`[title = "${searchCriteria_2}"]`)
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
