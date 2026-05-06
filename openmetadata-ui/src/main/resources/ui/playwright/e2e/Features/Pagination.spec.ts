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
import test, { expect } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { BotClass } from '../../support/bot/BotClass';
import { AlertClass } from '../../support/entity/AlertClass';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  testClientSidePaginationNavigation,
  testCompletePaginationWithSearch,
  testPaginationNavigation,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Pagination Tests', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.describe('Pagination tests for Users page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (let i = 1; i <= 20; i++) {
        const uniqueId = uuid();
        const user = new UserClass({
          firstName: `pw_pagination_User${uniqueId}`,
          lastName: `LastName${uniqueId}`,
          email: `pw_pagination_user${uniqueId}@example.com`,
          password: 'User@OMD123',
        });

        await user.create(apiContext);
      }

      await afterAction();
    });

    test('should test pagination on Users page', async ({ page }) => {
      await page.goto('/settings/members/users');
      await testPaginationNavigation(page, '/api/v1/users', 'table');
    });

    test('should test Users complete flow with search', async ({ page }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: '/settings/members/users',
        normalApiPattern: '/api/v1/users',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'user',
        waitForLoadSelector: 'table',
      });
    });
  });

  test.describe('Database Schema Tables page pagination', () => {
    let database: DatabaseClass;
    let schemaFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      database = new DatabaseClass();
      await database.create(apiContext);
      schemaFqn = database.schemaResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/tables', {
          data: {
            name: `pw_table_${uuid()}_${i}`,
            databaseSchema: schemaFqn,
            description: `Test table ${i} for pagination testing`,
            columns: [
              {
                name: 'id',
                dataType: 'BIGINT',
                dataTypeDisplay: 'bigint',
                description: 'ID column',
              },
            ],
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test Database Schema Tables normal pagination', async ({
      page,
    }) => {
      await page.goto(`/databaseSchema/${schemaFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/api/v1/tables',
        '[data-testid="databaseSchema-tables"]'
      );
    });

    test('should test Database Schema Tables complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/databaseSchema/${schemaFqn}?showDeletedTables=false`,
        normalApiPattern: '/api/v1/tables',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'schema',
        waitForLoadSelector: '[data-testid="databaseSchema-tables"]',
      });
    });
  });

  test.describe('Table columns page pagination', () => {
    let database: DatabaseClass;
    let tableFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      database = new DatabaseClass();

      const columns = [];
      for (let i = 1; i <= 60; i++) {
        columns.push({
          name: `pw_test_column_${i}`,
          dataType: 'VARCHAR',
          dataLength: 255,
          dataTypeDisplay: 'varchar',
          description: `Test column ${i} for pagination testing`,
        });
      }

      database.table.columns = columns;

      await database.create(apiContext);
      tableFqn = database.tableResponseData.fullyQualifiedName;

      if (!tableFqn) {
        throw new Error('Failed to create table: tableFqn is undefined');
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Table columns', async ({ page }) => {
      await page.goto(`/table/${tableFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/columns',
        '[data-testid="entity-table"]',
        false
      );
    });
    test('should test Table columns complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/table/${tableFqn}?pageSize=15`,
        normalApiPattern: '/columns',
        searchApiPattern: '/columns/search',
        searchTestTerm: 'pw',
        searchParamName: 'columnSearch',
        waitForLoadSelector: '[data-testid="entity-table"]',
      });
    });
  });

  test.describe('Service Databases page pagination', () => {
    let database: DatabaseClass;
    let databaseFqn: string;
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      database = new DatabaseClass();
      await database.create(apiContext);
      databaseFqn = database.serviceResponseData.fullyQualifiedName;
      for (let i = 1; i <= 20; i++) {
        const databaseName = `pw-test-db-${uuid()}-${i}`;
        await apiContext.put('/api/v1/databases', {
          data: {
            name: databaseName,
            displayName: `PW Test Database ${i}`,
            description: `Test database ${i} for pagination testing`,
            service: databaseFqn,
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Service Databases page', async ({
      page,
    }) => {
      await page.goto(`/service/databaseServices/${databaseFqn}/databases`);
      await testPaginationNavigation(
        page,
        '/api/v1/databases',
        '[data-testid="service-children-table"]'
      );

      const responsePromise = page.waitForResponse((response) =>
        response
          .url()
          .includes(
            '/api/v1/analytics/dataInsights/system/charts/listChartData'
          )
      );
      await page.getByTestId('insights').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await page.locator('.ant-skeleton-active').first().waitFor({
        state: 'detached',
      });

      const databaseResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/databases')
      );
      await page.getByTestId('databases').click();
      const response2 = await databaseResponsePromise;
      expect(response2.status()).toBe(200);
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('table-container').waitFor({
        state: 'visible',
      });

      const paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      const paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/1\s*of\s*\d+/);
    });
    test('should test Service Database Tables complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/service/databaseServices/${databaseFqn}/databases`,
        normalApiPattern: '/api/v1/databases',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'schema',
        waitForLoadSelector: '[data-testid="service-children-table"]',
      });
    });
  });

  test.describe('Pagination tests for Classification Tags page', () => {
    let classification: ClassificationClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      classification = new ClassificationClass();
      await classification.create(apiContext);

      for (let i = 1; i <= 20; i++) {
        const tag = new TagClass({
          classification: classification.responseData.name,
          name: `pw-tag-pagination-${uuid()}-${i}`,
          displayName: `PW Tag Pagination ${i}`,
          description: `Tag ${i} for pagination testing`,
        });
        await tag.create(apiContext);
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await classification.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Classification Tags page', async ({
      page,
    }) => {
      await page.goto(`/tags/${classification.responseData.name}`);
      await testPaginationNavigation(page, '/api/v1/tags', 'table');
    });
  });

  test.describe('Pagination tests for Metrics page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (let i = 1; i <= 20; i++) {
        const metric = new MetricClass();
        await metric.create(apiContext);
      }

      await afterAction();
    });

    test('should test pagination on Metrics page', async ({ page }) => {
      await page.goto('/metrics');
      await testPaginationNavigation(page, '/api/v1/metrics', 'table');
    });
  });

  test.describe('Pagination tests for Notification Alerts page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (let i = 1; i <= 20; i++) {
        const alert = new AlertClass({
          name: `pw-notification-alert-${uuid()}-${i}`,
          displayName: `PW Notification Alert ${i}`,
          description: `Notification alert ${i} for pagination testing`,
          alertType: 'Notification',
          resources: ['all'],
          destinations: [
            {
              type: 'Email',
              config: {
                sendToAdmins: true,
              },
              category: 'Admins',
            },
          ],
        });

        await alert.create(apiContext);
      }

      await afterAction();
    });

    test('should test pagination on Notification Alerts page', async ({
      page,
    }) => {
      await page.goto('/settings/notifications/alerts');
      // Skip row count validation because ActivityFeedAlert system alert is added on page 1
      await testPaginationNavigation(
        page,
        '/api/v1/events/subscriptions',
        'table',
        true,
        false
      );
    });
  });

  test.describe('Pagination tests for Observability Alerts page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      for (let i = 1; i <= 20; i++) {
        const alert = new AlertClass({
          name: `pw-observability-alert-${uuid()}-${i}`,
          displayName: `PW Observability Alert ${i}`,
          description: `Observability alert ${i} for pagination testing`,
          alertType: 'Observability',
          resources: ['table'],
          destinations: [
            {
              type: 'Email',
              config: {
                sendToAdmins: true,
              },
              category: 'Admins',
            },
          ],
        });

        await alert.create(apiContext);
      }

      await afterAction();
    });

    test('should test pagination on Observability Alerts page', async ({
      page,
    }) => {
      await page.goto('/observability/alerts?pageSize=15');
      await testPaginationNavigation(
        page,
        '/api/v1/events/subscriptions',
        'table'
      );
    });
  });

  test.describe('Pagination tests for API Collection Endpoints page', () => {
    let apiCollection: ApiCollectionClass;
    let apiCollectionFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      apiCollection = new ApiCollectionClass();
      const result = await apiCollection.create(apiContext);
      apiCollectionFqn = result.entity.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        const endpointName = `pw-api-endpoint-${uuid()}-${i}`;
        await apiContext.post('/api/v1/apiEndpoints', {
          data: {
            name: endpointName,
            apiCollection: apiCollectionFqn,
            endpointURL: `https://example.com/api/endpoint-${i}`,
            requestMethod: 'GET',
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await apiCollection.delete(apiContext);
      await afterAction();
    });

    test('should test API Collection normal pagination', async ({ page }) => {
      await page.goto(`/apiCollection/${apiCollectionFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/api/v1/apiEndpoints',
        '[data-testid="databaseSchema-tables"]'
      );
    });

    test('should test API Collection complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/apiCollection/${apiCollectionFqn}?showDeletedEndpoints=false`,
        normalApiPattern: '/api/v1/apiEndpoints',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        waitForLoadSelector: '[data-testid="databaseSchema-tables"]',
      });
    });
  });

  test.describe('Pagination tests for Stored Procedures page', () => {
    let database: DatabaseClass;
    let schemaFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      database = new DatabaseClass();
      await database.create(apiContext);
      schemaFqn = database.schemaResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/storedProcedures', {
          data: {
            name: `pw_stored_procedure_${uuid()}_${i}`,
            databaseSchema: schemaFqn,
            description: `Test stored procedure ${i} for pagination testing`,
            storedProcedureCode: {
              code: 'CREATE OR REPLACE PROCEDURE test_proc() BEGIN SELECT 1; END;',
            },
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test Stored Procedures normal pagination', async ({
      page,
    }) => {
      await page.goto(
        `/databaseSchema/${schemaFqn}/stored_procedure?pageSize=15`
      );
      await testPaginationNavigation(
        page,
        '/api/v1/storedProcedures',
        '[data-testid="stored-procedure-table"]'
      );
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/tables')
      );
      await page.getByTestId('table').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('stored_procedure').click();
      await page.waitForLoadState('domcontentloaded');
      const paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      const paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/1\s*of\s*\d+/);
    });

    test('should test Stored Procedures complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/databaseSchema/${schemaFqn}/stored_procedure?pageSize=15`,
        normalApiPattern: '/api/v1/storedProcedures',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'schema',
        waitForLoadSelector: '[data-testid="stored-procedure-table"]',
        deleteBtnTestId: 'show-deleted-stored-procedure',
      });
    });
  });

  test.describe('Pagination tests for Database Schemas page', () => {
    let database: DatabaseClass;
    let databaseFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      database = new DatabaseClass();
      await database.create(apiContext);
      databaseFqn = database.entityResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/databaseSchemas', {
          data: {
            name: `pw_database_schema_${uuid()}_${i}`,
            database: databaseFqn,
            description: `Test database schema ${i} for pagination testing`,
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await database.delete(apiContext);
      await afterAction();
    });

    test('should test Database Schemas normal pagination', async ({ page }) => {
      await page.goto(`/database/${databaseFqn}?pageSize=15`);
      await testPaginationNavigation(
        page,
        '/api/v1/databaseSchemas',
        '[data-testid="database-databaseSchemas"]'
      );
    });

    test('should test Database Schemas complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/database/${databaseFqn}?showDeletedTables=false`,
        normalApiPattern: '/api/v1/databaseSchemas',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'schema',
        waitForLoadSelector: '[data-testid="database-databaseSchemas"]',
      });
    });
  });

  test.describe('Pagination tests for Dashboard Data Models page', () => {
    let dashboardService: DashboardDataModelClass;
    let serviceFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      dashboardService = new DashboardDataModelClass();
      await dashboardService.create(apiContext);
      serviceFqn = dashboardService.serviceResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/dashboard/datamodels', {
          data: {
            name: `pw_data_model_${uuid()}_${i}`,
            service: serviceFqn,
            description: `Test data model ${i} for pagination testing`,
            columns: [
              {
                name: 'test_column',
                dataType: 'VARCHAR',
                dataLength: 256,
                dataTypeDisplay: 'varchar',
                description: 'Test column',
              },
            ],
            dataModelType: 'SupersetDataModel',
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await dashboardService.delete(apiContext);
      await afterAction();
    });

    test('should test Data Models normal pagination', async ({ page }) => {
      await page.goto(
        `/service/dashboardServices/${serviceFqn}/data-model?pageSize=15`
      );
      await testPaginationNavigation(
        page,
        '/api/v1/dashboard/datamodels',
        '[data-testid="data-models-table"]'
      );
      const responsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/dashboard/datamodels')
      );
      await page.getByTestId('dashboards').click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      await waitForAllLoadersToDisappear(page);
      await page.getByTestId('data-model').click();
      await page.waitForLoadState('domcontentloaded');
      const paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      const paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/1\s*of\s*\d+/);
    });

    test('should test Data Models complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/service/dashboardServices/${serviceFqn}/data-model?pageSize=15`,
        normalApiPattern: '/api/v1/dashboard/datamodels',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'dataModel',
        waitForLoadSelector: '[data-testid="data-models-table"]',
      });
    });
  });

  test.describe('Pagination tests for Drive Service Directories page', () => {
    let driveService: DriveServiceClass;
    let serviceFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      driveService = new DriveServiceClass();
      await driveService.create(apiContext);
      serviceFqn = driveService.entityResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/drives/directories', {
          data: {
            name: `pw_directory_${uuid()}_${i}`,
            service: serviceFqn,
            description: `Test directory ${i} for pagination testing`,
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await driveService.delete(apiContext);
      await afterAction();
    });

    test('should test Directories normal pagination', async ({ page }) => {
      await page.goto(
        `/service/driveServices/${serviceFqn}/directories?pageSize=15`
      );
      await testPaginationNavigation(
        page,
        '/api/v1/drives/directories',
        '[data-testid="service-children-table"]'
      );
    });

    test('should test Directories complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/service/driveServices/${serviceFqn}/directories?showDeletedTables=false`,
        normalApiPattern: '/api/v1/drives/directories',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'schema',
        waitForLoadSelector: '[data-testid="service-children-table"]',
      });
    });
  });

  test.describe('Pagination tests for Drive Service Files page', () => {
    let driveService: DriveServiceClass;
    let serviceFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      driveService = new DriveServiceClass();
      await driveService.create(apiContext);
      serviceFqn = driveService.entityResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/drives/files', {
          data: {
            name: `pw_file_${uuid()}_${i}`,
            service: serviceFqn,
            description: `Test file ${i} for pagination testing`,
          },
        });
      }

      await apiContext.post('/api/v1/drives/spreadsheets', {
        data: {
          name: `pw_spreadsheet_${uuid()}_1`,
          service: serviceFqn,
          description: 'Test spreadsheet for tab switching',
        },
      });

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await driveService.delete(apiContext);
      await afterAction();
    });

    test('should test Files normal pagination', async ({ page }) => {
      await page.goto(`/service/driveServices/${serviceFqn}/files?pageSize=15`);
      await testPaginationNavigation(page, '/api/v1/drives/files', 'table');
    });

    test('should test Files complete flow with search', async ({ page }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/service/driveServices/${serviceFqn}/files?showDeletedTables=false`,
        normalApiPattern: '/api/v1/drives/files',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'file',
        waitForLoadSelector: 'table',
      });
    });

    test('should reset pagination when switching between Files and Spreadsheets tabs and also verify the api is called with correct payload', async ({
      page,
    }) => {
      test.slow(true);

      await page.goto(`/service/driveServices/${serviceFqn}/files?pageSize=15`);
      await page.locator('table').first().waitFor({ state: 'visible' });

      let paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      let paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/1\s*of\s*\d+/);

      const nextButton = page.locator('[data-testid="next"]');
      await expect(nextButton).toBeEnabled();

      const filesResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/drives/files')
      );
      await nextButton.click();
      await filesResponsePromise;
      await page.locator('table').first().waitFor({ state: 'visible' });

      paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/2\s*of\s*\d+/);

      const spreadsheetsResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/drives/spreadsheets')
      );
      await page.getByTestId('spreadsheets').click();
      const spreadsheetsResponse = await spreadsheetsResponsePromise;

      expect(spreadsheetsResponse.status()).toBe(200);
      const spreadsheetsUrl = spreadsheetsResponse.url();
      expect(spreadsheetsUrl).not.toContain('before=');
      expect(spreadsheetsUrl).not.toContain('after=');

      await waitForAllLoadersToDisappear(page);

      const filesTabResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/drives/files')
      );
      await page.getByTestId('files').click();
      const filesTabResponse = await filesTabResponsePromise;
      expect(filesTabResponse.status()).toBe(200);
      await page.locator('table').first().waitFor({ state: 'visible' });

      paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/1\s*of\s*\d+/);

      const filesPage2Promise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/drives/files')
      );
      await nextButton.click();
      const filesPage2Response = await filesPage2Promise;
      expect(filesPage2Response.status()).toBe(200);
      await page.locator('table').first().waitFor({ state: 'visible' });

      paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/2\s*of\s*\d+/);

      const directoriesResponsePromise = page.waitForResponse((response) =>
        response.url().includes('/api/v1/drives/directories')
      );
      const reloadSpreadsheetsResponsePromise = page.waitForResponse(
        (response) => response.url().includes('/api/v1/drives/spreadsheets')
      );

      await page.reload();

      const directoriesResponse = await directoriesResponsePromise;
      const reloadSpreadsheetsResponse =
        await reloadSpreadsheetsResponsePromise;

      expect(directoriesResponse.status()).toBe(200);
      const directoriesUrl = directoriesResponse.url();
      expect(directoriesUrl).not.toContain('before=');
      expect(directoriesUrl).not.toContain('after=');

      expect(reloadSpreadsheetsResponse.status()).toBe(200);
      const reloadSpreadsheetsUrl = reloadSpreadsheetsResponse.url();
      expect(reloadSpreadsheetsUrl).not.toContain('before=');
      expect(reloadSpreadsheetsUrl).not.toContain('after=');

      await page.locator('table').first().waitFor({ state: 'visible' });

      paginationText = page.locator('[data-testid="page-indicator"]');
      await expect(paginationText).toBeVisible();

      paginationTextContent = await paginationText.textContent();
      expect(paginationTextContent).toMatch(/2\s*of\s*\d+/);
    });
  });

  test.describe('Pagination tests for Drive Service Spreadsheets page', () => {
    let driveService: DriveServiceClass;
    let serviceFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      driveService = new DriveServiceClass();
      await driveService.create(apiContext);
      serviceFqn = driveService.entityResponseData.fullyQualifiedName;

      for (let i = 1; i <= 25; i++) {
        await apiContext.post('/api/v1/drives/spreadsheets', {
          data: {
            name: `pw_spreadsheet_${uuid()}_${i}`,
            service: serviceFqn,
            description: `Test spreadsheet ${i} for pagination testing`,
          },
        });
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await driveService.delete(apiContext);
      await afterAction();
    });

    test('should test Spreadsheets normal pagination', async ({ page }) => {
      await page.goto(
        `/service/driveServices/${serviceFqn}/spreadsheets?pageSize=15`
      );
      await testPaginationNavigation(
        page,
        '/api/v1/drives/spreadsheets',
        'table'
      );
    });

    test('should test Spreadsheets complete flow with search', async ({
      page,
    }) => {
      test.slow(true);

      await testCompletePaginationWithSearch({
        page,
        baseUrl: `/service/driveServices/${serviceFqn}/spreadsheets?showDeletedTables=false`,
        normalApiPattern: '/api/v1/drives/spreadsheets',
        searchApiPattern: '/api/v1/search/query',
        searchTestTerm: 'pw',
        searchParamName: 'spreadsheet',
        waitForLoadSelector: 'table',
      });
    });
  });

  test.describe('Pagination tests for Roles page', () => {
    let policy: PolicyClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      policy = new PolicyClass();
      // Create Policy
      await policy.create(apiContext, [
        {
          name: 'pw-policy-rule',
          resources: ['all'],
          operations: ['all'],
          effect: 'allow',
        },
      ]);

      // Create Roles
      for (let i = 1; i <= 20; i++) {
        const role = new RolesClass();
        await role.create(apiContext, [policy.responseData.id!]);
      }

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await policy.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Roles page', async ({ page }) => {
      await page.goto('/settings/access/roles?pageSize=15');
      await testPaginationNavigation(page, '/api/v1/roles', 'table');
    });
  });

  test.describe('Pagination tests for Policies page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // Create Policies
      for (let i = 1; i <= 20; i++) {
        const p = new PolicyClass();
        await p.create(apiContext, [
          {
            name: `pw-policy-rule-${i}`,
            resources: ['all'],
            operations: ['all'],
            effect: 'allow',
          },
        ]);
      }

      await afterAction();
    });

    test('should test pagination on Policies page', async ({ page }) => {
      await page.goto('/settings/access/policies?pageSize=15');
      await testPaginationNavigation(page, '/api/v1/policies', 'table');
    });
  });

  test.describe('Pagination tests for Bots page', () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      // Create Bots
      for (let i = 1; i <= 20; i++) {
        const bot = new BotClass();
        await bot.create(apiContext);
      }

      await afterAction();
    });

    test('should test pagination on Bots page', async ({ page }) => {
      await page.goto('/settings/bots?pageSize=15');
      await testPaginationNavigation(page, '/api/v1/bots', 'table');
    });
  });

  test.describe('Pipeline Tasks page pagination', () => {
    let pipeline: PipelineClass;
    let pipelineFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      pipeline = new PipelineClass();

      const tasks = [];
      for (let i = 1; i <= 20; i++) {
        tasks.push({
          name: `pw_task_${uuid()}_${i}`,
          displayName: `PW Task ${i}`,
        });
      }

      pipeline.entity.tasks = tasks;
      await pipeline.create(apiContext);
      pipelineFqn = pipeline.entityResponseData.fullyQualifiedName;

      await afterAction();
    });

    test('should test Pipeline Tasks normal pagination', async ({ page }) => {
      await page.goto(`/pipeline/${pipelineFqn}?pageSize=15`);
      await testClientSidePaginationNavigation(
        page,
        '[data-testid="task-table"]'
      );
    });

    test('should display at most pageSize rows on each page and total matches task count', async ({
      page,
    }) => {
      await page.goto(`/pipeline/${pipelineFqn}?pageSize=15`);
      await page.locator('[data-testid="task-table"]').waitFor({
        state: 'visible',
      });
      await waitForAllLoadersToDisappear(page);

      const page1RowCount = await page
        .locator('tbody > tr[data-row-key]:visible')
        .count();
      expect(page1RowCount).toBeLessThanOrEqual(15);

      await page.getByTestId('next').click();
      await waitForAllLoadersToDisappear(page);

      const page2RowCount = await page
        .locator('tbody > tr[data-row-key]:visible')
        .count();
      expect(page2RowCount).toBeLessThanOrEqual(15);
      expect(page1RowCount + page2RowCount).toBe(20);
    });
  });

  test.describe('Table version page column pagination', () => {
    const PERFORMANCE_TABLE_FQN =
      'sample_data.ecommerce_db.shopify.performance_test_table';

    const getTableVersion = async (
      page: Parameters<typeof testPaginationNavigation>[0]
    ) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const tableResponse = await apiContext.get(
        `/api/v1/tables/name/${encodeURIComponent(
          PERFORMANCE_TABLE_FQN
        )}?fields=version`
      );
      const tableData = await tableResponse.json();
      await afterAction();

      return Number.parseFloat(String(tableData.version)).toFixed(1);
    };

    test('should test pagination on Table version page columns', async ({
      page,
    }) => {
      const version = await getTableVersion(page);
      await page.goto(
        `/table/${PERFORMANCE_TABLE_FQN}/versions/${version}?pageSize=15`
      );
      await testPaginationNavigation(
        page,
        '/columns',
        '[data-testid="entity-table"]',
        false
      );
    });

    test('should test search on Table version page columns', async ({
      page,
    }) => {
      const version = await getTableVersion(page);
      await page.goto(
        `/table/${PERFORMANCE_TABLE_FQN}/versions/${version}?pageSize=15`
      );
      await page.locator('[data-testid="entity-table"]').waitFor({
        state: 'visible',
      });
      await waitForAllLoadersToDisappear(page);

      const searchResponse = page.waitForResponse((response) =>
        response.url().includes('/columns/search')
      );
      await page.getByTestId('searchbar').fill('test_col_0001');
      await searchResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('entity-table').getByRole('row')
      ).toHaveCount(2);
      await expect(
        page.getByTestId('entity-table').getByText('test_col_0001')
      ).toBeVisible();
    });
  });

  test.describe('Pagination tests for Service version page', () => {
    let dashboardService: DashboardServiceClass;
    let serviceFqn: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      dashboardService = new DashboardServiceClass();
      // Create Dashboard Service and Dashboards
      const customChildDashboards = [];
      for (let i = 1; i <= 20; i++) {
        customChildDashboards.push({
          name: `pw-dashboard-${uuid()}-${i}`,
          displayName: `PW Dashboard ${i}`,
        });
      }

      await dashboardService.create(apiContext, customChildDashboards);
      serviceFqn = dashboardService.entityResponseData.fullyQualifiedName!;

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await dashboardService.delete(apiContext);
      await afterAction();
    });

    test('should test pagination on Service version page', async ({ page }) => {
      // Go to version 0.1 of the dashboard service
      await page.goto(
        `/service/dashboardServices/${serviceFqn}/versions/0.1?pageSize=15`
      );
      await testPaginationNavigation(page, '/api/v1/dashboards', 'table');
    });
  });
});
