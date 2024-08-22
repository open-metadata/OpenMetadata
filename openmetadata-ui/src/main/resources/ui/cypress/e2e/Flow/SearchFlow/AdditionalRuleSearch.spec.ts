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

// The spec is related to advance search feature

import {
  advancedSearchFlowCleanup,
  advanceSearchPreRequests,
  checkAddRuleWithOperator,
  CONDITIONS_MUST,
  CONDITIONS_MUST_NOT,
  FIELDS,
  OPERATOR,
} from '../../../common/Utils/AdvancedSearch';
import { getToken } from '../../../common/Utils/LocalStorage';

describe('Search with additional rule', () => {
  const testData = {
    user_1: {
      id: '',
    },
    user_2: {
      id: '',
    },
  };

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);
      advanceSearchPreRequests(testData, token);
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      advancedSearchFlowCleanup(token);
    });
    Cypress.session.clearAllSavedSessions();
  });

  beforeEach(() => {
    cy.login();
  });

  Object.values(OPERATOR).forEach((operator) => {
    it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.equalTo.name} and ${CONDITIONS_MUST_NOT.notEqualTo.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        if (field.owner) {
          val = field.responseValueSecondGroup;
        }
        checkAddRuleWithOperator({
          condition_1: CONDITIONS_MUST.equalTo.name,
          condition_2: CONDITIONS_MUST_NOT.notEqualTo.name,
          fieldId: field.testId,
          searchCriteria_1: field.isLocalSearch
            ? field.searchCriteriaFirstGroup
            : Cypress._.toLower(field.searchCriteriaFirstGroup),
          searchCriteria_2: field.isLocalSearch
            ? field.searchCriteriaSecondGroup
            : Cypress._.toLower(field.searchCriteriaSecondGroup),
          index_1: 0,
          index_2: 1,
          operatorIndex: operator.index,
          filter_1: CONDITIONS_MUST.equalTo.filter,
          filter_2: CONDITIONS_MUST_NOT.notEqualTo.filter,
          response: field.isLocalSearch ? val : Cypress._.toLower(val),
        });
      });
    });

    it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.anyIn.name} and ${CONDITIONS_MUST_NOT.notIn.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        if (field.owner) {
          val = field.responseValueSecondGroup;
        }
        checkAddRuleWithOperator({
          condition_1: CONDITIONS_MUST.anyIn.name,
          condition_2: CONDITIONS_MUST_NOT.notIn.name,
          fieldId: field.testId,
          searchCriteria_1: field.isLocalSearch
            ? field.searchCriteriaFirstGroup
            : Cypress._.toLower(field.searchCriteriaFirstGroup),
          searchCriteria_2: field.isLocalSearch
            ? field.searchCriteriaSecondGroup
            : Cypress._.toLower(field.searchCriteriaSecondGroup),
          index_1: 0,
          index_2: 1,
          operatorIndex: operator.index,
          filter_1: CONDITIONS_MUST.anyIn.filter,
          filter_2: CONDITIONS_MUST_NOT.notIn.filter,
          response: field.isLocalSearch ? val : Cypress._.toLower(val),
        });
      });
    });

    it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.contains.name} and ${CONDITIONS_MUST_NOT.notContains.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        const val = field.searchCriteriaSecondGroup;
        checkAddRuleWithOperator({
          condition_1: CONDITIONS_MUST.contains.name,
          condition_2: CONDITIONS_MUST_NOT.notContains.name,
          fieldId: field.testId,
          searchCriteria_1: field.isLocalSearch
            ? field.searchCriteriaFirstGroup
            : Cypress._.toLower(field.searchCriteriaFirstGroup),
          searchCriteria_2: field.isLocalSearch
            ? field.searchCriteriaSecondGroup
            : Cypress._.toLower(field.searchCriteriaSecondGroup),
          index_1: 0,
          index_2: 1,
          operatorIndex: operator.index,
          filter_1: CONDITIONS_MUST.contains.filter,
          filter_2: CONDITIONS_MUST_NOT.notContains.filter,
          response: field.isLocalSearch ? val : Cypress._.toLower(val),
        });
      });
    });
  });
});
