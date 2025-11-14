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
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { FileClass } from '../../support/entity/FileClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, testTableSorting } from '../../utils/common';
import { test } from '../fixtures/pages';

let apiContext: APIRequestContext;
let afterAction: () => Promise<void>;

// Shared services for "Services page" tests
const databaseService1 = new DatabaseServiceClass();
const databaseService2 = new DatabaseServiceClass();
const pipelineService1 = new PipelineServiceClass();
const pipelineService2 = new PipelineServiceClass();

test.beforeAll(async ({ browser }) => {
  test.slow();

  const result = await performAdminLogin(browser);
  apiContext = result.apiContext;
  afterAction = result.afterAction;

  // Create only the services needed for the "Services page" tests
  await databaseService1.create(apiContext);
  await databaseService2.create(apiContext);
  await pipelineService1.create(apiContext);
  await pipelineService2.create(apiContext);
});

test.afterAll(async () => {
  test.slow();

  await databaseService1.delete(apiContext);
  await databaseService2.delete(apiContext);
  await pipelineService1.delete(apiContext);
  await pipelineService2.delete(apiContext);

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test.describe.serial('Table Sorting', () => {
  test.describe('Database Schema page', () => {
    const schema1 = new DatabaseSchemaClass();
    const schema2 = new DatabaseSchemaClass();

    test.beforeAll(async () => {
      await schema1.create(apiContext);

      schema2.service.name = schema1.service.name;
      schema2.database.name = schema1.database.name;
      schema2.database.service = schema1.service.name;
      schema2.serviceResponseData = schema1.serviceResponseData;
      schema2.databaseResponseData = schema1.databaseResponseData;

      const schema2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.DatabaseSchema}`,
        {
          data: schema2.entity,
        }
      );
      schema2.entityResponseData = await schema2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.DatabaseSchema}/name/${encodeURIComponent(
          schema2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await schema1.delete(apiContext);
    });

    test('Database Schema page should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/database/${schema1.databaseResponseData.fullyQualifiedName}`
      );
      await testTableSorting(page, 'Name');
    });
  });

  test('Services page should have sorting on name column', async ({ page }) => {
    await page.goto('/settings/services/databases');
    await testTableSorting(page, 'Name');
  });

  test.describe('API Endpoint page', () => {
    const apiEndpoint1 = new ApiEndpointClass();
    const apiEndpoint2 = new ApiEndpointClass();

    test.beforeAll(async () => {
      await apiEndpoint1.create(apiContext);

      apiEndpoint2.service.name = apiEndpoint1.service.name;
      apiEndpoint2.apiCollection.name = apiEndpoint1.apiCollection.name;
      apiEndpoint2.apiCollection.service = apiEndpoint1.service.name;
      apiEndpoint2.entity.apiCollection = `${apiEndpoint1.service.name}.${apiEndpoint1.apiCollection.name}`;
      apiEndpoint2.serviceResponseData = apiEndpoint1.serviceResponseData;
      apiEndpoint2.apiCollectionResponseData =
        apiEndpoint1.apiCollectionResponseData;

      const apiEndpoint2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.API_ENDPOINT}`,
        {
          data: apiEndpoint2.entity,
        }
      );
      apiEndpoint2.entityResponseData = await apiEndpoint2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.API_ENDPOINT}/name/${encodeURIComponent(
          apiEndpoint2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await apiEndpoint1.delete(apiContext);
    });

    test('API Endpoint page should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/apiCollection/${apiEndpoint1.apiCollectionResponseData.fullyQualifiedName}`
      );
      await testTableSorting(page, 'Name');
    });
  });

  test.describe('API Endpoint schema', () => {
    const apiEndpoint = new ApiEndpointClass();

    test.beforeAll(async () => {
      await apiEndpoint.create(apiContext);
    });

    test.afterAll(async () => {
      await apiEndpoint.delete(apiContext);
    });

    test('API Endpoint schema should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/apiEndpoint/${apiEndpoint.entityResponseData.fullyQualifiedName}`
      );
      await testTableSorting(page, 'Name');
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
      table2.serviceResponseData = table1.serviceResponseData;
      table2.databaseResponseData = table1.databaseResponseData;
      table2.schemaResponseData = table1.schemaResponseData;

      const table2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Table}`,
        {
          data: table2.entity,
        }
      );
      table2.entityResponseData = await table2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Table}/name/${encodeURIComponent(
          table2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await table1.delete(apiContext);
    });

    test('Database Schema Tables tab should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/databaseSchema/${table1.schemaResponseData.fullyQualifiedName}`
      );
      await testTableSorting(page, 'Name');
    });
  });

  test('Data Observability services page should have sorting on name column', async ({
    page,
  }) => {
    await page.goto('/settings/services/dataObservability?tab=pipelines');
    await testTableSorting(page, 'Name');
  });

  test.describe('Data Models Table', () => {
    const dataModel1 = new DashboardDataModelClass();
    const dataModel2 = new DashboardDataModelClass();

    test.beforeAll(async () => {
      await dataModel1.create(apiContext);

      dataModel2.service.name = dataModel1.service.name;
      dataModel2.entity.service =
        dataModel1.serviceResponseData.fullyQualifiedName;
      dataModel2.serviceResponseData = dataModel1.serviceResponseData;

      const dataModel2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.DataModel}`,
        {
          data: dataModel2.entity,
        }
      );
      dataModel2.entityResponseData = await dataModel2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.DataModel}/name/${encodeURIComponent(
          dataModel2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await dataModel1.delete(apiContext);
    });

    test('Data Models Table should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/service/dashboardServices/${dataModel1.serviceResponseData.name}/data-model`
      );
      await testTableSorting(page, 'Name');
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
      storedProcedure2.serviceResponseData =
        storedProcedure1.serviceResponseData;
      storedProcedure2.databaseResponseData =
        storedProcedure1.databaseResponseData;
      storedProcedure2.schemaResponseData = storedProcedure1.schemaResponseData;

      const storedProcedure2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.StoreProcedure}`,
        {
          data: storedProcedure2.entity,
        }
      );
      storedProcedure2.entityResponseData =
        await storedProcedure2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.StoreProcedure}/name/${encodeURIComponent(
          storedProcedure2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await storedProcedure1.delete(apiContext);
    });

    test('Stored Procedure Table should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/databaseSchema/${storedProcedure1.schemaResponseData.fullyQualifiedName}/stored_procedure`
      );
      await testTableSorting(page, 'Name');
    });
  });

  test.describe('Topics Table', () => {
    const topic1 = new TopicClass();
    const topic2 = new TopicClass();

    test.beforeAll(async () => {
      await topic1.create(apiContext);

      topic2.service.name = topic1.service.name;
      topic2.entity.service = topic1.serviceResponseData.fullyQualifiedName;
      topic2.serviceResponseData = topic1.serviceResponseData;

      const topic2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Topic}`,
        {
          data: topic2.entity,
        }
      );
      topic2.entityResponseData = await topic2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Topic}/name/${encodeURIComponent(
          topic2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await topic1.delete(apiContext);
    });

    test('Topics Table should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/service/messagingServices/${topic1.serviceResponseData.name}/topics`
      );
      await testTableSorting(page, 'Name');
    });
  });

  test.describe('Drives Service Files Table', () => {
    const file1 = new FileClass();
    const file2 = new FileClass();

    test.beforeAll(async () => {
      await file1.create(apiContext);

      file2.service.name = file1.service.name;
      file2.entity.service = file1.serviceResponseData.fullyQualifiedName;
      file2.serviceResponseData = file1.serviceResponseData;

      const file2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.File}`,
        {
          data: {
            name: file2.entity.name,
            description: file2.entity.description,
            service: file2.entity.service,
          },
        }
      );
      file2.entityResponseData = await file2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.File}/name/${encodeURIComponent(
          file2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await file1.delete(apiContext);
    });

    test('Drives Service Files Table should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/service/driveServices/${file1.serviceResponseData.name}/files`
      );
      await testTableSorting(page, 'Name');
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
      spreadsheet2.serviceResponseData = spreadsheet1.serviceResponseData;

      const spreadsheet2Response = await apiContext.post(
        `/api/v1/${EntityTypeEndpoint.Spreadsheet}`,
        {
          data: {
            name: spreadsheet2.entity.name,
            description: spreadsheet2.entity.description,
            service: spreadsheet2.entity.service,
          },
        }
      );
      spreadsheet2.entityResponseData = await spreadsheet2Response.json();
    });

    test.afterAll(async () => {
      await apiContext.delete(
        `/api/v1/${EntityTypeEndpoint.Spreadsheet}/name/${encodeURIComponent(
          spreadsheet2.entityResponseData?.['fullyQualifiedName']
        )}?recursive=true&hardDelete=true`
      );
      await spreadsheet1.delete(apiContext);
    });

    test('Drives Service Spreadsheets Table should have sorting on name column', async ({
      page,
    }) => {
      await page.goto(
        `/service/driveServices/${spreadsheet1.serviceResponseData.name}/spreadsheets`
      );
      await testTableSorting(page, 'Name');
    });
  });
});
