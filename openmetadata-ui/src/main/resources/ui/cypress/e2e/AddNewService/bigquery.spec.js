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
  checkServiceFieldSectionHighlighting,
  deleteCreatedService,
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
      cy.get('.form-group > #root\\/credentials\\/gcpConfig\\/type')
        .scrollIntoView()
        .type('service_account');
      checkServiceFieldSectionHighlighting('type');
      cy.get('#root\\/credentials\\/gcpConfig\\/projectId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryProjectId'));
      checkServiceFieldSectionHighlighting('projectId');
      cy.get('#root\\/credentials\\/gcpConfig\\/privateKeyId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKeyId'));
      checkServiceFieldSectionHighlighting('privateKeyId');
      cy.get('#root\\/credentials\\/gcpConfig\\/privateKey')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKey'));
      checkServiceFieldSectionHighlighting('privateKey');
      cy.get('#root\\/credentials\\/gcpConfig\\/clientEmail')
        .scrollIntoView()
        .type(clientEmail);
      checkServiceFieldSectionHighlighting('clientEmail');
      cy.get('#root\\/credentials\\/gcpConfig\\/clientId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryClientId'));
      checkServiceFieldSectionHighlighting('clientId');
      cy.get('#root\\/credentials\\/gcpConfig\\/clientX509CertUrl')
        .scrollIntoView()
        .type(
          `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
            clientEmail
          )}`
        );
      checkServiceFieldSectionHighlighting('clientX509CertUrl');
      cy.get('[data-testid="add-item-Taxonomy Project IDs"]')
        .scrollIntoView()
        .click();
      checkServiceFieldSectionHighlighting('taxonomyProjectID');
      cy.get('#root\\/taxonomyProjectID\\/0')
        .scrollIntoView()
        .type(Cypress.env('bigqueryProjectIdTaxonomy'));
      checkServiceFieldSectionHighlighting('taxonomyProjectID');
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

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Database,
      serviceName,
      API_SERVICE.databaseServices
    );
  });
});
