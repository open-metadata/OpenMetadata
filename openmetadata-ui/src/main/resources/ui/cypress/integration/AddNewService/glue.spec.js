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

import { deleteCreatedService, editOwnerforCreatedService, goToAddNewServicePage, testServiceCreationAndIngestion, uuid } from '../../common/common';
import { SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Glue';
const serviceName = `${serviceType}-ct-test-${uuid()}`;

describe('Glue Ingestion', () => {
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
      // no filters
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

  it('Edit and validate owner', () => {
    editOwnerforCreatedService(SERVICE_TYPE.Database, serviceName);
  });

  it('delete created service', () => {
    deleteCreatedService(SERVICE_TYPE.Database, serviceName);
  });
});
