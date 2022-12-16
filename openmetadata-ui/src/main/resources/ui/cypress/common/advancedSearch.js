/*
 *  Copyright 2021 Collate
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
import { interceptURL, verifyResponseStatusCode } from './common';

const dropdown_group_1 =
  '.ant-select-dropdown > :nth-child(1) > :nth-child(1) > .rc-virtual-list > .rc-virtual-list-holder > :nth-child(1) > .rc-virtual-list-holder-inner > .ant-select-item > .ant-select-item-option-content';

const dropdown_group_2 =
  ':nth-child(7) > :nth-child(1) > .ant-select-dropdown > :nth-child(1) > :nth-child(1) > .rc-virtual-list > .rc-virtual-list-holder > :nth-child(1) > .rc-virtual-list-holder-inner > .ant-select-item';

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

export const CONDITIONS_MUST = {
  equalTo: {
    name: '==',
  },
  anyIn: {
    name: 'Any in',
  },
  contains: {
    name: 'Contains',
  },
};

export const CONDITIONS_MUST_NOT = {
  notEqualTo: {
    name: '!=',
  },
  notIn: {
    name: 'Not in',
  },
  notContains: {
    name: 'Not contains',
  },
};

export const FIELDS = {
  Owner: {
    name: 'Owner',
    testid: '[title="Owner"]',
    searchCriteriaFirstGroup: 'admin',
    responseValueFirstGroup: `"name":"admin"`,
    searchCriteriaSecondGroup: 'aaron_singh2',
  },
  Tags: {
    name: 'Tags',
    testid: '[title="Tags"]',
    searchCriteriaFirstGroup: 'PersonalData.Personal',
    responseValueFirstGroup: `"tagFQN":"PersonalData.Personal"`,
  },
  Tiers: {
    name: 'Tier',
    testid: '[title="Tier"]',
    searchCriteriaFirstGroup: 'Tier.Tier1',
    responseSearchCriteriaFirstGroup: `"tagFQN":"Tier.Tier1"`,
  },
  Service: {
    name: 'Service',
    testid: '[title="Service"]',
    searchCriteriaFirstGroup: 'sample_data',
    responseValueFirstGroup: `"name":"sample_data"`,
  },
  Database: {
    name: 'Database',
    testid: '[title="Database"]',
    searchCriteriaFirstGroup: 'ecommerce_db',
    responseValueFirstGroup: `"name":"ecommerce_db"`,
  },
  Database_Schema: {
    name: 'Database Schema',
    testid: '[title="Database Schema"]',
    searchCriteriaFirstGroup: 'shopify',
    responseValueFirstGroup: `"name":"shopify"`,
  },
  Column: {
    name: 'column name',
    testid: '[title="Column"]',
    searchCriteriaFirstGroup: 'SKU',
    responseValueFirstGroup: `"name":"SKU"`,
  },
};

export const searchForField = (condition, fieldid, searchCriteria, index) => {
  //Click on field dropdown
  cy.get('.rule--field').eq(index).should('be.visible').click();
  //Select owner fields
  cy.get(`${fieldid}`).eq(index).should('be.visible').click();
  //Select the condition
  cy.get('.rule--operator').eq(index).should('be.visible').click();

  cy.get(`[title="${condition}"]`).eq(index).should('be.visible').click();
  //Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition}`);
  cy.wait(500);

  //Verify the search criteria for the condition
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
  //if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if ($body.find(dropdown_group_1).length) {
      cy.get(`[title='${searchCriteria}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
    cy.wait(1000);
    // if ($body.find('.ant-select-dropdown').length) {
    //   cy.get('.ant-modal-body').click();
    // }
  });
};

export const goToAdvanceSearch = () => {
  //Navigate to explore page
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('[data-testid="tables-tab"]').should('exist').and('be.visible');
  //Click on advance search button
  cy.get('[data-testid="advance-search-button"]').should('be.visible').click();
  cy.get('.ant-modal-content')
    .should('be.visible')
    .should('contain', 'Advanced Search');

  //Click on reset button to reset any previous search activity
  cy.get('.ant-btn').contains('Reset').click();
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

  //Search with advance search
  searchForField(condition, field, searchCriteria, index);

  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*must*${searchCriteria}*&sort_field=_score&sort_order=desc`,
    'search'
  );
  // //Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search').should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);
    expect(request.url).to.contain(searchCriteria);
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

  //Search with advance search
  searchForField(condition, field, searchCriteria, index);
  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*must_not*${searchCriteria}*&sort_field=_score&sort_order=desc`,
    'search_must_not'
  );
  //Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait('@search_must_not').should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);
    expect(request.url).to.contain(searchCriteria);
    expect(resBody).to.not.include(`${responseSearch}`);
  });
};

export const addOwner = (ownerName) => {
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('#tabledatacard0Title')
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
  //Clicking on users tab
  cy.get('[data-testid="dropdown-tab"]')
    .contains('Users')
    .should('exist')
    .should('be.visible')
    .click();

  interceptURL(
    'GET',
    `api/v1/search/query?q=*${ownerName}*&from=0&size=*&index=*`,
    'searchOwner'
  );
  cy.get('[data-testid="searchInputText"]')
    .scrollIntoView()
    .should('be.visible')
    .and('exist')
    .trigger('click')
    .type(ownerName);

  verifyResponseStatusCode('@searchOwner', 200);

  interceptURL('PATCH', '/api/v1/tables/*', 'validateOwner');
  //Selecting the user
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

  cy.get('#tabledatacard0Title')
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

  cy.get('[data-testid="tier-dropdown"]')
    .invoke('text')
    .then((text) => {
      expect(text).to.contain(tier);
    });

  cy.get('[data-testid="entity-tags"]').should('contain', tier);
};

export const addTag = (tag) => {
  cy.get('[data-testid="appbar-item-explore"]')
    .should('exist')
    .and('be.visible')
    .click();

  cy.get('#tabledatacard0Title')
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
  cy.get('[class*="-control"]').should('be.visible').type(tag);
  cy.wait(500);
  cy.get('[id*="-option-0"]').should('be.visible').click();
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
  fieldname,
  searchCriteria_1,
  searchCriteria_2,
  index_1,
  index_2,
  operatorindex
) => {
  goToAdvanceSearch();
  //Click on field dropdown
  cy.get('.rule--field').eq(index_1).should('be.visible').click();
  //Select owner fields
  cy.get('.ant-select-item-option-content')
    .contains(fieldname)
    .scrollIntoView()
    .should('be.visible')
    .click();
  //Select the condition
  cy.get('.rule--operator').eq(index_1).should('be.visible').click();

  cy.get(`[label="${condition_1}"]`).eq(index_1).should('be.visible').click();
  //Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_1}`);
  cy.wait(500);

  //Verify the search criteria for the condition
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
  //if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if ($body.find(dropdown_group_1).length) {
      cy.get(`[title = '${searchCriteria_1}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });
  //To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  //Select add-group button
  cy.get('[data-testid="add-group"]').eq(0).should('be.visible').click();

  //Select the AND/OR condition
  cy.get(
    `.group--conjunctions > .ant-btn-group > :nth-child(${operatorindex})`
  ).click();

  //Click on field dropdown
  cy.get('.rule--field').eq(index_2).should('be.visible').click();

  cy.get(`.ant-select-dropdown  [label="${fieldid}"]`)
    .contains(fieldname)
    .scrollIntoView()
    .should('be.visible')
    .click({ force: true });

  //Select the condition
  cy.get('.rule--operator').eq(index_2).should('be.visible').click();

  cy.get(`[label="${condition_2}"]`).eq(index_2).should('be.visible').click();
  //Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .should('be.visible')
    .should('contain', `${condition_2}`);
  cy.wait(500);

  //Verify the search criteria for the condition
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
  //if condition has a dropdown then select value from dropdown
  cy.get('body').then(($body) => {
    if ($body.find(dropdown_group_2).length) {
      cy.get(`[title = '${searchCriteria_2}']`)
        .should('be.visible')
        .trigger('mouseover')
        .trigger('click');
    }
  });

  // //Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();
};
