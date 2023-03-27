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
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import {
  API_SERVICE,
  DBT,
  HTTP_CONFIG_SOURCE,
  SERVICE_TYPE,
} from '../../constants/constants';
import { REDSHIFT } from '../../constants/service.constants';

describe('RedShift Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root/username').type(Cypress.env('redshiftUsername'));
      cy.get('#root/password')
        .scrollIntoView()
        .type(Cypress.env('redshiftPassword'));
      cy.get('#root/hostPort')
        .scrollIntoView()
        .type(Cypress.env('redshiftHost'));
      cy.get('#root/database')
        .scrollIntoView()
        .type(Cypress.env('redshiftDatabase'));
    };

    const addIngestionInput = () => {
      // no schema or database filters
      cy.get('[data-testid="schema-filter-pattern-checkbox"]')
        .invoke('show')
        .trigger('mouseover')
        .check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .should('be.visible')
        .type('dbt_jaffle');
      cy.get('[data-testid="toggle-button-include-views"]')
        .should('be.visible')
        .click();
    };

    testServiceCreationAndIngestion(
      REDSHIFT.serviceType,
      connectionInput,
      addIngestionInput,
      REDSHIFT.serviceName,
      'database',
      true
    );
  });

  it('Update table description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      REDSHIFT.serviceName,
      REDSHIFT.tableName,
      REDSHIFT.description,
      SERVICE_TYPE.Database,
      'tables'
    );
  });

  it('Add DBT ingestion', () => {
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
    cy.get(`[data-testid="service-name-${REDSHIFT.serviceName}"]`)
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
    cy.get('[data-testid="list-item"]').contains('Add dbt Ingestion').click();
    // Add DBT ingestion
    cy.contains('Add dbt Ingestion').should('be.visible');
    cy.get('[data-testid="dbt-source"]').should('be.visible').click();
    cy.get('.ant-select-item-option-content')
      .contains('HTTP Config Source')
      .click();
    cy.get('[data-testid="catalog-url"]')
      .scrollIntoView()
      .should('be.visible')
      .type(HTTP_CONFIG_SOURCE.DBT_CATALOG_HTTP_PATH);
    cy.get('[data-testid="manifest-url"]')
      .scrollIntoView()
      .should('be.visible')
      .type(HTTP_CONFIG_SOURCE.DBT_MANIFEST_HTTP_PATH);
    cy.get('[data-testid="run-result-file"]')
      .scrollIntoView()
      .should('be.visible')
      .type(HTTP_CONFIG_SOURCE.DBT_RUN_RESTLTS_FILE_PATH);

    cy.get('[data-testid="submit-btn"]').should('be.visible').click();

    scheduleIngestion();

    cy.wait('@deployIngestion').then(() => {
      cy.get('[data-testid="view-service-button"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      handleIngestionRetry('database', true, 0, 'dbt');
    });
  });

  it('Validate DBT is ingested properly', () => {
    // Verify DBT tags
    interceptURL(
      'GET',
      `/api/v1/tags?fields=usageCount&parent=${DBT.classification}&limit=10`,
      'getTagList'
    );
    cy.get('[data-testid="governance"]')
      .should('exist')
      .should('be.visible')
      .click({ force: true });
    cy.get('[data-testid="appbar-item-tags"]')
      .should('exist')
      .should('be.visible')
      .click();
    verifyResponseStatusCode('@getTagList', 200);
    // Verify DBT tag category is added
    cy.get('[data-testid="tag-name"]')
      .should('be.visible')
      .should('contain', DBT.classification);

    cy.get('.ant-table-row')
      .should('be.visible')
      .should('contain', DBT.tagName);

    // Verify DBT in table entity
    visitEntityDetailsPage(REDSHIFT.DBTTable, REDSHIFT.serviceName, 'tables');

    // Verify tags
    cy.get('[data-testid="entity-tags"]')
      .should('exist')
      .should('be.visible')
      .should('contain', `${DBT.classification}.${DBT.tagName}`);
    // Verify DBT tab is present
    cy.get('[data-testid="dbt"]').should('exist').should('be.visible');
    cy.get('[data-testid="dbt"]').click();
    // Verify query is present in the DBT tab
    cy.get('.CodeMirror').should('be.visible').should('contain', DBT.dbtQuery);

    cy.get('[data-testid="Lineage"]').should('be.visible').click();

    cy.get('[data-testid="lineage-entity"]').should(
      'contain',
      DBT.dbtLineageNodeLabel
    );

    // Verify Data Quality
    cy.get('[data-testid="Profiler & Data Quality"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="profiler-tab-left-panel"]')
      .should('be.visible')
      .contains('Data Quality')
      .click();

    cy.get(`[data-testid=${DBT.dataQualityTest1}]`)
      .should('exist')
      .should('be.visible')
      .should('contain', DBT.dataQualityTest1);
    cy.get(`[data-testid=${DBT.dataQualityTest2}]`)
      .should('exist')
      .should('be.visible')
      .should('contain', DBT.dataQualityTest2);
  });

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(
      SERVICE_TYPE.Database,
      REDSHIFT.serviceName,
      API_SERVICE.databaseServices
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      REDSHIFT.serviceName,
      API_SERVICE.databaseServices
    );
  });
});
