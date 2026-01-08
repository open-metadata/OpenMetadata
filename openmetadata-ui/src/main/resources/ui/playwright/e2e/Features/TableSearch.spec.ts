/*
 *  Copyright 2025 Collate.
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
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { FileClass } from '../../support/entity/FileClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import {
  getApiContext,
  redirectToHomePage,
  testTableSearch,
} from '../../utils/common';
import { test } from '../fixtures/pages';

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.describe('Table Search', () => {
  test.describe('Services page', () => {
    test('Services page should have search functionality', async ({ page }) => {
      const service1 = EntityDataClass.databaseService.get();
      const service2 = EntityDataClass.storedProcedure1.get().service;

      await page.goto('/settings/services/databases');
      await testTableSearch(
        page,
        'database_service_search_index',
        service1.name,
        service2.name
      );
    });
  });

  test.describe('API Collection page', () => {
    test('API Collection page should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const apiEndpoint1 = EntityDataClass.apiEndpoint1.get();
      const apiEndpoint2 = new ApiEndpointClass();

      apiEndpoint2.service.name = apiEndpoint1.service.name;
      apiEndpoint2.apiCollection.name = apiEndpoint1.apiCollection.name;
      apiEndpoint2.apiCollection.service = apiEndpoint1.service.name;
      apiEndpoint2.entity.apiCollection = `${apiEndpoint1.service.name}.${apiEndpoint1.apiCollection.name}`;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.API_ENDPOINT}`,
        {
          data: apiEndpoint2.entity,
        }
      );
      apiEndpoint2.entityResponseData = await response.json();

      await page.goto(
        `/apiCollection/${apiEndpoint1.apiCollection.fullyQualifiedName}`
      );
      await testTableSearch(
        page,
        'api_endpoint_search_index',
        apiEndpoint1.entity.name,
        apiEndpoint2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Database Schema Tables tab', () => {
    test('Database Schema Tables tab should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const table1 = EntityDataClass.table1.get();
      const table2 = new TableClass();

      table2.service.name = table1.service.name;
      table2.database.name = table1.database.name;
      table2.database.service = table1.service.name;
      table2.schema.name = table1.schema.name;
      table2.schema.database = `${table1.service.name}.${table1.database.name}`;
      table2.entity.databaseSchema = table1.schema.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Table}`,
        {
          data: table2.entity,
        }
      );
      table2.entityResponseData = await response.json();

      await page.goto(`/databaseSchema/${table1.schema.fullyQualifiedName}`);
      await testTableSearch(
        page,
        'table_search_index',
        table1.entity.name,
        table2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Data Models Table', () => {
    test('Data Models Table should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const dataModel1 = EntityDataClass.dashboardDataModel1.get();
      const dataModel2 = new DashboardDataModelClass();

      dataModel2.service.name = dataModel1.service.name;
      dataModel2.entity.service = dataModel1.service.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.DataModel}`,
        {
          data: dataModel2.entity,
        }
      );
      dataModel2.entityResponseData = await response.json();

      await page.goto(
        `/service/dashboardServices/${dataModel1.service.name}/data-model`
      );
      await testTableSearch(
        page,
        'dashboard_data_model_search_index',
        dataModel1.entity.name,
        dataModel2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Stored Procedure Table', () => {
    test('Stored Procedure Table should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const storedProcedure1 = EntityDataClass.storedProcedure1.get();
      const storedProcedure2 = new StoredProcedureClass();

      storedProcedure2.service.name = storedProcedure1.service.name;
      storedProcedure2.database.name = storedProcedure1.database.name;
      storedProcedure2.database.service = storedProcedure1.service.name;
      storedProcedure2.schema.name = storedProcedure1.schema.name;
      storedProcedure2.schema.database = `${storedProcedure1.service.name}.${storedProcedure1.database.name}`;
      storedProcedure2.entity.databaseSchema =
        storedProcedure1.schema.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.StoreProcedure}`,
        {
          data: storedProcedure2.entity,
        }
      );
      storedProcedure2.entityResponseData = await response.json();

      await page.goto(
        `/databaseSchema/${storedProcedure1.schema.fullyQualifiedName}/stored_procedure`
      );
      await testTableSearch(
        page,
        'stored_procedure_search_index',
        storedProcedure1.entity.name,
        storedProcedure2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Topics Table', () => {
    test('Topics Table should have search functionality', async ({ page }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const topic1 = EntityDataClass.topic1.get();
      const topic2 = new TopicClass();

      topic2.service.name = topic1.service.name;
      topic2.entity.service = topic1.service.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Topic}`,
        {
          data: topic2.entity,
        }
      );
      topic2.entityResponseData = await response.json();

      await page.goto(
        `/service/messagingServices/${topic1.service.name}/topics`
      );
      await testTableSearch(
        page,
        'topic_search_index',
        topic1.entity.name,
        topic2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Drives Service Directories Table', () => {
    test('Drives Service Directories Table should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const directory1 = EntityDataClass.directory1.get();
      const directory2 = new DirectoryClass();

      directory2.service.name = directory1.service.name;
      directory2.entity.service = directory1.service.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Directory}`,
        {
          data: {
            name: directory2.entity.name,
            description: directory2.entity.description,
            service: directory2.entity.service,
          },
        }
      );
      directory2.entityResponseData = await response.json();

      await page.goto(
        `/service/driveServices/${directory1.service.name}/directories`
      );
      await testTableSearch(
        page,
        'directory_search_index',
        directory1.entity.name,
        directory2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Drives Service Files Table', () => {
    test('Drives Service Files Table should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const file1 = EntityDataClass.file1.get();
      const file2 = new FileClass();

      file2.service.name = file1.service.name;
      file2.entity.service = file1.service.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.File}`,
        {
          data: {
            name: file2.entity.name,
            description: file2.entity.description,
            service: file2.entity.service,
          },
        }
      );
      file2.entityResponseData = await response.json();

      await page.goto(`/service/driveServices/${file1.service.name}/files`);
      await testTableSearch(
        page,
        'file_search_index',
        file1.entity.name,
        file2.entity.name
      );

      await afterAction();
    });
  });

  test.describe('Drives Service Spreadsheets Table', () => {
    test('Drives Service Spreadsheets Table should have search functionality', async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      const spreadsheet1 = EntityDataClass.spreadsheet1.get();
      const spreadsheet2 = new SpreadsheetClass();

      spreadsheet2.service.name = spreadsheet1.service.name;
      spreadsheet2.entity.service = spreadsheet1.service.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Spreadsheet}`,
        {
          data: {
            name: spreadsheet2.entity.name,
            description: spreadsheet2.entity.description,
            service: spreadsheet2.entity.service,
          },
        }
      );
      spreadsheet2.entityResponseData = await response.json();

      await page.goto(
        `/service/driveServices/${spreadsheet1.service.name}/spreadsheets`
      );
      await testTableSearch(
        page,
        'spreadsheet_search_index',
        spreadsheet1.entity.name,
        spreadsheet2.entity.name
      );

      await afterAction();
    });
  });
});
