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
import { APIRequestContext } from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { FileClass } from '../../support/entity/FileClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, testTableSearch } from '../../utils/common';
import { test } from '../fixtures/pages';

let apiContext: APIRequestContext;
let afterAction: () => Promise<void>;

test.beforeAll(async ({ browser }) => {
  const result = await performAdminLogin(browser);
  apiContext = result.apiContext;
  afterAction = result.afterAction;
});

test.afterAll(async () => {
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.describe.serial('Table Search', () => {
  test.describe('Services page', () => {
    const service1 = new DatabaseServiceClass();
    const service2 = new DatabaseServiceClass();

    test.beforeAll(async () => {
      await service1.create(apiContext);
      await service2.create(apiContext);
    });

    test.afterAll(async () => {
      await service1.delete(apiContext);
      await service2.delete(apiContext);
    });

    test('Services page should have search functionality', async ({ page }) => {
      await page.goto('/settings/services/databases');
      await testTableSearch(
        page,
        'database_service_search_index',
        service1.entity.name,
        service2.entity.name
      );
    });
  });

  test.describe('API Collection page', () => {
    const apiEndpoint1 = new ApiEndpointClass();
    const apiEndpoint2 = new ApiEndpointClass();

    test.beforeAll(async () => {
      await apiEndpoint1.create(apiContext);

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
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.API_ENDPOINT}/name/${encodeURIComponent(
          apiEndpoint2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await apiEndpoint1.delete(apiContext);
    });

    test('API Collection page should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/apiCollection/${apiEndpoint1.apiCollectionResponseData.fullyQualifiedName}`
      );
      await testTableSearch(
        page,
        'api_endpoint_search_index',
        apiEndpoint1.entity.name,
        apiEndpoint2.entity.name
      );
    });
  });

  test.describe('Database Schema Tables tab', () => {
    const table1 = new TableClass();
    const table2 = new TableClass();

    test.beforeAll(async () => {
      await table1.create(apiContext);

      table2.service.name = table1.service.name;
      table2.database.name = table1.database.name;
      table2.database.service = table1.service.name;
      table2.schema.name = table1.schema.name;
      table2.schema.database = `${table1.service.name}.${table1.database.name}`;
      table2.entity.databaseSchema = table1.entity.databaseSchema;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Table}`,
        {
          data: table2.entity,
        }
      );
      table2.entityResponseData = await response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Table}/name/${encodeURIComponent(
          table2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await table1.delete(apiContext);
    });

    test('Database Schema Tables tab should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/databaseSchema/${table1.schemaResponseData.fullyQualifiedName}`
      );
      await testTableSearch(
        page,
        'table_search_index',
        table1.entity.name,
        table2.entity.name
      );
    });
  });

  test.describe('Data Models Table', () => {
    const dataModel1 = new DashboardDataModelClass();
    const dataModel2 = new DashboardDataModelClass();

    test.beforeAll(async () => {
      await dataModel1.create(apiContext);

      dataModel2.service.name = dataModel1.service.name;
      dataModel2.entity.service =
        dataModel1.serviceResponseData.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.DataModel}`,
        {
          data: dataModel2.entity,
        }
      );
      dataModel2.entityResponseData = await response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.DataModel}/name/${encodeURIComponent(
          dataModel2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await dataModel1.delete(apiContext);
    });

    test('Data Models Table should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/service/dashboardServices/${dataModel1.serviceResponseData.name}/data-model`
      );
      await testTableSearch(
        page,
        'dashboard_data_model_search_index',
        dataModel1.entity.name,
        dataModel2.entity.name
      );
    });
  });

  test.describe('Stored Procedure Table', () => {
    const storedProcedure1 = new StoredProcedureClass();
    const storedProcedure2 = new StoredProcedureClass();

    test.beforeAll(async () => {
      await storedProcedure1.create(apiContext);

      storedProcedure2.service.name = storedProcedure1.service.name;
      storedProcedure2.database.name = storedProcedure1.database.name;
      storedProcedure2.database.service = storedProcedure1.service.name;
      storedProcedure2.schema.name = storedProcedure1.schema.name;
      storedProcedure2.schema.database = `${storedProcedure1.service.name}.${storedProcedure1.database.name}`;
      storedProcedure2.entity.databaseSchema =
        storedProcedure1.entity.databaseSchema;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.StoreProcedure}`,
        {
          data: storedProcedure2.entity,
        }
      );
      storedProcedure2.entityResponseData = await response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.StoreProcedure}/name/${encodeURIComponent(
          storedProcedure2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await storedProcedure1.delete(apiContext);
    });

    test('Stored Procedure Table should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/databaseSchema/${storedProcedure1.schemaResponseData.fullyQualifiedName}/stored_procedure`
      );
      await testTableSearch(
        page,
        'stored_procedure_search_index',
        storedProcedure1.entity.name,
        storedProcedure2.entity.name
      );
    });
  });

  test.describe('Topics Table', () => {
    const topic1 = new TopicClass();
    const topic2 = new TopicClass();

    test.beforeAll(async () => {
      await topic1.create(apiContext);

      topic2.service.name = topic1.service.name;
      topic2.entity.service = topic1.serviceResponseData.fullyQualifiedName;

      const response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Topic}`,
        {
          data: topic2.entity,
        }
      );
      topic2.entityResponseData = await response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Topic}/name/${encodeURIComponent(
          topic2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await topic1.delete(apiContext);
    });

    test('Topics Table should have search functionality', async ({ page }) => {
      await page.goto(
        `/service/messagingServices/${topic1.serviceResponseData.name}/topics`
      );
      await testTableSearch(
        page,
        'topic_search_index',
        topic1.entity.name,
        topic2.entity.name
      );
    });
  });

  test.describe('Drives Service Directories Table', () => {
    const directory1 = new DirectoryClass();
    const directory2 = new DirectoryClass();

    test.beforeAll(async () => {
      await directory1.create(apiContext);

      directory2.service.name = directory1.service.name;
      directory2.entity.service =
        directory1.serviceResponseData.fullyQualifiedName;

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
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Directory}/name/${encodeURIComponent(
          directory2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await directory1.delete(apiContext);
    });

    test('Drives Service Directories Table should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/service/driveServices/${directory1.serviceResponseData.name}/directories`
      );
      await testTableSearch(
        page,
        'directory_search_index',
        directory1.entity.name,
        directory2.entity.name
      );
    });
  });

  test.describe('Drives Service Files Table', () => {
    const file1 = new FileClass();
    const file2 = new FileClass();

    test.beforeAll(async () => {
      await file1.create(apiContext);

      file2.service.name = file1.service.name;
      file2.entity.service = file1.serviceResponseData.fullyQualifiedName;

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
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.File}/name/${encodeURIComponent(
          file2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await file1.delete(apiContext);
    });

    test('Drives Service Files Table should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/service/driveServices/${file1.serviceResponseData.name}/files`
      );
      await testTableSearch(
        page,
        'file_search_index',
        file1.entity.name,
        file2.entity.name
      );
    });
  });

  test.describe('Drives Service Spreadsheets Table', () => {
    const spreadsheet1 = new SpreadsheetClass();
    const spreadsheet2 = new SpreadsheetClass();

    test.beforeAll(async () => {
      await spreadsheet1.create(apiContext);

      spreadsheet2.service.name = spreadsheet1.service.name;
      spreadsheet2.entity.service =
        spreadsheet1.serviceResponseData.fullyQualifiedName;

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
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Spreadsheet}/name/${encodeURIComponent(
          spreadsheet2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await spreadsheet1.delete(apiContext);
    });

    test('Drives Service Spreadsheets Table should have search functionality', async ({
      page,
    }) => {
      await page.goto(
        `/service/driveServices/${spreadsheet1.serviceResponseData.name}/spreadsheets`
      );
      await testTableSearch(
        page,
        'spreadsheet_search_index',
        spreadsheet1.entity.name,
        spreadsheet2.entity.name
      );
    });
  });
});
