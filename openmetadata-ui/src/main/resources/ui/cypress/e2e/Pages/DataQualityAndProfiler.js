/*
 *  Copyright 2022 Collate
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

/// <reference types="cypress" />

import { goToAddNewServicePage, handleIngestionRetry, interceptURL, scheduleIngestion, searchEntity, testServiceCreationAndIngestion, uuid, verifyResponseStatusCode } from '../../common/common';
import { SERVICE_TYPE, TEAM_ENTITY } from '../../constants/constants';

const serviceType = 'Mysql';
const serviceName = `${serviceType}-ct-test-${uuid()}`;

describe('Data Quality and Profiler should work properly', () => {
  it('Add and ingest mysql data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root_username').type('openmetadata_user');
      cy.get('#root_password').type('openmetadata_password');
      cy.get('#root_hostPort').type('172.16.239.10:3306');
      cy.get('#root_databaseSchema').type('openmetadata_db');
    };

    const addIngestionInput = () => {
      cy.get('[data-testid="schema-filter-pattern-checkbox"]').check();
      cy.get('[data-testid="filter-pattern-includes-schema"]')
        .should('be.visible')
        .type('openmetadata_db');
    };

    testServiceCreationAndIngestion(
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName
    );
  });

  it.only('Add Profiler ingestion', () => {
    cy.goToHomePage();
    searchEntity(TEAM_ENTITY);

    // click on the 1st result and go to entity details page and follow the entity
    interceptURL('GET', '/api/v1/feed*', 'getEntityDetails');
    cy.get('[data-testid="table-link"]')
      .first()
      .contains(TEAM_ENTITY, { matchCase: false })
      .click();
    verifyResponseStatusCode('@getEntityDetails', 200);

    cy.get('[data-testid="Profiler & Data Quality"]')
      .should('be.visible')
      .click();

    cy.get('[data-testid="service-summary"] [data-testid="service"]')
      .should('be.visible')
      .click();
    cy.intercept('/api/v1/services/ingestionPipelines?*').as('ingestionData');
    cy.get(`[data-testid="service-name-${serviceName}"]`)
      .should('exist')
      .click();
    // cy.get('[data-testid="service-name-Mysql-ct-test-902002"]')
    //   .should('be.visible')
    //   .click();
    cy.get('[data-testid="tabs"]').should('exist');
    cy.wait('@ingestionData');
    cy.get('[data-testid="Ingestions"]')
      .scrollIntoView()
      .should('be.visible')
      .click();
    cy.get('[data-testid="ingestion-details-container"]').should('exist');
    cy.get('[data-testid="add-new-ingestion-button"]')
      .should('be.visible')
      .click();
    cy.get('#menu-item-1')
      .scrollIntoView()
      .contains('Profiler Ingestion')
      .click();
    cy.get('[data-testid="next-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    scheduleIngestion();

    // wait for ingestion to run
    cy.clock();
    cy.wait(10000);

    cy.get('[data-testid="view-service-button"]')
      .scrollIntoView()
      .should('be.visible')
      .click();

    handleIngestionRetry('database', true, 0, 'profiler');
  });
});
