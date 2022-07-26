/*
 *  Copyright 2021 Collate
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

import { deleteCreatedService, goToAddNewServicePage, testServiceCreationAndIngestion, uuid } from '../../common/common';


const serviceType = 'BigQuery';
const serviceName = `${serviceType}-ct-test-${uuid()}`;

describe('BigQuery Ingestion', () => {
  it('add and ingest data', () => {
    goToAddNewServicePage();
    const connectionInput = () => {
      const clientEmail = Cypress.env('bigqueryClientEmail');
      cy.get('.form-group > #root_type')
        .scrollIntoView()
        .type('service_account');
      cy.get(':nth-child(3) > .form-group > #root_projectId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryProjectId'));
      cy.get('#root_privateKeyId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKeyId'));
      cy.get('#root_privateKey')
        .scrollIntoView()
        .type(Cypress.env('bigqueryPrivateKey'));
      cy.get('#root_clientEmail').scrollIntoView().type(clientEmail);
      cy.get('#root_clientId')
        .scrollIntoView()
        .type(Cypress.env('bigqueryClientId'));
      cy.get('#root_authUri')
        .scrollIntoView()
        .type('https://accounts.google.com/o/oauth2/auth');
      cy.get('#root_tokenUri')
        .scrollIntoView()
        .type('https://oauth2.googleapis.com/token');
      cy.get('#root_authProviderX509CertUrl')
        .scrollIntoView()
        .type('https://www.googleapis.com/oauth2/v1/certs');
      cy.get('#root_clientX509CertUrl')
        .scrollIntoView()
        .type(
          `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(
            clientEmail
          )}`
        );
    };

    const addIngestionInput = () => {
      // no schema or database filters
    };

    testServiceCreationAndIngestion(
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName
    );
  });

  it('delete created service', () => {
    deleteCreatedService('Database', serviceName);
  });
});
