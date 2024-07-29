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

import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';
import { interceptURL, verifyResponseStatusCode } from '../common';
import {
  createEntityTable,
  getTableCreationDetails,
  getUserCreationDetails,
  hardDeleteService,
} from '../EntityUtils';
import { deleteEntityViaREST, visitEntityDetailsPage } from './Entity';

export const ADVANCE_SEARCH_DATABASE_SERVICE = getTableCreationDetails();

export const ADVANCE_SEARCH_DATABASE_SERVICE_2 = getTableCreationDetails();

export const USER_1 = getUserCreationDetails();
export const USER_1_FULL_NAME = `${USER_1.user.firstName}${USER_1.user.lastName}`;

export const USER_2 = getUserCreationDetails();
export const USER_2_FULL_NAME = `${USER_2.user.firstName}${USER_2.user.lastName}`;

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

export type AdvancedSearchFieldDetails = {
  name: string;
  testId: string;
  searchTerm1?: string;
  searchCriteriaFirstGroup: string;
  responseValueFirstGroup: string;
  searchCriteriaSecondGroup: string;
  responseValueSecondGroup: string;
  owner?: boolean;
  createTagName?: string;
  isLocalSearch?: boolean;
};

export const FIELDS: Record<string, AdvancedSearchFieldDetails> = {
  Owner: {
    name: 'Owner',
    testId: '[title="Owner"]',
    searchTerm1: USER_1_FULL_NAME,
    searchCriteriaFirstGroup: USER_1_FULL_NAME,
    responseValueFirstGroup: `"displayName":"${USER_1_FULL_NAME}"`,
    searchCriteriaSecondGroup: USER_2_FULL_NAME,
    owner: true,
    responseValueSecondGroup: USER_2_FULL_NAME,
  },
  Tags: {
    name: 'Tags',
    testId: '[title="Tags"]',
    createTagName: 'Personal',
    searchCriteriaFirstGroup: 'PersonalData.Personal',
    responseValueFirstGroup: '"tagFQN":"PersonalData.Personal"',
    searchCriteriaSecondGroup: 'PersonalData.SpecialCategory',
    responseValueSecondGroup: '"tagFQN":"PersonalData.SpecialCategory"',
  },
  Tiers: {
    name: 'Tier',
    testId: '[title="Tier"]',
    searchCriteriaFirstGroup: 'Tier.Tier1',
    responseValueFirstGroup: '"tagFQN":"Tier.Tier1"',
    searchCriteriaSecondGroup: 'Tier.Tier2',
    responseValueSecondGroup: '"tagFQN":"Tier.Tier2"',
    isLocalSearch: true,
  },
  Service: {
    name: 'Service',
    testId: '[title="Service"]',
    searchCriteriaFirstGroup: ADVANCE_SEARCH_DATABASE_SERVICE_2.service.name,
    responseValueFirstGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE_2.service.name}"`,
    searchCriteriaSecondGroup: ADVANCE_SEARCH_DATABASE_SERVICE.service.name,
    responseValueSecondGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE.service.name}"`,
  },
  Database: {
    name: 'Database',
    testId: '[title="Database"]',
    searchCriteriaFirstGroup: ADVANCE_SEARCH_DATABASE_SERVICE_2.database.name,
    responseValueFirstGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE_2.database.name}"`,
    searchCriteriaSecondGroup: ADVANCE_SEARCH_DATABASE_SERVICE.database.name,
    responseValueSecondGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE.database.name}"`,
  },
  Database_Schema: {
    name: 'Database Schema',
    testId: '[title="Database Schema"]',
    searchCriteriaFirstGroup: ADVANCE_SEARCH_DATABASE_SERVICE_2.schema.name,
    responseValueFirstGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE_2.schema.name}"`,
    searchCriteriaSecondGroup: ADVANCE_SEARCH_DATABASE_SERVICE.schema.name,
    responseValueSecondGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE.schema.name}"`,
  },
  Column: {
    name: 'Column',
    testId: '[title="Column"]',
    searchCriteriaFirstGroup:
      ADVANCE_SEARCH_DATABASE_SERVICE_2.tables[0].columns[0].name,
    responseValueFirstGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE_2.tables[0].columns[0].name}"`,
    searchCriteriaSecondGroup:
      ADVANCE_SEARCH_DATABASE_SERVICE.tables[0].columns[0].name,
    responseValueSecondGroup: `"name":"${ADVANCE_SEARCH_DATABASE_SERVICE.tables[0].columns[0].name}"`,
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

