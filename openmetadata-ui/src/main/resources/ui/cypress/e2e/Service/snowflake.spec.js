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

const serviceType = 'Snowflake';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const tableName = 'CUSTOMER';
const schema = 'TPCH_SF1000';
const description = `This is ${serviceName} description`;
const entityFqn = `${serviceName}.${Cypress.env(
  'snowflakeDatabase'
)}.${schema}.${tableName}`;

describe('Snowflake Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', { defaultCommandTimeout: 8000 }, () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);
    const connectionInput = () => {
      cy.get('#root\\/username').type(Cypress.env('snowflakeUsername'));
      checkServiceFieldSectionHighlighting('username');
      cy.get('#root\\/password').type(Cypress.env('snowflakePassword'));
      checkServiceFieldSectionHighlighting('password');
      cy.get('#root\\/account').type(Cypress.env('snowflakeAccount'));
      checkServiceFieldSectionHighlighting('account');
      cy.get('#root\\/database').type(Cypress.env('snowflakeDatabase'));
      checkServiceFieldSectionHighlighting('database');
      cy.get('#root\\/warehouse').type(Cypress.env('snowflakeWarehouse'));
      checkServiceFieldSectionHighlighting('warehouse');
    };

    const addIngestionInput = () => {
      cy.get('#root\\/schemaFilterPattern\\/includes')
        .scrollIntoView()

        .type(`${schema}{enter}`);
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
      'tables',
      entityFqn
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
