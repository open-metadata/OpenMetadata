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
  interceptURL,
  toastNotification,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { createEntityTable, hardDeleteService } from '../../common/EntityUtils';
import {
  DATA_ASSETS,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  uuid,
} from '../../constants/constants';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { SERVICE_CATEGORIES } from '../../constants/service.constants';

// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

const TABLE_CUSTOM_METRIC = {
  name: `tableCustomMetric-${uuid()}`,
  expression: `SELECT * FROM ${DATABASE_SERVICE.entity.name}`,
};

const validateForm = () => {
  // error messages
  cy.get('#name_help').scrollIntoView().should('contain', 'Name is required');

  cy.get('#expression_help')
    .scrollIntoView()
    .should('contain', 'SQL Query is required');

  // max length validation
  cy.get('#name').scrollIntoView().type(INVALID_NAMES.MAX_LENGTH);
  cy.get('#name_help').should('contain', NAME_MAX_LENGTH_VALIDATION_ERROR);

  // with special char validation
  cy.get('#name')
    .should('be.visible')
    .clear()
    .type(INVALID_NAMES.WITH_SPECIAL_CHARS);
  cy.get('#name_help').should('contain', NAME_VALIDATION_ERROR);
  cy.get('#name').clear();
};

describe('Custom Metric', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createEntityTable({
        token,
        ...DATABASE_SERVICE,
        tables: [DATABASE_SERVICE.entity],
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      hardDeleteService({
        token,
        serviceFqn: DATABASE_SERVICE.service.name,
        serviceType: SERVICE_CATEGORIES.DATABASE_SERVICES,
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('Create table custom metric', () => {
    interceptURL('PUT', '/api/v1/tables/*/customMetric', 'createCustomMetric');
    interceptURL(
      'GET',
      '/api/v1/tables/name/*?fields=customMetrics,columns&include=all',
      'getCustomMetric'
    );
    visitEntityDetailsPage({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
    });
    // Click on create custom metric button
    cy.get('[data-testid="profiler"]').click();
    cy.get('[data-testid="profiler-add-table-test-btn"]').click();
    cy.get('[data-testid="metric"]').click();

    // validate redirection and cancel button
    cy.get('[data-testid="heading"]').should('be.visible');
    cy.get('[data-testid="table-profiler-chart-container"]').should(
      'be.visible'
    );
    cy.get('[data-testid="cancel-button"]').click();
    cy.url().should('include', 'profiler');
    cy.get('[data-testid="heading"]')
      .invoke('text')
      .should('equal', 'Table Profile');

    // Click on create custom metric button
    cy.get('[data-testid="profiler-add-table-test-btn"]').click();
    cy.get('[data-testid="metric"]').click();
    cy.get('[data-testid="submit-button"]').click();

    validateForm();

    // fill form and submit
    cy.get('#name').type(TABLE_CUSTOM_METRIC.name);
    cy.get('.CodeMirror-scroll').click().type(TABLE_CUSTOM_METRIC.expression);
    cy.get('[data-testid="submit-button"]').click();
    verifyResponseStatusCode('@createCustomMetric', 200);
    toastNotification(`${TABLE_CUSTOM_METRIC.name} created successfully.`);
    verifyResponseStatusCode('@getCustomMetric', 200);

    // verify the created custom metric
    cy.url().should('include', 'profiler');
    cy.get('[data-testid="heading"]')
      .invoke('text')
      .should('equal', 'Table Profile');
    cy.get(`[data-testid="${TABLE_CUSTOM_METRIC.name}-custom-metrics"]`)
      .scrollIntoView()
      .should('be.visible');
  });
});