export const searchForField = (
  condition: string,
  fieldId: string,
  searchCriteria: string,
  index: number,
  isLocalSearch = false
) => {
  if (!isLocalSearch) {
    interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
  }

  // Click on field dropdown
  cy.get('.rule--field > .ant-select > .ant-select-selector').eq(index).click();
  // Select owner fields
  cy.get(`${fieldId}`).eq(index).click();
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

      // checking filter is working
      cy.get(`.ant-select-dropdown [title="${searchCriteria}"]`).should(
        'be.visible'
      );

      // select value from dropdown
      if (!isLocalSearch) {
        verifyResponseStatusCode('@suggestApi', 200);
      }
      cy.get(`.ant-select-dropdown [title = '${searchCriteria}']`)
        .trigger('mouseover')
        .trigger('click');
    }
  });
};

export const goToAdvanceSearch = () => {
  // Navigate to explore page
  cy.sidebarClick(SidebarItem.EXPLORE);
  cy.get('[data-testid="advance-search-button"]').click();
  cy.get('[data-testid="reset-btn"]').click();
};

export const checkMustPaths = (
  condition: string,
  field: string,
  searchCriteria: string,
  index: number,
  responseSearch: string,
  isLocalSearch: boolean
) => {
  goToAdvanceSearch();

  // Search with advance search
  searchForField(condition, field, searchCriteria, index, isLocalSearch);

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

export const checkMust_notPaths = (
  condition,
  field,
  searchCriteria,
  index,
  responseSearch,
  isLocalSearch
) => {
  goToAdvanceSearch();

  // Search with advance search
  searchForField(condition, field, searchCriteria, index, isLocalSearch);
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

  cy.get('[data-testid="tag-selector"]').scrollIntoView().click().type(tag);

  cy.get('.ant-select-item-option-content')
    .contains(tag)
    .scrollIntoView()
    .click();

  // to close popup
  cy.clickOutside();

  cy.get('[data-testid="tag-selector"] > .ant-select-selector').contains(tag);

  cy.get('[data-testid="saveAssociatedTag"]').scrollIntoView().click();
  cy.get('[data-testid="entity-right-panel"] [data-testid="entity-tags"]')
    .scrollIntoView()
    .contains(tag);
};

type CheckAddGroupWithOperatorArgs = {
  condition_1: string;
  condition_2: string;
  fieldId: string;
  searchCriteria_1: string;
  searchCriteria_2: string;
  index_1: number;
  index_2: number;
  operatorIndex: number;
  isLocalSearch?: boolean;
};

export const checkAddGroupWithOperator = ({
  condition_1,
  condition_2,
  fieldId,
  searchCriteria_1,
  searchCriteria_2,
  index_1,
  index_2,
  operatorIndex,
  isLocalSearch = false,
}: CheckAddGroupWithOperatorArgs) => {
  goToAdvanceSearch();
  // Click on field dropdown
  cy.get('.rule--field > .ant-select > .ant-select-selector')
    .eq(index_1)
    .scrollIntoView()
    .click();
  // Select owner fields
  cy.get(fieldId).eq(0).scrollIntoView().click();
  // Select the condition
  cy.get('.rule--operator > .ant-select > .ant-select-selector')
    .eq(index_1)
    .scrollIntoView()
    .click();

  cy.get(`[label="${condition_1}"]`).eq(index_1).scrollIntoView().click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .scrollIntoView()
    .should('contain', `${condition_1}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .scrollIntoView()
        .type(searchCriteria_1);
    } else {
      if (!isLocalSearch) {
        interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      }
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .scrollIntoView()
        .type(searchCriteria_1);

      if (!isLocalSearch) {
        verifyResponseStatusCode('@suggestApi', 200);
      }
      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_1}"]`)
        .scrollIntoView()
        .trigger('mouseover')
        .trigger('click');
    }
  });

  // To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  // Select add-group button
  cy.get('.action--ADD-GROUP').eq(0).scrollIntoView().scrollIntoView().click();

  // Select the AND/OR condition
  cy.get(
    `.group--conjunctions > .ant-btn-group > :nth-child(${operatorIndex})`
  ).click();

  // Click on field dropdown
  cy.get('.rule--field').eq(index_2).scrollIntoView().click();

  cy.get(`.ant-select-dropdown:visible ${fieldId}`).scrollIntoView().click();

  // Select the condition
  cy.get('.rule--operator').eq(index_2).scrollIntoView().click();

  cy.get(`[label="${condition_2}"]`).eq(index_2).scrollIntoView().click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item').should(
    'contain',
    `${condition_2}`
  );

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .scrollIntoView()
        .type(searchCriteria_2);
    } else {
      if (!isLocalSearch) {
        interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      }
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .scrollIntoView()
        .type(searchCriteria_2);

      if (!isLocalSearch) {
        verifyResponseStatusCode('@suggestApi', 200);
      }

      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_2}"]`)
        .scrollIntoView()
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
    expect(resBody).to.not.include(response);
  });
};

