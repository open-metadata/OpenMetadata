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
  checkMustPaths,
  checkMust_notPaths,
  CONDITIONS_MUST,
  CONDITIONS_MUST_NOT,
  FIELDS,
} from '../../../common/Utils/AdvancedSearch';
import { getToken } from '../../../common/Utils/LocalStorage';

describe('Single filed search', () => {
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

  Object.values(FIELDS).forEach((field) => {
    it(`Verify advance search results for ${field.name} field and all conditions`, () => {
      Object.values(CONDITIONS_MUST).forEach((condition) => {
        checkMustPaths(
          condition.name,
          field.testId,
          field.isLocalSearch
            ? field.searchCriteriaFirstGroup
            : Cypress._.toLower(field.searchCriteriaFirstGroup),
          0,
          field.responseValueFirstGroup,
          field.isLocalSearch
        );
      });

      Object.values(CONDITIONS_MUST_NOT).forEach((condition) => {
        checkMust_notPaths(
          condition.name,
          field.testId,
          field.isLocalSearch
            ? field.searchCriteriaFirstGroup
            : Cypress._.toLower(field.searchCriteriaFirstGroup),
          0,
          field.responseValueFirstGroup,
          field.isLocalSearch
        );
      });
    });
  });
});
