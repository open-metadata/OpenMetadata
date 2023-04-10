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
  addOwner,
  addTag,
  addTier,
  checkAddGroupWithOperator,
  checkAddRuleWithOperator,
  checkmustPaths,
  checkmust_notPaths,
  CONDITIONS_MUST,
  CONDITIONS_MUST_NOT,
  FIELDS,
  OPERATOR,
} from '../../common/advancedSearch';
import {
  deleteCreatedService,
  interceptURL,
  mySqlConnectionInput,
  testServiceCreationAndIngestion,
  verifyResponseStatusCode,
} from '../../common/common';
import { API_SERVICE } from '../../constants/constants';
import { MYSQL } from '../../constants/service.constants';

const service_name = MYSQL.serviceName;

describe('pre-requests for test case', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Pre-requisite for advance search', () => {
    addOwner(FIELDS.Owner.searchTerm1, FIELDS.Owner.searchCriteriaFirstGroup);
    addTier(FIELDS.Tiers.searchCriteriaFirstGroup);
    addTag(FIELDS.Tags.createTagName);
  });

  it('Mysql ingestion', () => {
    interceptURL(
      'GET',
      'api/v1/teams/name/Organization?fields=*',
      'getSettingsPage'
    );
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    verifyResponseStatusCode('@getSettingsPage', 200);
    // Services page
    interceptURL('GET', '/api/v1/services/*', 'getServiceList');
    cy.get('[data-testid="global-setting-left-panel"]')
      .contains(MYSQL.database)
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getServiceList', 200);

    cy.get('[data-testid="add-service-button"]').should('be.visible').click();

    // Add new service page
    cy.url().should('include', '/add-service');
    cy.get('[data-testid="header"]').should('be.visible');
    cy.contains('Add New Service').should('be.visible');
    cy.get('[data-testid="service-category"]').should('be.visible');

    const addIngestionInput = () => {
      cy.get('[data-testid="schema-filter-pattern-checkbox"]')
        .invoke('show')
        .trigger('mouseover')
        .check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .should('be.visible')
        .type(Cypress.env('mysqlDatabaseSchema'));
    };

    testServiceCreationAndIngestion(
      MYSQL.serviceType,
      mySqlConnectionInput,
      addIngestionInput,
      service_name
    );
  });
});

describe.skip('Single filed search', () => {
  beforeEach(() => {
    cy.login();
  });

  Object.values(FIELDS).forEach((field) => {
    it(`Verify advance search results for ${field.name} field and all condition`, () => {
      Object.values(CONDITIONS_MUST).forEach((condition) => {
        checkmustPaths(
          condition.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          0,
          field.responseValueFirstGroup
        );
      });

      Object.values(CONDITIONS_MUST_NOT).forEach((condition) => {
        checkmust_notPaths(
          condition.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          0,
          field.responseValueFirstGroup
        );
      });
    });
  });

  after(() => {
    Cypress.session.clearAllSavedSessions();
  });
});

describe.skip('Group search', () => {
  beforeEach(() => {
    cy.login();
  });

  Object.values(OPERATOR).forEach((operator) => {
    it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.equalTo.name} and ${CONDITIONS_MUST_NOT.notEqualTo.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        if (field.owner) {
          val = field.responseValueSecondGroup;
        }
        checkAddGroupWithOperator(
          CONDITIONS_MUST.equalTo.name,
          CONDITIONS_MUST_NOT.notEqualTo.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.equalTo.filter,
          CONDITIONS_MUST_NOT.notEqualTo.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });

    it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.anyIn.name} and ${CONDITIONS_MUST_NOT.notIn.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        if (field.owner) {
          val = field.responseValueSecondGroup;
        }
        checkAddGroupWithOperator(
          CONDITIONS_MUST.anyIn.name,
          CONDITIONS_MUST_NOT.notIn.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.anyIn.filter,
          CONDITIONS_MUST_NOT.notIn.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });

    it(`Verify Add group functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.contains.name} and ${CONDITIONS_MUST_NOT.notContains.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;

        checkAddGroupWithOperator(
          CONDITIONS_MUST.contains.name,
          CONDITIONS_MUST_NOT.notContains.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.contains.filter,
          CONDITIONS_MUST_NOT.notContains.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });
  });
  after(() => {
    Cypress.session.clearAllSavedSessions();
  });
});

describe.skip('Search with additional rule', () => {
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
        checkAddRuleWithOperator(
          CONDITIONS_MUST.equalTo.name,
          CONDITIONS_MUST_NOT.notEqualTo.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.equalTo.filter,
          CONDITIONS_MUST_NOT.notEqualTo.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });

    it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.anyIn.name} and ${CONDITIONS_MUST_NOT.notIn.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        if (field.owner) {
          val = field.responseValueSecondGroup;
        }
        checkAddRuleWithOperator(
          CONDITIONS_MUST.anyIn.name,
          CONDITIONS_MUST_NOT.notIn.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.anyIn.filter,
          CONDITIONS_MUST_NOT.notIn.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });

    it(`Verify Add Rule functionality for All with ${operator.name} operator & condition ${CONDITIONS_MUST.contains.name} and ${CONDITIONS_MUST_NOT.notContains.name} `, () => {
      Object.values(FIELDS).forEach((field) => {
        let val = field.searchCriteriaSecondGroup;
        checkAddRuleWithOperator(
          CONDITIONS_MUST.contains.name,
          CONDITIONS_MUST_NOT.notContains.name,
          field.testid,
          field.searchCriteriaFirstGroup,
          field.searchCriteriaSecondGroup,
          0,
          1,
          operator.index,
          CONDITIONS_MUST.contains.filter,
          CONDITIONS_MUST_NOT.notContains.filter,
          field.responseValueFirstGroup,
          val
        );
      });
    });
  });

  it('Delete Created Service', () => {
    deleteCreatedService(
      MYSQL.database,
      service_name,
      API_SERVICE.databaseServices
    );
  });

  after(() => {
    Cypress.session.clearAllSavedSessions();
  });
});
