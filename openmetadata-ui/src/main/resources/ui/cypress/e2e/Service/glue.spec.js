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

const serviceType = 'Glue';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'cloudfront_logs2';
const description = `This is ${serviceName} description`;
const filterPattern = 'default';

// We do not have creds for glue to validate
describe.skip('Glue Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root\\/awsConfig\\/awsAccessKeyId')
        .scrollIntoView()
        .type(Cypress.env('glueAwsAccessKeyId'));
      checkServiceFieldSectionHighlighting('awsAccessKeyId');
      cy.get('#root\\/awsConfig\\/awsSecretAccessKey')
        .scrollIntoView()
        .type(Cypress.env('glueAwsSecretAccessKey'));
      checkServiceFieldSectionHighlighting('awsSecretAccessKey');
      cy.get('#root\\/awsConfig\\/awsRegion')
        .scrollIntoView()
        .type(Cypress.env('glueAwsRegion'));
      checkServiceFieldSectionHighlighting('awsRegion');
      cy.get('#root\\/awsConfig\\/endPointURL')
        .scrollIntoView()
        .type(Cypress.env('glueEndPointURL'));
      checkServiceFieldSectionHighlighting('endPointURL');
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
      testIngestionButton: false,
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
