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

import { hardDeleteService } from '../../../common/EntityUtils';
import {
  advanceSearchPreRequests,
  ADVANCE_SEARCH_DATABASE_SERVICE,
  ADVANCE_SEARCH_DATABASE_SERVICE_2,
  checkMustPaths,
  checkMust_notPaths,
  CONDITIONS_MUST,
  CONDITIONS_MUST_NOT,
  FIELDS,
} from '../../../common/Utils/AdvancedSearch';
import { getToken } from '../../../common/Utils/LocalStorage';
import { SERVICE_CATEGORIES } from '../../../constants/service.constants';

describe('Single filed search', () => {
  const testData = {
    userId: '',
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
      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${testData.userId}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });
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
