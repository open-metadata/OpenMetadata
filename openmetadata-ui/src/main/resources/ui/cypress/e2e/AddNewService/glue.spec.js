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

const serviceType = 'Glue';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'cloudfront_logs2';
const description = `This is ${serviceName} description`;
const filterPattern = 'default';

describe('Glue Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root_awsConfig_awsAccessKeyId')
        .scrollIntoView()
        .type(Cypress.env('glueAwsAccessKeyId'));
      cy.get('#root_awsConfig_awsSecretAccessKey')
        .scrollIntoView()
        .type(Cypress.env('glueAwsSecretAccessKey'));
      cy.get('#root_awsConfig_awsRegion')
        .scrollIntoView()
        .type(Cypress.env('glueAwsRegion'));
      cy.get('#root_awsConfig_endPointURL')
        .scrollIntoView()
        .type(Cypress.env('glueEndPointURL'));
      cy.get('#root_storageServiceName')
        .scrollIntoView()
        .type(Cypress.env('glueStorageServiceName'));
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
      serviceName,
      'database',
      false
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
