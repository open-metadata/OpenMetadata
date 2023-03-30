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

import {
    deleteCreatedService,
    editOwnerforCreatedService,
    goToAddNewServicePage,
    handleIngestionRetry,
    interceptURL,
    scheduleIngestion,
    testServiceCreationAndIngestion,
    updateDescriptionForIngestedTables,
    uuid,
    verifyResponseStatusCode,
    visitEntityDetailsPage
} from '../../common/common';
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
      cy.get('#root\\/password')
        .scrollIntoView()
        .type(Cypress.env('postgresPassword'));
      cy.get('#root\\/hostPort')
        .scrollIntoView()
        .type(Cypress.env('postgresHostPort'));
      cy.get('#root\\/database')
        .scrollIntoView()
        .type(Cypress.env('postgresDatabase'));
    };

    const addIngestionInput = () => {
      cy.get('[data-testid="schema-filter-pattern-checkbox"]')
        .invoke('show')
        .trigger('mouseover')
        .check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .scrollIntoView()
        .should('be.visible')
        .type(filterPattern);
    };

    testServiceCreationAndIngestion(
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName
    );
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
    cy.get('[data-testid="appbar-item-settings"]')
      .should('be.visible')
      .click({ force: true });
    verifyResponseStatusCode('@getSettingsPage', 200);
    // Services page
    interceptURL('GET', '/api/v1/services/*', 'getServices');

    cy.get('[data-testid="settings-left-panel"]')
      .contains(SERVICE_TYPE.Database)
      .should('be.visible')
      .click();

    verifyResponseStatusCode('@getServices', 200);
    cy.intercept('/api/v1/services/ingestionPipelines?*').as('ingestionData');
    interceptURL(
      'GET',
      '/api/v1/system/config/pipeline-service-client',
      'airflow'
    );
    cy.get(`[data-testid="service-name-${serviceName}"]`)
      .should('exist')
      .click();
    cy.get('[data-testid="tabs"]').should('exist');
    cy.wait('@ingestionData');
    verifyResponseStatusCode('@airflow', 200);
    cy.get('[data-testid="Ingestions"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="ingestion-details-container"]').should('exist');
    cy.get('[data-testid="add-new-ingestion-button"]')
      .should('be.visible')
      .click();
    cy.get('#menu-item-1').scrollIntoView().contains('Usage Ingestion').click();
    cy.get('[data-testid="next-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    scheduleIngestion();

    cy.wait('@deployIngestion').then(() => {
      cy.get('[data-testid="view-service-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      handleIngestionRetry('database', true, 0, 'usage');
    });
  });

  it('Verify if usage is ingested properly', () => {
    interceptURL(
      'GET',
      `/api/v1/tables/name/${serviceName}.*.*${tableName}?fields=*&include=all`,
      'entityDetailsPage'
    );
    visitEntityDetailsPage(tableName, serviceName, 'tables');
    verifyResponseStatusCode('@entityDetailsPage', 200);
    interceptURL(
      'GET',
      '/api/v1/search/query?q=&index=query_search_index*',
      'queriesTab'
    );
    cy.get('[data-testid="Queries"]').should('be.visible').trigger('click');
    verifyResponseStatusCode('@queriesTab', 200);
    // Validate that the triggered query is visible in the queries container
    cy.get('[data-testid="queries-container"]')
      .should('be.visible')
      .should('contain', selectQuery);
    // Validate queries count is greater than 1
    cy.get('[data-testid="entity-summary-details"]')
      .invoke('text')
      .should('not.contain', '0 Queries');
    // Validate schema contains frequently joined tables and columns
    cy.get('[data-testid="Schema"]').should('be.visible').click();
    cy.get('[data-testid="related-tables-data"]').should('be.visible');
    cy.get('[data-testid="frequently-joined-columns"]').should('be.visible');
  });

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });
});
