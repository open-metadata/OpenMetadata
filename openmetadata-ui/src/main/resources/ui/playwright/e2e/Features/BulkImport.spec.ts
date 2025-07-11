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
  pressKeyXTimes,
  validateImportStatus,
} from '../../utils/importUtils';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
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
      await dbService.visitEntityPage(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
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
        await page.click('[data-testid="import-button-description"]');
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

        await page.click('[data-testid="add-row-btn"]');

        // click on last row first cell
        const rows = await page.$$('.rdg-row');
        const lastRow = rows[rows.length - 1];

        const firstCell = await lastRow.$('.rdg-cell');
        await firstCell?.click();

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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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

    await test.step(
      'should import and edit with two additional database schema',
      async () => {
        await dbEntity.visitEntityPage(page);
        await page.click('[data-testid="manage-button"] > .anticon');
        await page.click('[data-testid="import-button-description"]');
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

        await page.click('[data-testid="add-row-btn"]');

        // click on last row first cell
        const rows = await page.$$('.rdg-row');
        const lastRow = rows[rows.length - 1];

        const firstCell = await lastRow.$('.rdg-cell');
        await firstCell?.click();

        // Click on first cell and edit
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );

        await loader.waitFor({ state: 'hidden' });

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
      await dbSchemaEntity.visitEntityPage(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
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
        await page.click('[data-testid="import-button-description"]');
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

        await page.click('[data-testid="add-row-btn"]');

        // click on last row first cell
        const rows = await page.$$('.rdg-row');
        const lastRow = rows[rows.length - 1];

        const firstCell = await lastRow.$('.rdg-cell');
        await firstCell?.click();

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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
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
      await tableEntity.visitEntityPage(page);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
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
        await page.click('[data-testid="import-button-description"]');
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

        await page.click('[data-testid="add-row-btn"]');

        // click on last row first cell
        const rows = await page.$$('.rdg-row');
        const lastRow = rows[rows.length - 1];

        const firstCell = await lastRow.$('.rdg-cell');
        await firstCell?.click();

        // Click on first cell and edit
        await fillColumnDetails(columnDetails1, page);

        await page.click('[data-testid="add-row-btn"]');

        // Reverse traves to first cell to fill the details
        await page.click('.rdg-cell[aria-selected="true"]');
        await page
          .locator('.rdg-cell[aria-selected="true"]')
          .press('ArrowDown', { delay: 100 });

        await pressKeyXTimes(page, 9, 'ArrowLeft');

        await fillColumnDetails(columnDetails2, page);

        await page.getByRole('button', { name: 'Next' }).click();

        await validateImportStatus(page, {
          passed: '9',
          processed: '9',
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
});
