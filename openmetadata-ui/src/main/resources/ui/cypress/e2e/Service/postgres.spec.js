/*
 *  Copyright 2022 Collate.
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
// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />
import {
  checkServiceFieldSectionHighlighting,
  deleteCreatedService,
  goToAddNewServicePage,
  handleIngestionRetry,
  interceptURL,
  scheduleIngestion,
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Postgres';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'order_items';
const description = `This is ${serviceName} description`;
const filterPattern = 'sales';
const clearQuery = 'select pg_stat_statements_reset()';
const selectQuery =
  'SELECT * FROM sales.order_items oi INNER JOIN sales.orders o ON oi.order_id=o.order_id';

describe('Postgres Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Trigger select query', () => {
    cy.postgreSQL(clearQuery);
    cy.postgreSQL(selectQuery);
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root\\/username')
        .scrollIntoView()
        .type(Cypress.env('postgresUsername'));
      checkServiceFieldSectionHighlighting('username');
      cy.get('#root\\/authType\\/password')
        .scrollIntoView()
        .type(Cypress.env('postgresPassword'));
      checkServiceFieldSectionHighlighting('password');
      cy.get('#root\\/hostPort')
        .scrollIntoView()
        .type(Cypress.env('postgresHostPort'));
      checkServiceFieldSectionHighlighting('hostPort');
      cy.get('#root\\/database')
        .scrollIntoView()
        .type(Cypress.env('postgresDatabase'));
      checkServiceFieldSectionHighlighting('database');
    };

    const addIngestionInput = () => {
      cy.get('#root\\/schemaFilterPattern\\/includes')
        .scrollIntoView()
        .type(`${filterPattern}{enter}`);
    };

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName,
      serviceCategory: SERVICE_TYPE.Database,
    });
  });

  it('Update table description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      tableName,
      description,
      SERVICE_TYPE.Database,
      'tables'
    );
  });

  it('Add Usage ingestion', () => {
    interceptURL(
      'GET',
      'api/v1/teams/name/Organization?fields=*',
      'getSettingsPage'
    );
    interceptURL(
      'POST',
      '/api/v1/services/ingestionPipelines/deploy/*',
      'deployIngestion'
    );
    interceptURL(
      'GET',
      '/api/v1/permissions/ingestionPipeline/name/*',
      'ingestionPermissions'
    );

    visitServiceDetailsPage(
      { type: SERVICE_TYPE.Database, name: serviceName },
      false
    );

    cy.get('[data-testid="ingestions"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@ingestionPermissions', 200);
    cy.get('[data-testid="ingestion-details-container"]').should('exist');
    cy.get('[data-testid="add-new-ingestion-button"]')
      .should('be.visible')
      .click();
    cy.get('[data-menu-id*="usage"')
      .scrollIntoView()
      .contains('Usage Ingestion')
      .click();
    cy.get('[data-testid="submit-btn"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    scheduleIngestion();

    cy.wait('@deployIngestion').then(() => {
      interceptURL(
        'GET',
        '/api/v1/services/ingestionPipelines?*',
        'ingestionPipelines'
      );
      interceptURL('GET', '/api/v1/services/*/name/*', 'serviceDetails');
      interceptURL(
        'GET',
        '/api/v1/services/ingestionPipelines/status',
        'getIngestionPipelineStatus'
      );
      cy.get('[data-testid="view-service-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();
      verifyResponseStatusCode('@getIngestionPipelineStatus', 200);
      verifyResponseStatusCode('@serviceDetails', 200);
      verifyResponseStatusCode('@ingestionPipelines', 200);

      handleIngestionRetry('database', true, 0, 'usage');
    });
  });

  it('Verify if usage is ingested properly', () => {
    interceptURL(
      'GET',
      `/api/v1/tables/name/${serviceName}.*.*${tableName}?fields=*&include=all`,
      'entityDetailsPage'
    );
    visitEntityDetailsPage({
      term: tableName,
      serviceName: serviceName,
      entity: 'tables',
    });
    verifyResponseStatusCode('@entityDetailsPage', 200);
    interceptURL('GET', '/api/v1/queries?*', 'queriesTab');
    cy.get('[data-testid="table_queries"]')
      .should('be.visible')
      .trigger('click');
    verifyResponseStatusCode('@queriesTab', 200);

    // Validate that the duration is in sec or not
    cy.get('[data-testid="query-run-duration"]')
      .should('be.visible')
      .should('contain', '1.113 sec');

    // Validate that the triggered query is visible in the queries container
    cy.get('[data-testid="queries-container"]')
      .should('be.visible')
      .should('contain', selectQuery);
    // Validate queries count is greater than 1
    cy.get('[data-testid="table_queries"] [data-testid="filter-count"]')
      .invoke('text')
      .should('equal', '1');
    // Validate schema contains frequently joined tables and columns
    cy.get('[data-testid="schema"]').should('be.visible').click();
    cy.get('[data-testid="related-tables-data"]').should('be.visible');
    cy.get('[data-testid="frequently-joined-columns"]').should('be.visible');
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });
});
