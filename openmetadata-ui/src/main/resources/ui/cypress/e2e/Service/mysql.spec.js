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
  goToAddNewServicePage,
  mySqlConnectionInput,
  testServiceCreationAndIngestion,
  updateDescriptionForIngestedTables,
  uuid,
} from '../../common/common';
import {
  API_SERVICE,
  SERVICE_TYPE,
  TEAM_ENTITY,
} from '../../constants/constants';

const serviceType = 'Mysql';
const serviceName = `${serviceType}.ct%test-${uuid()}`;
const tableName = TEAM_ENTITY;
const description = `This is ${tableName} description`;

describe('MySQL Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.Database);

    const addIngestionInput = () => {
      cy.get('#root\\/schemaFilterPattern\\/includes')
        .scrollIntoView()
        .type(`${Cypress.env('mysqlDatabaseSchema')}{enter}`);
    };

    const viewIngestionInput = () => {
      cy.get('.ant-select-selection-item-content')
        .scrollIntoView()
        .contains(`${Cypress.env('mysqlDatabaseSchema')}`);
    };

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput: mySqlConnectionInput,
      addIngestionInput,
      serviceName,
      serviceCategory: SERVICE_TYPE.Database,
      viewIngestionInput,
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
