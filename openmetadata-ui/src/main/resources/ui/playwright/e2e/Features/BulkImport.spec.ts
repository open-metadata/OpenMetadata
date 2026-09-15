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
import { Locator, Page } from '@playwright/test';
import { expect, test } from '../../support/fixtures/base';

import { RDG_ACTIVE_CELL_SELECTOR } from '../../constant/bulkImportExport';
import { GlobalSettingOptions } from '../../constant/settings';
import { Domain } from '../../support/domain/Domain';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  mockClipboardApi,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  addGridRowAndSelectFirstCell,
  createColumnRowDetails,
  createCustomPropertiesForEntity,
  createDatabaseRowDetails,
  createDatabaseSchemaRowDetails,
  createStoredProcedureRowDetails,
  createTableRowDetails,
  fillColumnDetails,
  fillRecursiveColumnDetails,
  fillRecursiveEntityTypeFQNDetails,
  fillRowDetails,
  fillStoredProcedureCode,
  firstTimeGridAddRowAction,
  performBulkDownload,
  performColumnSelectAndDeleteOperation,
  performDeleteOperationOnEntity,
  pressKeyXTimes,
  startCsvPreviewAndWaitForGrid,
  validateImportStatus,
} from '../../utils/importUtils';
import { waitForSearchIndexed } from '../../utils/polling';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const user1 = new UserClass();
const user2 = new UserClass();
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const domain1 = new Domain();
const domain2 = new Domain();

const glossaryDetails = {
  name: glossaryTerm.data.name,
  parent: glossary.data.name,
};

const databaseDetails1 = {
  ...createDatabaseRowDetails(),
  glossary: glossaryDetails,
};

const databaseDetails2 = {
  ...createDatabaseRowDetails(),
  glossary: glossaryDetails,
};

const databaseSchemaDetails1 = {
  ...createDatabaseSchemaRowDetails(),
  glossary: glossaryDetails,
};

const databaseSchemaDetails2 = {
  ...createDatabaseSchemaRowDetails(),
  glossary: glossaryDetails,
};

const validateSuccessfulImportStatus = async (page: Page) => {
  const expectedProcessed =
    (await page.getByTestId('processed-row').textContent())?.trim() ?? '0';

  await validateImportStatus(page, {
    passed: expectedProcessed,
    processed: expectedProcessed,
    failed: '0',
  });
};

const expectImportRowStatusesToContain = async (
  page: Page,
  rowStatus: string[]
) => {
  // The result grid populates cells asynchronously after Next-click. Without
  // first waiting for the row count to match, the toContainText assertion
  // can run mid-render against 0 or partial cells, fail under retry too,
  // and never recover. Wait for the expected number of detail cells before
  // checking text.
  await expect(page.locator('.rdg-cell-details')).toHaveCount(
    rowStatus.length,
    { timeout: 60_000 }
  );
  await expect(page.locator('.rdg-cell-details')).toContainText(rowStatus);
};

const tableDetails1 = {
  ...createTableRowDetails(),
  glossary: glossaryDetails,
};

const tableDetails2 = {
  ...createTableRowDetails(),
  glossary: glossaryDetails,
};

const columnDetails1 = {
  ...createColumnRowDetails(),
  glossary: glossaryDetails,
};

const columnDetails2 = {
  ...createColumnRowDetails(),
  glossary: glossaryDetails,
};

const storedProcedureDetails = {
  ...createStoredProcedureRowDetails(),
  glossary: glossaryDetails,
};

