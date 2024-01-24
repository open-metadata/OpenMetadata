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
import { checkServiceFieldSectionHighlighting } from '../common';
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { Services } from '../Utils/Services';

class MetabaseIngestionClass extends ServiceBaseClass {
  name: string;
  filterPattern;

  constructor() {
    super(Services.Database, 'cypress-BigQuery', 'BigQuery', 'testtable');

    this.filterPattern = 'testschema';
  }

  createService() {
    super.createService();
  }

  updateService() {
    // super.updateService();
    // Issue with searching ingested data
  }

  fillConnectionDetails() {
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
  }

  fillIngestionDetails() {
    cy.get('#root\\/schemaFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.filterPattern}{enter}`);
  }

  deleteService() {
    super.deleteService();
  }
}

export default MetabaseIngestionClass;
