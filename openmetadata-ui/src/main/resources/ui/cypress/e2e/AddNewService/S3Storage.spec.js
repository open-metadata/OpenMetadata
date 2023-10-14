/*
 *  Copyright 2023 Collate.
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
import {
  API_SERVICE,
  MYDATA_SUMMARY_OPTIONS,
  SERVICE_TYPE,
} from '../../constants/constants';

const serviceType = 'S3';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'cypress-bucket';
const description = `This is ${tableName} description`;

const connectionInput = () => {
  cy.get('#root\\/awsConfig\\/awsAccessKeyId').type(
    Cypress.env('s3StorageAccessKeyId')
  );
  checkServiceFieldSectionHighlighting('awsAccessKeyId');
  cy.get('#root\\/awsConfig\\/awsSecretAccessKey').type(
    Cypress.env('s3StorageSecretAccessKey')
  );
  checkServiceFieldSectionHighlighting('awsSecretAccessKey');
  cy.get('#root\\/awsConfig\\/awsRegion').type('us');
  checkServiceFieldSectionHighlighting('awsRegion');
  cy.get('#root\\/awsConfig\\/endPointURL').type(
    Cypress.env('s3StorageEndPointUrl')
  );
  checkServiceFieldSectionHighlighting('endPointURL');
};

describe.skip('S3Storage Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Storage);

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput,
      serviceName,
      type: SERVICE_TYPE.Storage,
      serviceCategory: SERVICE_TYPE.Storage,
    });
  });

  it('Update container description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      tableName,
      description,
      SERVICE_TYPE.Storage,
      MYDATA_SUMMARY_OPTIONS.containers
    );
  });

  // Todo: unskip below test once issue is fixed https://github.com/open-metadata/OpenMetadata/issues/11700
  it.skip('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Storage,
      serviceName,
      API_SERVICE.storageServices
    );
  });
});
