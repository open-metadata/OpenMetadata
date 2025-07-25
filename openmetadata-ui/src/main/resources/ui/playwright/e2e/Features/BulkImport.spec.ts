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
import { expect, test } from '@playwright/test';

import { RDG_ACTIVE_CELL_SELECTOR } from '../../constant/bulkImportExport';
import { GlobalSettingOptions } from '../../constant/settings';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
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
  pressKeyXTimes,
  validateImportStatus,
} from '../../utils/importUtils';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const glossaryDetails = {
  name: EntityDataClass.glossaryTerm1.data.name,
  parent: EntityDataClass.glossary1.data.name,
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

test.describe('Bulk Import Export', () => {
  test.beforeAll('setup pre-test', async ({ browser }, testInfo) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    testInfo.setTimeout(90000);
    await EntityDataClass.preRequisitesForTests(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }, testInfo) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    testInfo.setTimeout(90000);
    await EntityDataClass.postRequisitesForTests(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Database service', async ({ page }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(300_000);

    let customPropertyRecord: Record<string, string> = {};

    const dbService = new DatabaseServiceClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbService.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.DATABASES
      );
    });

    await test.step('should export data database service details', async () => {
      await dbService.visitEntityPageWithCustomSearchBox(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-title"]');
      await page.fill('#fileName', dbService.entity.name);
      await page.click('#submit-button');
      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step(
      'should import and edit with two additional database',
      async () => {
        await dbService.visitEntityPage(page);
        await page.click('[data-testid="manage-button"] > .anticon');
        await page.click('[data-testid="import-button-title"]');
        const fileInput = page.getByTestId('upload-file-widget');
        await fileInput?.setInputFiles([
          'downloads/' + dbService.entity.name + '.csv',
        ]);

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
          },
          page
        );

        await fillRecursiveEntityTypeFQNDetails(
          `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails1.name}.${databaseSchemaDetails1.name}.${tableDetails1.name}`,
          tableDetails1.entityType,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain2.responseData,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain2.responseData,
          },
          page
        );

        await fillRecursiveEntityTypeFQNDetails(
          `${dbService.entityResponseData.fullyQualifiedName}.${databaseDetails2.name}`,
          databaseDetails2.entityType,
          page
        );

        await page.waitForTimeout(100);
        await page.getByRole('button', { name: 'Next' }).click();

        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );

        await loader.waitFor({ state: 'hidden' });

        await validateImportStatus(page, {
          passed: '7',
          processed: '7',
          failed: '0',
        });
        const rowStatus = [
          'Entity created',
          'Entity created',
          'Entity created',
          'Entity updated',
          'Entity created',
          'Entity created',
        ];

        await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

        const updateButtonResponse = page.waitForResponse(
          `/api/v1/services/databaseServices/name/*/importAsync?*dryRun=false&recursive=true*`
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });

        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);
      }
    );

    await dbService.delete(apiContext);
    await afterAction();
  });

  test('Database', async ({ page }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(300_000);

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
      await dbEntity.visitEntityPageWithCustomSearchBox(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-title"]');
      await page.fill('#fileName', dbEntity.entity.name);
      await page.click('#submit-button');

      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step(
      'should import and edit with two additional database schema',
      async () => {
        await dbEntity.visitEntityPage(page);
        await page.click('[data-testid="manage-button"] > .anticon');
        await page.click('[data-testid="import-button-title"]');
        const fileInput = await page.$('[type="file"]');
        await fileInput?.setInputFiles([
          'downloads/' + dbEntity.entity.name + '.csv',
        ]);

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
          },
          page
        );

        await fillRecursiveEntityTypeFQNDetails(
          `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails1.name}.${tableDetails1.name}`,
          tableDetails1.entityType,
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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
          },
          page
        );

        await fillRecursiveEntityTypeFQNDetails(
          `${dbEntity.entityResponseData.fullyQualifiedName}.${databaseSchemaDetails2.name}`,
          databaseSchemaDetails2.entityType,
          page
        );

        await page.getByRole('button', { name: 'Next' }).click();
        await page.waitForSelector('text=Import is in progress.', {
          state: 'attached',
        });
        await page.waitForSelector('text=Import is in progress.', {
          state: 'detached',
        });

        await validateImportStatus(page, {
          passed: '13',
          processed: '13',
          failed: '0',
        });

        await page.waitForSelector('.rdg-header-row', {
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

        await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

        const updateButtonResponse = page.waitForResponse(
          `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=true*`
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });

        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);
      }
    );

    await dbEntity.delete(apiContext);
    await afterAction();
  });

  test('Database Schema', async ({ page }) => {
    // 4 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(240_000);

    let customPropertyRecord: Record<string, string> = {};

    const dbSchemaEntity = new DatabaseSchemaClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbSchemaEntity.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.TABLES
      );
    });

    await test.step('should export data database schema details', async () => {
      await dbSchemaEntity.visitEntityPageWithCustomSearchBox(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-title"]');
      await page.fill('#fileName', dbSchemaEntity.entity.name);
      await page.click('#submit-button');

      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step(
      'should import and edit with two additional table',
      async () => {
        await dbSchemaEntity.visitEntityPage(page);

        await page.click('[data-testid="manage-button"] > .anticon');
        await page.click('[data-testid="import-button-title"]');
        const fileInput = await page.$('[type="file"]');
        await fileInput?.setInputFiles([
          'downloads/' + dbSchemaEntity.entity.name + '.csv',
        ]);

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

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
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
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
        await page.click('[data-testid="add-row-btn"]');

        // Reverse traves to first cell to fill the details
        await page.click(RDG_ACTIVE_CELL_SELECTOR);
        await page
          .locator(RDG_ACTIVE_CELL_SELECTOR)
          .press('ArrowDown', { delay: 100 });

        await pressKeyXTimes(page, 13, 'ArrowLeft');

        // Fill table columns details
        await fillRecursiveColumnDetails(
          {
            ...columnDetails1,
            fullyQualifiedName: `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails1.name}.${columnDetails1.name}`,
          },
          page
        );

        // Add new row for table details
        await page.click('[data-testid="add-row-btn"]');

        // Reverse traves to first cell to fill the details
        await page.click(RDG_ACTIVE_CELL_SELECTOR);
        await page
          .locator(RDG_ACTIVE_CELL_SELECTOR)
          .press('ArrowDown', { delay: 100 });

        await pressKeyXTimes(page, 17, 'ArrowLeft');

        await fillRowDetails(
          {
            ...tableDetails2,
            owners: [
              EntityDataClass.user1.responseData?.['displayName'],
              EntityDataClass.user2.responseData?.['displayName'],
            ],
            domains: EntityDataClass.domain1.responseData,
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
        await page.click('[data-testid="add-row-btn"]');

        // Reverse traves to first cell to fill the details
        await page.click(RDG_ACTIVE_CELL_SELECTOR);
        await page
          .locator(RDG_ACTIVE_CELL_SELECTOR)
          .press('ArrowDown', { delay: 100 });

        await pressKeyXTimes(page, 13, 'ArrowLeft');

        // fill second table columns details
        await fillRecursiveColumnDetails(
          {
            ...columnDetails2,
            fullyQualifiedName: `${dbSchemaEntity.entityResponseData.fullyQualifiedName}.${tableDetails2.name}.${columnDetails2.name}`,
          },
          page
        );

        await page.getByRole('button', { name: 'Next' }).click();

        await validateImportStatus(page, {
          passed: '5',
          processed: '5',
          failed: '0',
        });

        const rowStatus = [
          'Entity created',
          'Entity updated',
          'Entity created',
          'Entity updated',
        ];

        await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

        const updateButtonResponse = page.waitForResponse(
          `/api/v1/databaseSchemas/name/*/importAsync?*dryRun=false&recursive=true*`
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });

        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);
      }
    );

    await dbSchemaEntity.delete(apiContext);
    await afterAction();
  });

  test('Table', async ({ page }) => {
    test.slow(true);

    const tableEntity = new TableClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await tableEntity.create(apiContext);

    await test.step('should export data table details', async () => {
      await tableEntity.visitEntityPageWithCustomSearchBox(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-title"]');
      await page.fill('#fileName', tableEntity.entity.name);
      await page.click('#submit-button');

      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step(
      'should import and edit with two additional columns',
      async () => {
        await tableEntity.visitEntityPage(page);
        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-title"]');
        const fileInput = await page.$('[type="file"]');
        await fileInput?.setInputFiles([
          'downloads/' + tableEntity.entity.name + '.csv',
        ]);

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

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

        await validateImportStatus(page, {
          passed: '11',
          processed: '11',
          failed: '0',
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
          'Entity updated',
          'Entity updated',
        ];

        await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

        const updateButtonResponse = page.waitForResponse(
          `/api/v1/tables/name/*/importAsync?*dryRun=false&recursive=true*`
        );

        await page.click('[type="button"] >> text="Update"', { force: true });
        await updateButtonResponse;
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });
        await toastNotification(page, /details updated successfully/);
      }
    );

    await tableEntity.delete(apiContext);
    await afterAction();
  });

  test('Range selection', async ({ page }) => {
    // 5 minutes to avoid test timeout happening some times in AUTs, since it add all the entities layer
    test.setTimeout(300_000);

    const dbEntity = new DatabaseClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await dbEntity.create(apiContext);

    await test.step('should export data database details', async () => {
      await dbEntity.visitEntityPage(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
      await page.fill('#fileName', dbEntity.entity.name);
      await page.click('#submit-button');

      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step('should import and test range selection', async () => {
      await dbEntity.visitEntityPage(page);
      await page.click('[data-testid="manage-button"] > .anticon');
      await page.click('[data-testid="import-button-description"]');
      const fileInput = await page.$('[type="file"]');
      await fileInput?.setInputFiles([
        'downloads/' + dbEntity.entity.name + '.csv',
      ]);

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();

      // Context: this is virtual gird, so we have 8 rows and 6 columns and 1 header row visible
      await expect(page.locator('.rdg-row')).toHaveCount(8);
      await expect(page.locator('.rdg-cell')).toHaveCount(54); // this also includes header cells

      await test.step(
        'Ctrl+a should select all cells in the grid and deselect all cells by clicking on second cell of .rdg-row',
        async () => {
          await page.keyboard.press('Control+A');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            48
          );

          // Deselect all the cells by clicking on second cell of .rdg-row
          const firstRow = page.locator('.rdg-row').first();
          const firstCell = firstRow.locator('.rdg-cell').nth(1);
          const secondCell = firstRow.locator('.rdg-cell').nth(1);
          secondCell.click();

          expect(firstCell).not.toBeFocused();
          expect(secondCell).toBeFocused();

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            0
          );
        }
      );

      await test.step(
        'should select all the cells in the column by clicking on column header',
        async () => {
          const firstHeaderCell = await page
            .locator('.rdg-header-row')
            .first()
            .locator('.rdg-cell')
            .first();

          const firstRow = page.locator('.rdg-row').first();
          const firstCell = firstRow.locator('.rdg-cell').nth(1);

          await firstHeaderCell.click();

          await expect(firstCell).not.toBeFocused();

          await expect(firstHeaderCell).toBeFocused();

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            8
          );
        }
      );

      await test.step('allow multiple column selection', async () => {
        const headerRow = page.locator('.rdg-header-row');
        // Mouse down on first header cell then move to 3rd header cell then mouse up
        const startHeaderCell = headerRow.locator('.rdg-cell').nth(1);
        const endHeaderCell = headerRow.locator('.rdg-cell').nth(3);

        const startBox = await startHeaderCell.boundingBox();
        const endBox = await endHeaderCell.boundingBox();

        if (!startBox || !endBox) {
          throw new Error('Failed to get bounding boxes');
        }

        const startX = startBox.x + startBox.width / 2;
        const startY = startBox.y + startBox.height / 2;
        const endX = endBox.x + endBox.width / 2;
        const endY = endBox.y + endBox.height / 2;

        const mouse = page.mouse;

        // Simulate drag from col 2 to col 4
        await mouse.move(startX, startY);
        await mouse.down();

        await expect(startHeaderCell).toBeFocused();

        await mouse.move(endX, endY, { steps: 10 }); // Smooth drag
        await mouse.up();

        await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
          24
        );
      });

      await test.step(
        'allow multiple column selection using keyboard',
        async () => {
          // click first cell of first row
          const firstRow = page.locator('.rdg-row').first();
          const firstCell = firstRow.locator('.rdg-cell').first();
          await firstCell.click();

          // Press arrow up to go to header row
          await page.keyboard.press('ArrowUp');
          // press arrow right 3 times
          await page.keyboard.press('Shift+ArrowRight');
          await page.keyboard.press('Shift+ArrowRight');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            24
          );
        }
      );

      await test.step(
        'allow multiple cell selection using mouse on rightDown and leftUp and extend selection using shift+click',
        async () => {
          // click first cell of first row
          const firstRow = page.locator('.rdg-row').first();
          const fourthRow = page.locator('.rdg-row').nth(3);
          const sixthRow = page.locator('.rdg-row').nth(5);

          const firstCellFirstRow = firstRow.locator('.rdg-cell').first();
          const secondCellFourthRow = fourthRow.locator('.rdg-cell').nth(1);
          const fifthCellSixthRow = sixthRow.locator('.rdg-cell').nth(4);

          await secondCellFourthRow.click();

          await expect(secondCellFourthRow).toBeFocused();

          const startBox = await secondCellFourthRow.boundingBox();
          const endBoxRightBottom = await fifthCellSixthRow.boundingBox();
          const endBoxLeftUp = await firstCellFirstRow.boundingBox();

          if (!startBox || !endBoxRightBottom || !endBoxLeftUp) {
            throw new Error('Failed to get bounding boxes');
          }

          const startX = startBox.x + startBox.width / 2;
          const startY = startBox.y + startBox.height / 2;
          const endXRightBottom =
            endBoxRightBottom.x + endBoxRightBottom.width / 2;
          const endYRightBottom =
            endBoxRightBottom.y + endBoxRightBottom.height / 2;
          const endXLeftUp = endBoxLeftUp.x + endBoxLeftUp.width / 2;
          const endYLeftUp = endBoxLeftUp.y + endBoxLeftUp.height / 2;

          const mouse = page.mouse;

          // Simulate drag from col 2 to col 4
          await mouse.move(startX, startY);
          await mouse.down();

          await mouse.move(endXRightBottom, endYRightBottom, { steps: 10 }); // Smooth drag

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            12
          );

          await mouse.move(endXLeftUp, endYLeftUp, { steps: 10 }); // Smooth drag
          await mouse.up();

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            8
          );

          // Hold shift and click on fifthCellSixthRow
          await page.keyboard.down('Shift');
          await fifthCellSixthRow.click();
          await page.keyboard.up('Shift');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            12
          );

          // Hold shift and click on firstCellFirstRow
          await page.keyboard.down('Shift');
          await firstCellFirstRow.click();
          await page.keyboard.up('Shift');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            8
          );
        }
      );

      await test.step(
        'allow multiple cell selection using keyboard on rightDown and leftUp',
        async () => {
          // click first cell of first row
          const firstRow = page.locator('.rdg-row').first();
          const firstCell = firstRow.locator('.rdg-cell').first();
          await firstCell.click();

          // navigate to 4th row, second cell
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.press('ArrowDown');

          await page.keyboard.press('Shift+ArrowDown');
          await page.keyboard.press('Shift+ArrowDown');
          await page.keyboard.press('Shift+ArrowRight');
          await page.keyboard.press('Shift+ArrowRight');
          await page.keyboard.press('Shift+ArrowRight');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            12
          );

          // Select left up cells
          await page.keyboard.press('Shift+ArrowUp');
          await page.keyboard.press('Shift+ArrowUp');
          await page.keyboard.press('Shift+ArrowUp');
          await page.keyboard.press('Shift+ArrowUp');
          await page.keyboard.press('Shift+ArrowUp');
          await page.keyboard.press('Shift+ArrowLeft');
          await page.keyboard.press('Shift+ArrowLeft');
          await page.keyboard.press('Shift+ArrowLeft');
          await page.keyboard.press('Shift+ArrowLeft');

          await expect(page.locator('.rdg-cell-range-selections')).toHaveCount(
            8
          );
        }
      );

      await test.step(
        'perform single cell copy-paste and undo-redo',
        async () => {
          // click first cell of first row
          const firstRow = page.locator('.rdg-row').first();
          const firstCell = firstRow.locator('.rdg-cell').first();
          const secondCell = firstRow.locator('.rdg-cell').nth(1);
          await firstCell.click();

          // copy the cell
          await page.keyboard.press('Control+C');

          // move to next right cell
          await page.keyboard.press('ArrowRight');

          // paste the cell
          await page.keyboard.press('Control+V');

          // second cell should have text equal to first cell text
          await expect(secondCell).toHaveText(
            (await firstCell.textContent()) || ''
          );

          // undo the action
          await page.keyboard.press('Control+Z');

          await expect(secondCell).toHaveText('');

          // redo the action
          await page.keyboard.press('Control+Y');

          // second cell should have text equal to first cell text
          await expect(secondCell).toHaveText(
            (await firstCell.textContent()) || ''
          );
        }
      );

      await test.step('Select range, copy-paste and undo-redo', async () => {
        // click on first cell to focus
        const firstRow = page.locator('.rdg-row').first();
        const firstCell = firstRow.locator('.rdg-cell').first();
        await firstCell.click();

        // navigate to header row
        await page.keyboard.press('ArrowUp');
        await page.keyboard.down('Shift');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.up('Shift');

        // copy the range
        await page.keyboard.press('Control+C');

        // click on fourth cell of first row
        const fourthCellFirstRow = firstRow.locator('.rdg-cell').nth(3);
        await fourthCellFirstRow.click();

        // paste the range
        await page.keyboard.press('Control+V');

        // check if the range is pasted correctly
        await expect(fourthCellFirstRow).toHaveText(
          (await firstCell.textContent()) || ''
        );
        await expect(
          page.locator('.rdg-row').nth(1).locator('.rdg-cell').nth(3)
        ).toHaveText(
          (await page
            .locator('.rdg-row')
            .nth(1)
            .locator('.rdg-cell')
            .first()
            .textContent()) || ''
        );

        // undo the action
        await page.keyboard.press('Control+Z');

        // check if the range is pasted correctly
        await expect(fourthCellFirstRow).toHaveText('');
        await expect(
          page.locator('.rdg-row').nth(1).locator('.rdg-cell').nth(3)
        ).toHaveText('');

        // redo the action
        await page.keyboard.press('Control+Y');

        // check if the range is pasted correctly
        await expect(fourthCellFirstRow).toHaveText(
          (await firstCell.textContent()) || ''
        );

        // undo the action
        await page.keyboard.press('Control+Z');
      });
    });

    await dbEntity.delete(apiContext);
    await afterAction();
  });
});
