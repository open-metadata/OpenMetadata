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
const COLUMN_CUSTOM_METRIC = {
  name: `tableCustomMetric-${uuid()}`,
  column: DATABASE_SERVICE.entity.columns[0].name,
  expression: `SELECT * FROM ${DATABASE_SERVICE.entity.name}`,
};

const validateForm = (isColumnMetric = false) => {
  // error messages
  cy.get('#name_help').scrollIntoView().should('contain', 'Name is required');

  cy.get('#expression_help')
    .scrollIntoView()
    .should('contain', 'SQL Query is required');
  if (isColumnMetric) {
    cy.get('#columnName_help')
      .scrollIntoView()
      .should('contain', 'Column is required');
  }

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

const createCustomMetric = ({
  term,
  serviceName,
  entity,
  isColumnMetric = false,
  metric,
}) => {
  interceptURL('PUT', '/api/v1/tables/*/customMetric', 'createCustomMetric');
  interceptURL(
    'GET',
    '/api/v1/tables/name/*?fields=customMetrics,columns&include=all',
    'getCustomMetric'
  );
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });
  // Click on create custom metric button
  cy.get('[data-testid="profiler"]').click();
  verifyResponseStatusCode('@getCustomMetric', 200);
  if (isColumnMetric) {
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .click();
  }
  cy.get('[data-testid="profiler-add-table-test-btn"]').click();
  cy.get('[data-testid="metric"]').click();

  // validate redirection and cancel button
  cy.get('[data-testid="heading"]').should('be.visible');
  cy.get(
    `[data-testid=${
      isColumnMetric
        ? 'profiler-tab-container'
        : 'table-profiler-chart-container'
    }]`
  ).should('be.visible');
  cy.get('[data-testid="cancel-button"]').click();
  verifyResponseStatusCode('@getCustomMetric', 200);
  cy.url().should('include', 'profiler');
  cy.get('[data-testid="heading"]')
    .invoke('text')
    .should('equal', isColumnMetric ? 'Column Profile' : 'Table Profile');

  // Click on create custom metric button
  cy.get('[data-testid="profiler-add-table-test-btn"]').click();
  cy.get('[data-testid="metric"]').click();
  cy.get('[data-testid="submit-button"]').click();

  validateForm(isColumnMetric);

  // fill form and submit
  cy.get('#name').type(metric.name);
  if (isColumnMetric) {
    cy.get('#columnName').click();
    cy.get(`[title="${metric.column}"]`).click();
  }
  cy.get('.CodeMirror-scroll').click().type(metric.expression);
  cy.get('[data-testid="submit-button"]').click();
  verifyResponseStatusCode('@createCustomMetric', 200);
  toastNotification(`${metric.name} created successfully.`);
  verifyResponseStatusCode('@getCustomMetric', 200);

  // verify the created custom metric
  cy.url().should('include', 'profiler');
  cy.get('[data-testid="heading"]')
    .invoke('text')
    .should('equal', isColumnMetric ? 'Column Profile' : 'Table Profile');
  cy.get(`[data-testid="${metric.name}-custom-metrics"]`)
    .scrollIntoView()
    .should('be.visible');
};

const editCustomMetric = ({
  term,
  serviceName,
  entity,
  isColumnMetric = false,
  metric,
}) => {
  interceptURL(
    'GET',
    '/api/v1/tables/name/*?fields=customMetrics,columns&include=all',
    'getCustomMetric'
  );
  interceptURL('PUT', '/api/v1/tables/*/customMetric', 'editCustomMetric');
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });
  cy.get('[data-testid="profiler"]').click();
  verifyResponseStatusCode('@getCustomMetric', 200);
  if (isColumnMetric) {
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .click();
    cy.get('[data-row-key="user_id"]').contains(metric.column).click();
  }
  cy.get(`[data-testid="${metric.name}-custom-metrics"]`)
    .scrollIntoView()
    .should('be.visible');
  cy.get(`[data-testid="${metric.name}-custom-metrics-menu"]`).click();
  cy.get(`[data-menu-id*="edit"]`).click();

  // validate cancel button
  cy.get('.ant-modal-content').should('be.visible');
  cy.get('.ant-modal-footer').contains('Cancel').click();
  cy.get('.ant-modal-content').should('not.exist');

  // edit expression and submit
  cy.get(`[data-testid="${metric.name}-custom-metrics-menu"]`).click();
  cy.get(`[data-menu-id*="edit"]`).click();
  cy.get('.CodeMirror-scroll').click().type('updated');
  cy.get('.ant-modal-footer').contains('Save').click();
  cy.wait('@editCustomMetric').then(({ request }) => {
    expect(request.body.expression).to.have.string('updated');
  });
  toastNotification(`${metric.name} updated successfully.`);
};
const deleteCustomMetric = ({
  term,
  serviceName,
  entity,
  metric,
  isColumnMetric = false,
}) => {
  interceptURL(
    'GET',
    '/api/v1/tables/name/*?fields=customMetrics,columns&include=all',
    'getCustomMetric'
  );
  interceptURL(
    'DELETE',
    isColumnMetric
      ? `/api/v1/tables/*/customMetric/${metric.column}/${metric.name}`
      : `/api/v1/tables/*/customMetric/${metric.name}`,
    'deleteCustomMetric'
  );
  visitEntityDetailsPage({
    term,
    serviceName,
    entity,
  });
  cy.get('[data-testid="profiler"]').click();
  verifyResponseStatusCode('@getCustomMetric', 200);
  if (isColumnMetric) {
    cy.get('[data-testid="profiler-tab-left-panel"]')
      .contains('Column Profile')
      .click();
    cy.get('[data-row-key="user_id"]').contains(metric.column).click();
  }
  cy.get(`[data-testid="${metric.name}-custom-metrics"]`)
    .scrollIntoView()
    .should('be.visible');
  cy.get(`[data-testid="${metric.name}-custom-metrics-menu"]`).click();
  cy.get(`[data-menu-id*="delete"]`).click();
  cy.get('.ant-modal-header').should('contain', `Delete ${metric.name}`);
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  cy.get('[data-testid="confirm-button"]').click();
  verifyResponseStatusCode('@deleteCustomMetric', 200);
  toastNotification(`${metric.name} deleted successfully!`);
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
    createCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  it("Edit table custom metric's expression", () => {
    editCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  it('Delete table custom metric', () => {
    deleteCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: TABLE_CUSTOM_METRIC,
    });
  });

  it('Create column custom metric', () => {
    createCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });

  it("Edit column custom metric's expression", () => {
    editCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });

  it('Delete column custom metric', () => {
    deleteCustomMetric({
      term: DATABASE_SERVICE.entity.name,
      serviceName: DATABASE_SERVICE.service.name,
      entity: DATA_ASSETS.tables,
      metric: COLUMN_CUSTOM_METRIC,
      isColumnMetric: true,
    });
  });
});