type CheckAddRuleWithOperatorArgs = {
  condition_1: string;
  condition_2: string;
  fieldId: string;
  searchCriteria_1: string;
  searchCriteria_2: string;
  index_1: number;
  index_2: number;
  operatorIndex: number;
  filter_1: string;
  filter_2: string;
  response: string;
};

export const checkAddRuleWithOperator = ({
  condition_1,
  condition_2,
  fieldId,
  searchCriteria_1,
  searchCriteria_2,
  index_1,
  index_2,
  operatorIndex,
  filter_1,
  filter_2,
  response,
}: CheckAddRuleWithOperatorArgs) => {
  goToAdvanceSearch();
  // Click on field dropdown
  cy.get('.rule--field').eq(index_1).scrollIntoView().click();
  // Select owner fields
  cy.get(fieldId).eq(0).scrollIntoView().click();
  // Select the condition
  cy.get('.rule--operator').eq(index_1).scrollIntoView().click();

  cy.get(`[label="${condition_1}"]`).eq(index_1).scrollIntoView().click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item')
    .scrollIntoView()
    .should('contain', `${condition_1}`);

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_1)
        .scrollIntoView()
        .type(searchCriteria_1);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');

      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_1)
        .scrollIntoView()
        .type(searchCriteria_1);

      verifyResponseStatusCode('@suggestApi', 200);

      cy.get(`[title = '${searchCriteria_1}']`)
        .scrollIntoView()
        .trigger('mouseover')
        .trigger('click');
    }
  });

  // To close the dropdown for anyin and notin condition
  cy.get('.ant-modal-header').click();

  // Select add-group button
  cy.get('.action--ADD-RULE').eq(1).scrollIntoView().click();

  // Select the AND/OR condition
  cy.get(
    `.group--conjunctions > .ant-btn-group > :nth-child(${operatorIndex})`
  ).click();

  // Click on field dropdown
  cy.get('.rule--field').eq(index_2).scrollIntoView().click();

  cy.get(fieldId).eq(2).scrollIntoView().click();

  // Select the condition
  cy.get('.rule--operator').eq(index_2).scrollIntoView().click();

  cy.get(`.ant-select-dropdown:visible [label="${condition_2}"]`)
    .scrollIntoView()
    .click();
  // Verify the condition
  cy.get('.rule--operator .ant-select-selection-item').should(
    'contain',
    `${condition_2}`
  );

  // Verify the search criteria for the condition
  cy.get('body').then(($body) => {
    if ($body.find('.ant-col > .ant-input').length) {
      cy.get('.ant-col > .ant-input')
        .eq(index_2)
        .scrollIntoView()
        .type(searchCriteria_2);
    } else {
      interceptURL('GET', '/api/v1/search/aggregate?*', 'suggestApi');
      cy.get('.widget--widget > .ant-select > .ant-select-selector')
        .eq(index_2)
        .scrollIntoView()
        .type(searchCriteria_2);

      verifyResponseStatusCode('@suggestApi', 200);

      cy.get('.ant-select-dropdown')
        .not('.ant-select-dropdown-hidden')
        .find(`[title="${searchCriteria_2}"]`)
        .scrollIntoView()
        .contains(searchCriteria_2)
        .click();
    }
  });

  interceptURL(
    'GET',
    `/api/v1/search/query?q=&index=*&from=0&size=10&deleted=false&query_filter=*${filter_1}*${encodeURI(
      searchCriteria_1
    )}*${filter_2}*${encodeURI(response.replaceAll(' ', '+'))}*`,
    `search${searchCriteria_1}`
  );

  // Click on apply filter
  cy.get('.ant-btn-primary').contains('Apply').click();

  cy.wait(`@search${searchCriteria_1}`).should(({ request, response }) => {
    const resBody = JSON.stringify(response.body);

    expect(request.url).to.contain(encodeURI(searchCriteria_1));
    expect(resBody).to.not.include(response);
  });
};

