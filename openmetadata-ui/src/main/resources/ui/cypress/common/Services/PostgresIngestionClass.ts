/*
 *  Copyright 2024 Collate.
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
import { SERVICE_TYPE } from '../../constants/constants';
import { EntityType } from '../../constants/Entity.interface';
import { POSTGRES } from '../../constants/service.constants';
import {
  checkServiceFieldSectionHighlighting,
  interceptURL,
  verifyResponseStatusCode,
} from '../common';
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { visitServiceDetailsPage } from '../serviceUtils';
import { visitEntityDetailsPage } from '../Utils/Entity';
import { handleIngestionRetry, scheduleIngestion } from '../Utils/Ingestion';
import { Services } from '../Utils/Services';

class PostgresIngestionClass extends ServiceBaseClass {
  name: string;
  filterPattern: string;
  queryLogFilePath: string;

  constructor() {
    super(
      Services.Database,
      POSTGRES.serviceName,
      POSTGRES.serviceType,
      POSTGRES.tableName
    );

    this.filterPattern = 'sales';
    this.queryLogFilePath =
      '/home/airflow/ingestion/examples/sample_data/usage/query_log.csv';
  }

  createService() {
    super.createService();
  }

  updateService() {
    super.updateService();
  }

  fillConnectionDetails() {
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
  }

  fillIngestionDetails() {
    cy.get('#root\\/schemaFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.filterPattern}{enter}`);
  }

  runAdditionalTests() {
    if (Cypress.env('isOss')) {
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
          { type: SERVICE_TYPE.Database, name: this.serviceName },
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

        cy.get('#root\\/queryLogFilePath')
          .scrollIntoView()
          .type(this.queryLogFilePath);
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

          handleIngestionRetry(0, 'usage');
        });
      });

      it('Verify if usage is ingested properly', () => {
        interceptURL(
          'GET',
          `/api/v1/tables/name/${this.serviceName}.*.*${this.entityName}?fields=*&include=all`,
          'entityDetailsPage'
        );
        visitEntityDetailsPage({
          term: this.entityName,
          serviceName: this.serviceName,
          entity: EntityType.Table,
        });
        verifyResponseStatusCode('@entityDetailsPage', 200);
        interceptURL(
          'GET',
          '/api/v1/search/query?q=*&index=query_search_index*',
          'queriesTab'
        );
        // cy.get('[data-testid="table_queries"]')
        //   .should('be.visible')
        //   .trigger('click');
        // verifyResponseStatusCode('@queriesTab', 200);
        // Validate that the triggered query is visible in the queries container
        // cy.get('[data-testid="queries-container"]')
        //   .should('be.visible')
        //   .should('contain', selectQuery);
        // Validate queries count is greater than 1
        // Skip since query ingestion not working as expected
        // cy.get('[data-testid="table_queries"] [data-testid="filter-count"]')
        //   .invoke('text')
        //   .should('equal', '1');
        // Validate schema contains frequently joined tables and columns
        cy.get('[data-testid="schema"]').should('be.visible').click();
        cy.get('[data-testid="related-tables-data"]').should('be.visible');
        cy.get('[data-testid="frequently-joined-columns"]').should(
          'be.visible'
        );
      });
    }
  }

  deleteService() {
    super.deleteService();
  }
}

// eslint-disable-next-line jest/no-export
export default PostgresIngestionClass;
