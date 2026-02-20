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
import { APIRequestContext, expect, test } from '@playwright/test';

import { SERVICE_TYPE } from '../../constant/service';
import {
    createNewPage,
    getApiContext,
    redirectToHomePage,
    uuid,
} from '../../utils/common';
import { fillDescriptionDetails, performBulkDownload } from '../../utils/importUtils';
import { visitServiceDetailsPage } from '../../utils/service';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

/**
 * Helper function to create a database service with a dot in the name
 */
async function createDatabaseServiceWithDot(
  apiContext: APIRequestContext,
  name: string
) {
  const response = await apiContext.post('/api/v1/services/databaseServices', {
    data: {
      name,
      serviceType: 'Mysql',
      connection: {
        config: {
          type: 'Mysql',
          scheme: 'mysql+pymysql',
          username: 'username',
          authType: { password: 'password' },
          hostPort: 'mysql:3306',
        },
      },
    },
  });

  return response.json();
}

/**
 * Helper function to create a database
 */
async function createDatabase(
  apiContext: APIRequestContext,
  name: string,
  serviceFqn: string
) {
  const response = await apiContext.post('/api/v1/databases', {
    data: {
      name,
      service: serviceFqn,
    },
  });

  return response.json();
}

/**
 * Helper function to create a database schema
 */
async function createDatabaseSchema(
  apiContext: APIRequestContext,
  name: string,
  databaseFqn: string
) {
  const response = await apiContext.post('/api/v1/databaseSchemas', {
    data: {
      name,
      database: databaseFqn,
    },
  });

  return response.json();
}

/**
 * Helper function to create a table
 */
async function createTable(
  apiContext: APIRequestContext,
  name: string,
  schemaFqn: string,
  columns: Array<{
    name: string;
    dataType: string;
    dataTypeDisplay?: string;
    dataLength?: number;
    description?: string;
  }>
) {
  const response = await apiContext.post('/api/v1/tables', {
    data: {
      name,
      databaseSchema: schemaFqn,
      columns,
    },
  });

  return response.json();
}

/**
 * Helper function to delete a database service
 */
async function deleteDatabaseService(
  apiContext: APIRequestContext,
  fqn: string
) {
  return apiContext.delete(
    `/api/v1/services/databaseServices/name/${encodeURIComponent(fqn)}?recursive=true&hardDelete=true`
  );
}

/**
 * Test suite for CSV import/export with service names containing dots.
 * This tests the fix for issue #24401 where CSV import fails when service
 * names contain dots (e.g., "local.mysql") because the FQN values in the
 * CSV contain quotes that need to be properly escaped.
 *
 * Example FQN in CSV: """local.mysql"".default" (quotes are doubled for escaping)
 */