test.describe('Bulk Import Export', { tag: '@import-export' }, () => {
  test.beforeAll('setup pre-test', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user1.create(apiContext);
    await user2.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await domain1.create(apiContext);
    await domain2.create(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Database service', async ({ page }) => {
    // 6 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(600_000);

    let customPropertyRecord: Record<string, string> = {};

    const dbService = new DatabaseServiceClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbService.create(apiContext);

    // Bulk-import reads the service's children list from ES; wait for the
    // service to be indexed before the test fetches its export/edit grid.
    await waitForSearchIndexed(
      apiContext,
      dbService.entityResponseData.fullyQualifiedName,
      'database_service_search_index'
    );

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.DATABASES
      );
    });

    await test.step('should export data database service details', async () => {
      await dbService.visitEntityPage(page);
      await performBulkDownload(page, dbService.entity.name);
    });

    await test.step('should import and edit with two additional database', async () => {
      await dbService.visitEntityPage(page);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('manage-dropdown-list-container').waitFor({
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');
      const fileInput = page.getByTestId('upload-file-widget');
      await fileInput?.setInputFiles([
        'downloads/' + dbService.entity.name + '.csv',
      ]);

      await startCsvPreviewAndWaitForGrid(page);
      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      await firstTimeGridAddRowAction(page);

      // Add first database details
      await fillRowDetails(
        {
          ...databaseDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}`,
        databaseDetails1.entityType,
        page
      );

      // Add new row for new schema details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 13, 'ArrowLeft');

      await fillRowDetails(
        {
          ...databaseSchemaDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}.${databaseSchemaDetails1.name}`,
        databaseSchemaDetails1.entityType,
        page
      );

      // Add new row for new table details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 13, 'ArrowLeft');

      // Fill table and columns details
      await fillRowDetails(
        {
          ...tableDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}.${databaseSchemaDetails1.name}.${tableDetails1.name}`,
        tableDetails1.entityType,
        page
      );

      // Add new row for columns details
      await addGridRowAndSelectFirstCell(page);

      await fillRecursiveColumnDetails(
        {
          ...columnDetails1,
          fullyQualifiedName: `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}.${databaseSchemaDetails1.name}.${tableDetails1.name}.${columnDetails1.name}`,
        },
        page
      );

      // Add New StoredProcedure Details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 19, 'ArrowLeft');

      await fillRowDetails(
        {
          ...storedProcedureDetails,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain2.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}.${databaseSchemaDetails1.name}.${storedProcedureDetails.name}`,
        storedProcedureDetails.entityType,
        page
      );

      await pressKeyXTimes(page, 5, 'ArrowRight');

      await fillStoredProcedureCode(page);

      // Add 2nd Database Details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 19, 'ArrowLeft');

      await fillRowDetails(
        {
          ...databaseDetails2,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain2.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails2.name}`,
        databaseDetails2.entityType,
        page
      );

      await page.getByRole('button', { name: 'Next' }).click();

      const loader = page.locator(
        '.inovua-react-toolkit-load-mask__background-layer'
      );

      await loader.waitFor({ state: 'hidden' });

      await validateSuccessfulImportStatus(page);
      const rowStatus = [
        'Entity created',
        'Entity created',
        'Entity created',
        'Entity updated',
        'Entity created',
        'Entity created',
      ];

      await expectImportRowStatusesToContain(page, rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/services/databaseServices/name/*/importAsync?*dryRun=false&recursive=true*`
      );
      const navigationPromise = page.waitForEvent('framenavigated');

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await navigationPromise;
      await toastNotification(page, /details updated successfully/);
    });

    await dbService.delete(apiContext);
    await afterAction();
  });

  test('Database', async ({ page }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(500_000);

    let customPropertyRecord: Record<string, string> = {};

    const dbEntity = new DatabaseClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbEntity.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.DATABASE_SCHEMA
      );
    });

    await test.step('should export data database details', async () => {
      await dbEntity.visitEntityPage(page);
      await performBulkDownload(page, dbEntity.entity.name);
    });

    await test.step('should import and edit with two additional database schema', async () => {
      await dbEntity.visitEntityPage(page);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('manage-dropdown-list-container').waitFor({
        state: 'visible',
      });
      await page.click('[data-testid="import-button-title"]');
      await page
        .locator('[type="file"]')
        .setInputFiles(['downloads/' + dbEntity.entity.name + '.csv']);

      await startCsvPreviewAndWaitForGrid(page);

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      await firstTimeGridAddRowAction(page);

      await fillRowDetails(
        {
          ...databaseSchemaDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails1.name}`,
        databaseSchemaDetails1.entityType,
        page
      );

      // Add new row for columns details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 13, 'ArrowLeft');

      // Fill table and columns details
      await fillRowDetails(
        {
          ...tableDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails1.name}.${tableDetails1.name}`,
        tableDetails1.entityType,
        page
      );

      // Add new row for columns details
      await addGridRowAndSelectFirstCell(page);

      await fillRecursiveColumnDetails(
        {
          ...columnDetails1,
          fullyQualifiedName: `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails1.name}.${tableDetails1.name}.${columnDetails1.name}`,
        },
        page
      );

      // Add 2nd Schema Details
      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 17, 'ArrowLeft');

      await fillRowDetails(
        {
          ...databaseSchemaDetails2,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails2.name}`,
        databaseSchemaDetails2.entityType,
        page
      );

      const importApiCall = page.waitForResponse(
        (resp) =>
          resp.url().includes('/importAsync?dryRun=true') &&
          resp.request().method() === 'PUT'
      );

      await page.getByRole('button', { name: 'Next' }).click();
      await importApiCall;

      // Wait directly for final state (results grid)
      await page.getByTestId('passed-row').waitFor({
        state: 'visible',
      });
      // Verify no loading state remains
      await expect(page.getByText('Import is in progress.')).not.toBeVisible();

      await page.locator('text=Import is in progress.').waitFor({
        state: 'detached',
      });

      await validateSuccessfulImportStatus(page);

      await page.locator('.rdg-header-row').waitFor({
        state: 'visible',
      });

      const rowStatus = [
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity created',
        'Entity created',
        'Entity updated',
        'Entity created',
      ];

      await expectImportRowStatusesToContain(page, rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=true*`
      );
      const navigationPromise = page.waitForEvent('framenavigated');

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await navigationPromise;
      await toastNotification(page, /details updated successfully/);
    });

    await dbEntity.delete(apiContext);
    await afterAction();
  });

  test('Database Schema', async ({ page }) => {
    // 4 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(500_000);

    let customPropertyRecord: Record<string, string> = {};

    const dbSchemaEntity = new DatabaseSchemaClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbSchemaEntity.create(apiContext);

    // Bulk-import reads the schema's children list from ES; wait for the
    // schema to be indexed before the test fetches its export/edit grid.
    await waitForSearchIndexed(
      apiContext,
      dbSchemaEntity.entityResponseData.fullyQualifiedName,
      'database_schema_search_index'
    );

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.TABLES
      );
    });

    await test.step('should export data database schema details', async () => {
      await dbSchemaEntity.visitEntityPage(page);
      await performBulkDownload(page, dbSchemaEntity.entity.name);
    });

    await test.step('should import and edit with two additional table', async () => {
      await dbSchemaEntity.visitEntityPage(page);

      await page.click('[data-testid="manage-button"] > .anticon');
      await page.click('[data-testid="import-button-title"]');
      await page
        .locator('[type="file"]')
        .setInputFiles(['downloads/' + dbSchemaEntity.entity.name + '.csv']);

      await startCsvPreviewAndWaitForGrid(page);
      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      await firstTimeGridAddRowAction(page);

      // First Table Details with one Column
      await fillRowDetails(
        {
          ...tableDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails1.name}`,
        tableDetails1.entityType,
        page
      );

      // Add new row for columns details
      await addGridRowAndSelectFirstCell(page);

      // Fill table columns details
      await fillRecursiveColumnDetails(
        {
          ...columnDetails1,
          fullyQualifiedName: `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails1.name}.${columnDetails1.name}`,
        },
        page
      );

      // Add new row for table details
      await addGridRowAndSelectFirstCell(page);

      await fillRowDetails(
        {
          ...tableDetails2,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails2.name}`,
        tableDetails2.entityType,
        page
      );

      // Add new row for columns details
      await addGridRowAndSelectFirstCell(page);

      // fill second table columns details
      await fillRecursiveColumnDetails(
        {
          ...columnDetails2,
          fullyQualifiedName: `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails2.name}.${columnDetails2.name}`,
        },
        page
      );

      await page.getByRole('button', { name: 'Next' }).click();

      await validateSuccessfulImportStatus(page);

      const rowStatus = [
        'Entity created',
        'Entity updated',
        'Entity created',
        'Entity updated',
      ];

      await expectImportRowStatusesToContain(page, rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databaseSchemas/name/*/importAsync?*dryRun=false&recursive=true*`
      );
      const navigationPromise = page.waitForEvent('framenavigated');

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await navigationPromise;
      await toastNotification(page, /details updated successfully/);
    });

    await dbSchemaEntity.delete(apiContext);
    await afterAction();
  });

  test('Table', async ({ page }) => {
    test.setTimeout(300_000);

    const tableEntity = new TableClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await tableEntity.create(apiContext);

    // Bulk-import reads the table's columns from ES; wait for the table
    // to be indexed before the test fetches its export/edit grid.
    await waitForSearchIndexed(
      apiContext,
      tableEntity.entityResponseData.fullyQualifiedName,
      'table_search_index'
    );

    await test.step('should export data table details', async () => {
      await tableEntity.visitEntityPage(page);
      await performBulkDownload(page, tableEntity.entity.name);
    });

    await test.step('should import and edit with two additional columns', async () => {
      await tableEntity.visitEntityPage(page);
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="import-button-title"]');
      await page
        .locator('[type="file"]')
        .setInputFiles(['downloads/' + tableEntity.entity.name + '.csv']);

      await startCsvPreviewAndWaitForGrid(page);
      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      await firstTimeGridAddRowAction(page);

      // Click on first cell and edit
      await fillColumnDetails(columnDetails1, page);

      await page.click('[data-testid="add-row-btn"]');

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await pressKeyXTimes(page, 9, 'ArrowLeft');

      await fillColumnDetails(columnDetails2, page);

      await page.getByRole('button', { name: 'Next' }).click();
      // total column count +2 for newly added columns
      const count = `${tableEntity.entityLinkColumnsName.length + 2}`;
      await validateImportStatus(page, {
        passed: count,
        processed: count,
        failed: '0',
      });

      // total column count +2 for newly added columns
      const rowStatus = new Array(
        tableEntity.entityLinkColumnsName.length + 2
      ).fill('Entity updated');

      await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/tables/name/*/importAsync?*dryRun=false&recursive=true*`
      );

      // eslint-disable-next-line playwright/no-force-option -- button obscured by data grid overlay
      await page.click('[type="button"] >> text="Update"', { force: true });
      await updateButtonResponse;
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });
      await toastNotification(page, /details updated successfully/);
    });

    await afterAction();
  });

  test('Keyboard Delete selection', async ({ page }) => {
    test.slow(true);

    const dbEntity = new DatabaseClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbEntity.create(apiContext);

    await test.step('should export data database schema details', async () => {
      await dbEntity.visitEntityPage(page);
      await performBulkDownload(page, dbEntity.entity.name);
    });

    await test.step('should import and perform edit operation on entity', async () => {
      await dbEntity.visitEntityPage(page);

      await page.click('[data-testid="manage-button"] > .anticon');
      await page.click('[data-testid="import-button-title"]');
      await page
        .locator('[type="file"]')
        .setInputFiles(['downloads/' + dbEntity.entity.name + '.csv']);

      await startCsvPreviewAndWaitForGrid(page);

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      // Click on first cell and edit
      await page.click('.rdg-cell[role="gridcell"]');
      await fillRowDetails(
        {
          ...databaseDetails1,
          owners: [
            user1.responseData?.['displayName'],
            user2.responseData?.['displayName'],
          ],
          domains: domain1.responseData,
        },
        page,
        undefined,
        true
      );

      await fillRecursiveEntityTypeFQNDetails(
        `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails1.name}`,
        databaseSchemaDetails1.entityType,
        page
      );

      await page.getByRole('button', { name: 'Next' }).click();

      await validateSuccessfulImportStatus(page);

      const rowStatus = [
        'Entity created',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
      ];

      await expectImportRowStatusesToContain(page, rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=true*`
      );
      const navigationPromise = page.waitForEvent('framenavigated');

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await navigationPromise;
      await toastNotification(page, /details updated successfully/);
    });

    await test.step('should export data database schema details after edit changes', async () => {
      await dbEntity.visitEntityPage(page);
      await performBulkDownload(page, `${dbEntity.entity.name}-delete`);
    });

    await test.step('Perform Column Select and Delete Operation', async () => {
      await page.click('[data-testid="manage-button"] > .anticon');
      await page.click('[data-testid="import-button-title"]');
      await page
        .locator('[type="file"]')
        .setInputFiles([
          'downloads/' + `${dbEntity.entity.name}-delete` + '.csv',
        ]);

      await startCsvPreviewAndWaitForGrid(page);

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.getByTestId('add-row-btn')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).toBeVisible();

      // Perform Delete Operation  on Edit Operation on Entity
      await performColumnSelectAndDeleteOperation(page);
    });

    await test.step('Perform Cell Delete Operation and Save', async () => {
      await page.locator('.rdg-cell-name').first().click();

      // Perform Delete Operation on Edit Operation on Entity
      await performDeleteOperationOnEntity(page);

      await page.getByRole('button', { name: 'Next' }).click();

      await validateSuccessfulImportStatus(page);

      const rowStatus = [
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
        'Entity updated',
      ];

      await expectImportRowStatusesToContain(page, rowStatus);

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=true*`
      );
      const navigationPromise = page.waitForEvent('framenavigated');

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await navigationPromise;
      await toastNotification(page, /details updated successfully/);
    });

    await test.step('should verify the removed value from entity', async () => {
      await page.getByTestId('alert-bar').waitFor({ state: 'detached' });
      await waitForAllLoadersToDisappear(page);
      const columnNameLink = page
        .getByTestId('column-name')
        .first()
        .locator('a');
      await columnNameLink.waitFor({ state: 'visible' });
      await columnNameLink.click();

      await expect(
        page
          .getByTestId('asset-description-container')
          .getByText('No description')
      ).toBeVisible();

      await expect(
        page.getByTestId('tags-container').getByTestId('add-tag')
      ).toBeVisible();

      await expect(
        page.getByTestId('glossary-container').getByTestId('add-tag')
      ).toBeVisible();

      await expect(page.getByTestId('Tier')).toContainText('--');

      await expect(page.getByTestId('certification-label')).toContainText('--');

      await expect(page.getByTestId('owner-label')).toContainText('--');

      await expect(page.getByTestId('no-domain-text')).toBeVisible();
    });

    await dbEntity.delete(apiContext);
    await afterAction();
  });

  test('Range selection', async ({ page }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(300_000);

    // Grid copy/paste calls navigator.clipboard directly; the real OS clipboard
    // API is unreliable in AUT/headless CI even with permissions granted.
    await mockClipboardApi(page);

    const dbEntity = new DatabaseClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbEntity.create(apiContext);

    try {
      await test.step('should export data database details', async () => {
        await dbEntity.visitEntityPage(page);
        await performBulkDownload(page, dbEntity.entity.name);
      });

      await test.step('should import and test range selection', async () => {
        await dbEntity.visitEntityPage(page);
        await page.getByTestId('manage-button').click();
        await page
          .getByTestId('manage-dropdown-list-container')
          .waitFor({ state: 'visible' });
        await page.click('[data-testid="import-button-title"]');
        await page
          .locator('[type="file"]')
          .setInputFiles(['downloads/' + dbEntity.entity.name + '.csv']);
        await startCsvPreviewAndWaitForGrid(page);

        // Principle 7: wait for the grid to be fully idle before interacting.
        // DatabaseClass exports 1 schema + 1 table + 6 columns = 8 rows, 6 columns.
        const rowCount = 8;
        const colCount = 6; // Name, Display Name, Description, Owner, Tags, Glossary Terms
        await expect(page.locator('.rdg-header-row')).toBeVisible();
        await expect(page.locator('.rdg-row')).toHaveCount(rowCount);
        // Principle 3: wait for all headers to render before any interaction
        await expect(
          page.locator('.rdg-header-row').first().locator('.rdg-cell')
        ).toHaveCount(colCount);
        // Confirm data has loaded (not just skeleton rows)
        await expect(
          page.locator('.rdg-row').first().locator('.rdg-cell').first()
        ).not.toBeEmpty();

        // Principle 6 & 10: shared helpers — every action waits for observable
        // UI state before returning so callers never fire into a transitional state.
        const selection = page.locator('.rdg-cell-range-selections');

        const focusCell = async (cell: Locator) => {
          await cell.click();
          await expect(cell).toBeFocused();
        };

        const isFocused = (cell: Locator) =>
          cell.evaluate((el) => el === document.activeElement);

        // Principle 1: press a bare Arrow key and wait for destination focus.
        //
        // RDG drops the press outright while the grid is still settling after a
        // click or re-render — focus simply stays on the origin cell and the
        // grid's own keydown handler never runs. Re-press until focus lands,
        // checking the destination first so a press that did register is never
        // doubled.
        const move = async (key: string, destination: Locator) => {
          await expect
            .poll(
              async () => {
                if (await isFocused(destination)) {
                  return true;
                }
                await page.keyboard.press(key);

                return isFocused(destination);
              },
              { timeout: 15_000, intervals: [200, 400, 800] }
            )
            .toBe(true);
        };

        // Principle 5 & 9: press Shift+Arrow and assert the expected selection
        // count before returning — replaces fixed delays with observable-state waits.
        const extend = async (key: string, expectedCount: number) => {
          await page.keyboard.press(`Shift+${key}`);
          await expect(selection).toHaveCount(expectedCount);
        };

        await test.step('Ctrl+a should select all cells in the grid and deselect all cells by clicking on second cell of .rdg-row', async () => {
          // Principle 1 & 8: fresh locator + confirm focus before Ctrl+A.
          // The CSV jobs tray can steal keyboard focus when it appears; an explicit
          // click + toBeFocused() guarantees the grid owns the keyboard.
          await focusCell(
            page.locator('.rdg-row').first().locator('.rdg-cell').first()
          );
          await page.keyboard.press('Control+A');
          await expect(selection).toHaveCount(rowCount * colCount);

          // Deselect by clicking the second cell (fresh locator, principle 8)
          const secondCell = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .nth(1);
          await secondCell.click();
          await expect(secondCell).toBeFocused();
          await expect(selection).toHaveCount(0);
        });

        await test.step('should select all the cells in the column by clicking on column header', async () => {
          const firstHeaderCell = page
            .locator('.rdg-header-row')
            .first()
            .locator('.rdg-cell')
            .first();
          await firstHeaderCell.click();
          await expect(firstHeaderCell).toBeFocused();
          await expect(selection).toHaveCount(rowCount);
        });

        await test.step('allow multiple column selection', async () => {
          // Principle 4: hover() instead of boundingBox() — locators auto-retry
          // until visible, unaffected by scroll, DPI, or layout shifts.
          const headerRow = page.locator('.rdg-header-row').first();
          const startHeaderCell = headerRow.locator('.rdg-cell').nth(1);
          const endHeaderCell = headerRow.locator('.rdg-cell').nth(3);

          await startHeaderCell.hover();
          await page.mouse.down();
          await expect(startHeaderCell).toBeFocused();
          await endHeaderCell.hover();
          await page.mouse.up();

          await expect(selection).toHaveCount(rowCount * 3);
        });

        await test.step('allow multiple column selection using keyboard', async () => {
          const firstHeaderCell = page
            .locator('.rdg-header-row')
            .first()
            .locator('.rdg-cell')
            .first();
          const firstDataCell = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .first();

          // Principle 1: confirm data cell focus before navigating up
          await focusCell(firstDataCell);
          // Confirm header focus before extending — without this wait, the
          // Shift action fires in the data row and selects only 1 row.
          await move('ArrowUp', firstHeaderCell);

          // Shift+click the 3rd header cell to select cols 0-2 deterministically.
          // Repeated Shift+ArrowRight races RDG's own internal keyboard handler
          // (both react to the same bubbling keydown event), causing flaky counts.
          const targetHeaderCell = page
            .locator('.rdg-header-row')
            .first()
            .locator('.rdg-cell')
            .nth(2);
          await page.keyboard.down('Shift');
          await targetHeaderCell.click();
          await page.keyboard.up('Shift');

          await expect(selection).toHaveCount(rowCount * 3);
        });

        await test.step('allow multiple cell selection using mouse on rightDown and leftUp and extend selection using shift+click', async () => {
          // Principle 4 & 8: fresh locators + hover-drag instead of boundingBox()
          const firstCellFirstRow = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .first();
          const secondCellFourthRow = page
            .locator('.rdg-row')
            .nth(3)
            .locator('.rdg-cell')
            .nth(1);
          const fifthCellSixthRow = page
            .locator('.rdg-row')
            .nth(5)
            .locator('.rdg-cell')
            .nth(4);

          await focusCell(secondCellFourthRow);

          // Drag right-bottom then continue to left-top within the same mouse-down
          await secondCellFourthRow.hover();
          await page.mouse.down();
          await fifthCellSixthRow.hover();
          await expect(selection).toHaveCount(12);
          await firstCellFirstRow.hover();
          await page.mouse.up();
          await expect(selection).toHaveCount(8);

          // Extend via Shift+click
          await page.keyboard.down('Shift');
          await fifthCellSixthRow.click();
          await page.keyboard.up('Shift');
          await expect(selection).toHaveCount(12);

          await page.keyboard.down('Shift');
          await firstCellFirstRow.click();
          await page.keyboard.up('Shift');
          await expect(selection).toHaveCount(8);
        });

        await test.step('perform single cell copy-paste and undo-redo', async () => {
          // Principle 1, 8: fresh locators + confirm focus before Ctrl+C
          const firstCell = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .first();
          const secondCell = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .nth(1);

          await focusCell(firstCell);
          await page.keyboard.press('Control+C');
          // Confirm focus moved to secondCell before paste
          await move('ArrowRight', secondCell);
          await page.keyboard.press('Control+V');
          await expect(secondCell).toHaveText(
            (await firstCell.textContent()) || ''
          );

          await page.keyboard.press('Control+Z');
          await expect(secondCell).toHaveText('');

          await page.keyboard.press('Control+Y');
          await expect(secondCell).toHaveText(
            (await firstCell.textContent()) || ''
          );
        });

        await test.step('Select range, copy-paste and undo-redo', async () => {
          const firstHeaderCell = page
            .locator('.rdg-header-row')
            .first()
            .locator('.rdg-cell')
            .first();
          const firstCell = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .first();

          // Confirm data cell focus then confirm header focus before Shift+Right
          await focusCell(firstCell);
          await move('ArrowUp', firstHeaderCell);

          // Select 3 columns via Shift+Right (each press is a sync point)
          await extend('ArrowRight', rowCount * 2);
          await extend('ArrowRight', rowCount * 3);

          // copy the range
          await page.keyboard.press('Control+C');

          // click on fourth cell of first row (principle 8: fresh locator)
          const fourthCellFirstRow = page
            .locator('.rdg-row')
            .first()
            .locator('.rdg-cell')
            .nth(3);
          await fourthCellFirstRow.click();

          // paste the range
          await page.keyboard.press('Control+V');

          // check if the range is pasted correctly
          await expect(fourthCellFirstRow).toContainText(
            (await firstCell.textContent()) || ''
          );
          await expect(
            page.locator('.rdg-row').nth(0).locator('.rdg-cell').nth(3)
          ).toContainText(
            (await page
              .locator('.rdg-row')
              .nth(0)
              .locator('.rdg-cell')
              .first()
              .textContent()) || ''
          );

          // undo the action
          await page.keyboard.press('Control+Z');

          // check if the range is pasted correctly
          await expect(fourthCellFirstRow).toHaveText('—');
          await expect(
            page.locator('.rdg-row').nth(0).locator('.rdg-cell').nth(3)
          ).toHaveText('—');

          // redo the action
          await page.keyboard.press('Control+Y');

          // check if the range is pasted correctly
          await expect(fourthCellFirstRow).toContainText(
            (await firstCell.textContent()) || ''
          );

          // undo the action
          await page.keyboard.press('Control+Z');
        });
      });
    } finally {
      await dbEntity.delete(apiContext);
      await afterAction();
    }
  });
});
