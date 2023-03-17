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
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
} from '../../common/common';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Superset';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = "World Bank's Data";
const description = `This is ${serviceName} description`;

describe('Superset Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Dashboard);

    // Select Dashboard services
    cy.get('[data-testid="service-category"]').should('be.visible').click();
    cy.get('.ant-select-item-option-content')
      .contains('Dashboard Services')
      .click();

    const connectionInput = () => {
      cy.get('#root_connection_username').type(Cypress.env('supersetUsername'));
      cy.get('#root_connection_password')
        .scrollIntoView()
        .type(Cypress.env('supersetPassword'));
      cy.get('#root_connection_hostPort')
        .scrollIntoView()
        .focus()
        .clear()
        .type(Cypress.env('supersetHostPort'));
    };

    const addIngestionInput = () => {
      cy.get('[data-testid="dashboard-filter-pattern-checkbox"]')
        .invoke('show')
        .trigger('mouseover')
        .check();
      cy.get('[data-testid="filter-pattern-includes-dashboard"]')
        .should('be.visible')
        .type(tableName);
    };

    testServiceCreationAndIngestion(
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName,
      'dashboard'
    );
  });

  it('Update table description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      tableName,
      description,
      SERVICE_TYPE.Dashboard,
      'dashboards'
    );
  });

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(
      SERVICE_TYPE.Dashboard,
      serviceName,
      API_SERVICE.dashboardServices
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Dashboard,
      serviceName,
      API_SERVICE.dashboardServices
    );
  });
});