test.describe('Bulk Import Export with Dot in Service Name', () => {
  /**
   * Test export and re-import of a database service with a dot in the name.
   * This verifies that:
   * 1. Export generates valid CSV with properly escaped FQN values
   * 2. Import can parse the CSV with quoted FQN values
   * 3. The full hierarchy (database, schema, table, columns) is preserved
   */
  test('Database service with dot in name - export and reimport', async ({
    browser,
  }) => {
    test.setTimeout(300_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    // Create a database service with a dot in the name (e.g., "local.mysql")
    const serviceNameWithDot = `pw.db.service.${uuid()}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    // Create a database under the service
    const databaseName = `pwdatabase${uuid().substring(0, 6)}`;
    const database = await createDatabase(
      apiContext,
      databaseName,
      service.fullyQualifiedName
    );

    // Create a schema under the database
    const schemaName = `pwschema${uuid().substring(0, 6)}`;
    const schema = await createDatabaseSchema(
      apiContext,
      schemaName,
      database.fullyQualifiedName
    );

    // Create a table under the schema
    const tableName = `pwtable${uuid().substring(0, 6)}`;
    await createTable(apiContext, tableName, schema.fullyQualifiedName, [
      {
        name: 'id',
        dataType: 'INT',
        dataTypeDisplay: 'int',
        description: 'Primary key',
      },
      {
        name: 'name',
        dataType: 'VARCHAR',
        dataTypeDisplay: 'varchar(255)',
        dataLength: 255,
        description: 'Name column',
      },
    ]);

    await redirectToHomePage(page);

    await test.step('Export database service with dot in name', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);
    });

    await test.step('Import exported CSV and verify parsing succeeds', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      // Wait for file to load
      await page.waitForTimeout(1000);

      // Verify CSV loaded correctly - this would fail before the fix
      // because the CSV parser couldn't handle quoted FQN values
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();

      // Verify the data rows are visible (database, schema, table, columns)
      const rowCount = await page.locator('.rdg-row').count();
      expect(rowCount).toBeGreaterThan(0);

      // Click Next to validate
      await page.getByRole('button', { name: 'Next' }).click();

      // Wait for validation to complete
      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      // Verify no failures
      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');

      // Update
      const updateButtonResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/importAsync') &&
          response.url().includes('dryRun=false')
      );

      await page.getByRole('button', { name: 'Update' }).click();

      await updateButtonResponse;

      await page.waitForSelector(
        '.inovua-react-toolkit-load-mask__background-layer',
        { state: 'detached', timeout: 60000 }
      );

      // Wait for navigation or toast - import succeeded if we get here without errors
      await page.waitForTimeout(2000);
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test that CSV with quoted FQN values can be loaded into the import grid.
   * This is the core test for issue #24401 - verifying that the CSV parsing
   * doesn't fail when FQN values contain escaped quotes.
   */
  test('CSV with quoted FQN loads correctly in import grid', async ({
    browser,
  }) => {
    test.setTimeout(180_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `org.project.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    // Create a simple hierarchy
    const database = await createDatabase(
      apiContext,
      `db${uid}`,
      service.fullyQualifiedName
    );
    await createDatabaseSchema(
      apiContext,
      `schema${uid}`,
      database.fullyQualifiedName
    );

    await redirectToHomePage(page);

    await test.step('Export and verify CSV loads without parsing errors', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);

      // Re-open import dialog
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      await page.waitForTimeout(1000);

      // The main assertion - CSV should load without errors
      // Before the fix, this would fail with CSV parsing error
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();

      // Verify rows are displayed
      const rowCount = await page.locator('.rdg-row').count();
      expect(rowCount).toBeGreaterThan(0);
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test the full import cycle - export, modify in grid, and reimport.
   * This tests that the CSV reconstruction from grid data properly escapes
   * quotes in FQN values.
   */
  test('Full import cycle with dot in service name', async ({ browser }) => {
    test.setTimeout(300_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `test.mysql.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    // Create initial hierarchy
    const database = await createDatabase(
      apiContext,
      `testdb${uid}`,
      service.fullyQualifiedName
    );
    const schema = await createDatabaseSchema(
      apiContext,
      `testschema${uid}`,
      database.fullyQualifiedName
    );
    await createTable(apiContext, `testtable${uid}`, schema.fullyQualifiedName, [
      {
        name: 'col1',
        dataType: 'INT',
        dataTypeDisplay: 'int',
      },
    ]);

    await redirectToHomePage(page);

    await test.step('Export, load into grid, validate, and update', async () => {
      // Export
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);

      // Import
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      await page.waitForTimeout(1000);

      // Verify grid loaded
      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Click Next to validate - this is where the CSV is reconstructed
      // from the grid data and sent to the backend. Before the fix,
      // this would fail because quotes in FQN weren't properly escaped.
      await page.getByRole('button', { name: 'Next' }).click();

      // Wait for validation
      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      // Verify validation passed with no failures
      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');

      // Update
      const updateButtonResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/importAsync') &&
          response.url().includes('dryRun=false')
      );

      await page.getByRole('button', { name: 'Update' }).click();
      await updateButtonResponse;

      await page.waitForSelector(
        '.inovua-react-toolkit-load-mask__background-layer',
        { state: 'detached', timeout: 60000 }
      );

      // Wait for completion - import succeeded if we get here without errors
      await page.waitForTimeout(2000);
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test with multiple dots in service name (e.g., "org.team.mysql.prod")
   */
  test('Service name with multiple dots', async ({ browser }) => {
    test.setTimeout(180_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    // Multiple dots in service name
    const serviceNameWithDot = `org.team.mysql.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    const database = await createDatabase(
      apiContext,
      `db${uid}`,
      service.fullyQualifiedName
    );
    await createDatabaseSchema(
      apiContext,
      `schema${uid}`,
      database.fullyQualifiedName
    );

    await redirectToHomePage(page);

    await test.step('Export and reimport with multiple dots in name', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);

      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      await page.waitForTimeout(1000);

      // Verify CSV loads correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();

      // Validate
      await page.getByRole('button', { name: 'Next' }).click();

      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test column with dot in name under a service with dot in name.
   * This tests double quoting scenario where both service and column have dots.
   * Column FQN: """service.name"".db.schema.table.""column.name"""
   */
  test('Column with dot in name under service with dot', async ({ browser }) => {
    test.setTimeout(240_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `col.test.svc.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    // Create hierarchy with column that has dot in name
    const database = await createDatabase(
      apiContext,
      `db${uid}`,
      service.fullyQualifiedName
    );
    const schema = await createDatabaseSchema(
      apiContext,
      `schema${uid}`,
      database.fullyQualifiedName
    );

    // Column with dot in name - requires quoting in FQN
    await createTable(apiContext, `table${uid}`, schema.fullyQualifiedName, [
      {
        name: 'user.email',
        dataType: 'VARCHAR',
        dataTypeDisplay: 'varchar(255)',
        dataLength: 255,
        description: 'User email with dot in column name',
      },
      {
        name: 'order.total',
        dataType: 'DECIMAL',
        dataTypeDisplay: 'decimal(10,2)',
        description: 'Order total with dot in column name',
      },
    ]);

    await redirectToHomePage(page);

    await test.step('Export and reimport with column dots', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);

      // Import the exported CSV
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      await page.waitForTimeout(1000);

      // Verify CSV loaded - columns with dots should be properly escaped
      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Validate
      await page.getByRole('button', { name: 'Next' }).click();

      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      // Verify no failures - this confirms column dots are handled
      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test bulk edit via import - modify description of existing entity.
   * This tests that editing in the grid and reimporting works with quoted FQNs.
   */
  test('Bulk edit existing entity with dot in service name', async ({
    browser,
  }) => {
    test.setTimeout(300_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `edit.test.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    const databaseName = `editdb${uid}`;
    const database = await createDatabase(
      apiContext,
      databaseName,
      service.fullyQualifiedName
    );
    await createDatabaseSchema(
      apiContext,
      `editschema${uid}`,
      database.fullyQualifiedName
    );

    await redirectToHomePage(page);

    await test.step('Export, edit description in grid, and update', async () => {
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await performBulkDownload(page, serviceNameWithDot);

      // Import
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${serviceNameWithDot}.csv`]);

      await page.waitForTimeout(1000);

      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Click on a cell to edit - find the first row's description cell
      // Navigate to description column (3rd column) and edit
      await page.locator('.rdg-row').nth(0).click();
      const descriptionCell1 = page.locator('.rdg-row').nth(0).locator('[aria-colindex="3"]');
      await descriptionCell1.dblclick();

      // Type new description
      await fillDescriptionDetails(page, 'Updated description via bulk edit');

      // Validate - this reconstructs CSV with edited data
      await page.getByRole('button', { name: 'Next' }).click();

      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');

      // Update
      const updateButtonResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/importAsync') &&
          response.url().includes('dryRun=false')
      );

      await page.getByRole('button', { name: 'Update' }).click();
      await updateButtonResponse;

      await page.waitForSelector(
        '.inovua-react-toolkit-load-mask__background-layer',
        { state: 'detached', timeout: 60000 }
      );

      await page.waitForTimeout(2000);
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test import at database level (not service level).
   * This ensures the fix works when importing from database page.
   */
  test('Import at database level with dot in service name', async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `db.level.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    const databaseName = `leveldb${uid}`;
    const database = await createDatabase(
      apiContext,
      databaseName,
      service.fullyQualifiedName
    );
    const schema = await createDatabaseSchema(
      apiContext,
      `levelschema${uid}`,
      database.fullyQualifiedName
    );
    await createTable(apiContext, `leveltable${uid}`, schema.fullyQualifiedName, [
      {
        name: 'id',
        dataType: 'INT',
        dataTypeDisplay: 'int',
      },
    ]);

    await redirectToHomePage(page);

    await test.step('Export and import at database level', async () => {
      // Navigate to database page
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await page.getByTestId(databaseName).click();
      await page.waitForLoadState('networkidle');

      // Export from database level
      await performBulkDownload(page, databaseName);

      // Import at database level
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${databaseName}.csv`]);

      await page.waitForTimeout(1000);

      // Verify CSV loaded
      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Validate
      await page.getByRole('button', { name: 'Next' }).click();

      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');

      // Update
      const updateButtonResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/importAsync') &&
          response.url().includes('dryRun=false')
      );

      await page.getByRole('button', { name: 'Update' }).click();
      await updateButtonResponse;

      await page.waitForSelector(
        '.inovua-react-toolkit-load-mask__background-layer',
        { state: 'detached', timeout: 60000 }
      );

      await page.waitForTimeout(2000);
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });

  /**
   * Test import at schema level with dot in service name.
   */
  test('Import at schema level with dot in service name', async ({
    browser,
  }) => {
    test.setTimeout(240_000);

    const { page, afterAction } = await createNewPage(browser);
    const { apiContext } = await getApiContext(page);

    const uid = uuid().substring(0, 6);
    const serviceNameWithDot = `schema.level.${uid}`;
    const service = await createDatabaseServiceWithDot(
      apiContext,
      serviceNameWithDot
    );

    const databaseName = `schemadb${uid}`;
    const database = await createDatabase(
      apiContext,
      databaseName,
      service.fullyQualifiedName
    );
    const schemaName = `levelschema${uid}`;
    const schema = await createDatabaseSchema(
      apiContext,
      schemaName,
      database.fullyQualifiedName
    );
    await createTable(apiContext, `schematable${uid}`, schema.fullyQualifiedName, [
      {
        name: 'col1',
        dataType: 'INT',
        dataTypeDisplay: 'int',
      },
    ]);

    await redirectToHomePage(page);

    await test.step('Export and import at schema level', async () => {
      // Navigate to schema page
      await visitServiceDetailsPage(
        page,
        { name: serviceNameWithDot, type: SERVICE_TYPE.Database },
        false
      );
      await page.getByTestId(databaseName).click();
      await page.waitForLoadState('networkidle');
      await page.getByTestId(schemaName).click();
      await page.waitForLoadState('networkidle');

      // Export from schema level
      await performBulkDownload(page, schemaName);

      // Import at schema level
      await page.click('[data-testid="manage-button"]');
      await page.waitForSelector('[data-testid="manage-dropdown-list-container"]', {
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');

      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([`downloads/${schemaName}.csv`]);

      await page.waitForTimeout(1000);

      // Verify CSV loaded
      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Validate
      await page.getByRole('button', { name: 'Next' }).click();

      await page.waitForSelector('[data-testid="processed-row"]', {
        timeout: 120000,
      });

      const failedRow = await page.$eval(
        '[data-testid="failed-row"]',
        (el) => el.textContent
      );
      expect(failedRow).toBe('0');
    });

    // Cleanup
    await deleteDatabaseService(apiContext, service.fullyQualifiedName);
    await afterAction();
  });
});
