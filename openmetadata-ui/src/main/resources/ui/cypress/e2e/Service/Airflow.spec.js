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
// / <reference types="Cypress" />

import {
  deleteCreatedService,
  goToAddNewServicePage,
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
} from '../../common/common';
import {
  API_SERVICE,
  DATA_ASSETS,
  SERVICE_TYPE,
} from '../../constants/constants';

const serviceType = 'Airflow';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'index_metadata';
const description = `This is ${tableName} description`;

const connectionInput = () => {
  cy.get('#root\\/hostPort').type(Cypress.env('airflowHostPort'));
  cy.get('#root\\/connection__oneof_select')
    .scrollIntoView()
    .select('BackendConnection');
};

describe('Airflow Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Pipeline);

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput,
      serviceName,
      type: SERVICE_TYPE.Pipeline,
      serviceCategory: SERVICE_TYPE.Pipeline,
    });
  });

  it('Update pipeline description and verify description after re-run', () => {
    updateDescriptionForIngestedTables(
      serviceName,
      tableName,
      description,
      SERVICE_TYPE.Pipeline,
      DATA_ASSETS.pipelines
    );
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.Pipeline,
      serviceName,
      API_SERVICE.pipelineServices
    );
  });
});