export const advanceSearchPreRequests = (testData, token: string) => {
  // Create Table hierarchy
  createEntityTable({
    token,
    ...ADVANCE_SEARCH_DATABASE_SERVICE,
  });

  createEntityTable({
    token,
    ...ADVANCE_SEARCH_DATABASE_SERVICE_2,
  });

  cy.request({
    method: 'POST',
    url: `/api/v1/users/signup`,
    headers: { Authorization: `Bearer ${token}` },
    body: USER_1.user,
  }).then((response) => {
    testData.user_1 = response.body;

    // Add owner to table 1
    cy.request({
      method: 'GET',
      url: `/api/v1/tables/name/${ADVANCE_SEARCH_DATABASE_SERVICE.tables[0].databaseSchema}.${ADVANCE_SEARCH_DATABASE_SERVICE.tables[0].name}`,
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
              id: testData.user_1.id,
              type: 'user',
            },
          },
        ],
      });
    });

    // Create a new users
    cy.request({
      method: 'POST',
      url: `/api/v1/users/signup`,
      headers: { Authorization: `Bearer ${token}` },
      body: USER_2.user,
    }).then((response) => {
      testData.user_2 = response.body;
    });

    // Add Tier to table 2
    cy.request({
      method: 'GET',
      url: `/api/v1/tables/name/${ADVANCE_SEARCH_DATABASE_SERVICE.tables[1].databaseSchema}.${ADVANCE_SEARCH_DATABASE_SERVICE.tables[1].name}`,
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
      url: `/api/v1/tables/name/${ADVANCE_SEARCH_DATABASE_SERVICE.tables[2].databaseSchema}.${ADVANCE_SEARCH_DATABASE_SERVICE.tables[2].name}`,
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
  });
};

export const advancedSearchFlowCleanup = (token: string) => {
  // Delete created services
  hardDeleteService({
    token,
    serviceFqn: ADVANCE_SEARCH_DATABASE_SERVICE.service.name,
    serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
  });

  hardDeleteService({
    token,
    serviceFqn: ADVANCE_SEARCH_DATABASE_SERVICE_2.service.name,
    serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
  });

  // Delete created users
  deleteEntityViaREST({
    token,
    endPoint: EntityType.User,
    entityName: USER_1.userName,
  });

  deleteEntityViaREST({
    token,
    endPoint: EntityType.User,
    entityName: USER_2.userName,
  });
};
