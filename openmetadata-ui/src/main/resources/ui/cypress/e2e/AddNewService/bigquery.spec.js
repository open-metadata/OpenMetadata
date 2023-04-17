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

const serviceType = 'BigQuery';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'testtable';
const description = `This is ${serviceName} description`;
const filterPattern = 'testschema';

describe('BigQuery Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      const clientEmail = Cypress.env('bigqueryClientEmail');
      cy.get('.form-group > #root\\/type')
        .scrollIntoView()
        .type('service_account');
      cy.get(':nth-child(3) > .form-group > #root\\/projectId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryProjectId'));
      cy.get('#root\\/privateKeyId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKeyId'));
      cy.get('#root\\/privateKey')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKey'));
      cy.get('#root\\/clientEmail').scrollIntoView().type(clientEmail);
      cy.get('#root\\/clientId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryClientId'));
      cy.get('#root\\/clientX509CertUrl')
        .scrollIntoView()
        .type(
          `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
            clientEmail
          )}`
        );
      cy.get('[data-testid="add-item-Taxonomy Project IDs"]')
        .scrollIntoView()
        .click();
      cy.get('#root\\/taxonomyProjectID_0')
        .scrollIntoView()
        .type(Cypress.env('bigqueryProjectIdTaxonomy'));
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
