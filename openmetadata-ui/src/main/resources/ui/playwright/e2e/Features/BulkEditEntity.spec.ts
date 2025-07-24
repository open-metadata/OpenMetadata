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
import { SERVICE_TYPE } from '../../constant/service';
import { GlobalSettingOptions } from '../../constant/settings';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  createNewPage,
  descriptionBoxReadOnly,
  getApiContext,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { selectActiveGlossaryTerm } from '../../utils/glossary';
import {
  createColumnRowDetails,
  createCustomPropertiesForEntity,
  createDatabaseRowDetails,
  createDatabaseSchemaRowDetails,
  createGlossaryTermRowDetails,
  createTableRowDetails,
  fillDescriptionDetails,
  fillGlossaryRowDetails,
  fillGlossaryTermDetails,
  fillRowDetails,
  fillTagDetails,
  pressKeyXTimes,
  validateImportStatus,
} from '../../utils/importUtils';
import { visitServiceDetailsPage } from '../../utils/service';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const glossaryDetails = {
  name: EntityDataClass.glossaryTerm1.data.name,
  parent: EntityDataClass.glossary1.data.name,
};

const databaseSchemaDetails1 = {
  ...createDatabaseSchemaRowDetails(),
  glossary: glossaryDetails,
};

const tableDetails1 = {
  ...createTableRowDetails(),
  glossary: glossaryDetails,
};

const columnDetails1 = {
  ...createColumnRowDetails(),
  glossary: glossaryDetails,
};

test.describe('Bulk Edit Entity', () => {
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
    test.slow(true);

    const table = new TableClass();
    let customPropertyRecord: Record<string, string> = {};

    const { apiContext, afterAction } = await getApiContext(page);
    await table.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.DATABASES
      );
    });

    await test.step('Perform bulk edit action', async () => {
      const databaseDetails = {
        ...createDatabaseRowDetails(),
        domains: EntityDataClass.domain1.responseData,
        glossary: glossaryDetails,
      };

      await visitServiceDetailsPage(
        page,
        {
          name: table.service.name,
          type: SERVICE_TYPE.Database,
        },
        false
      );
      await page.click('[data-testid="bulk-edit-table"]');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).not.toBeVisible();

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      // Click on first cell and edit

      await page.click('.rdg-cell[role="gridcell"]');
      await fillRowDetails(
        {
          ...databaseDetails,
          name: table.database.name,
          owners: [
            EntityDataClass.user1.responseData?.['displayName'],
            EntityDataClass.user2.responseData?.['displayName'],
          ],
          retentionPeriod: undefined,
          sourceUrl: undefined,
        },
        page,
        customPropertyRecord
      );

      await page.getByRole('button', { name: 'Next' }).click();

      await validateImportStatus(page, {
        passed: '2',
        processed: '2',
        failed: '0',
      });

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/services/databaseServices/name/*/importAsync?*dryRun=false&recursive=false*`
      );

      await page.getByRole('button', { name: 'Update' }).click();

      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });
      await updateButtonResponse;
      await page.waitForEvent('framenavigated');
      await toastNotification(page, /details updated successfully/);

      await page.click('[data-testid="databases"]');

      await page.waitForLoadState('networkidle');

      // Verify Details updated
      await expect(page.getByTestId('column-name')).toHaveText(
        `${table.database.name}${databaseDetails.displayName}`
      );

      await expect(
        page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
      ).toContainText('Playwright Database description.');

      // Verify Owners
      await expect(
        page.getByTestId(EntityDataClass.user1.responseData?.['displayName'])
      ).toBeVisible();
      await expect(
        page.getByTestId(EntityDataClass.user2.responseData?.['displayName'])
      ).toBeVisible();

      // Verify Tags
      await expect(
        page.getByRole('link', {
          name: 'Sensitive',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'Tier1',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: EntityDataClass.glossaryTerm1.data.displayName,
        })
      ).toBeVisible();
    });

    await table.delete(apiContext);
    await afterAction();
  });

  test('Database', async ({ page }) => {
    test.slow(true);

    let customPropertyRecord: Record<string, string> = {};

    const table = new TableClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await table.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.DATABASE_SCHEMA
      );
    });

    await test.step('Perform bulk edit action', async () => {
      // visit entity Page
      await visitServiceDetailsPage(
        page,
        {
          name: table.service.name,
          type: SERVICE_TYPE.Database,
        },
        false
      );

      const databaseResponse = page.waitForResponse(
        `/api/v1/databases/name/*${table.database.name}?**`
      );
      await page.getByTestId(table.database.name).click();
      await databaseResponse;

      await page.click('[data-testid="bulk-edit-table"]');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).not.toBeVisible();

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      // click on last row first cell
      await page.click('.rdg-cell[role="gridcell"]');

      // Click on first cell and edit
      await fillRowDetails(
        {
          ...databaseSchemaDetails1,
          name: table.schema.name,
          owners: [
            EntityDataClass.user1.responseData?.['displayName'],
            EntityDataClass.user2.responseData?.['displayName'],
          ],
          domains: EntityDataClass.domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await page.getByRole('button', { name: 'Next' }).click();
      const loader = page.locator(
        '.inovua-react-toolkit-load-mask__background-layer'
      );

      await loader.waitFor({ state: 'hidden' });

      await validateImportStatus(page, {
        passed: '2',
        processed: '2',
        failed: '0',
      });

      await page.waitForSelector('.rdg-header-row', {
        state: 'visible',
      });
      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=false*`
      );
      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });
      await updateButtonResponse;
      await page.waitForEvent('framenavigated');
      await toastNotification(page, /details updated successfully/);

      // Verify Details updated
      await expect(page.getByTestId('column-name')).toHaveText(
        `${table.schema.name}${databaseSchemaDetails1.displayName}`
      );

      await expect(
        page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
      ).toContainText('Playwright Database Schema description.');

      // Verify Owners
      await expect(
        page.getByTestId(EntityDataClass.user1.responseData?.['displayName'])
      ).toBeVisible();

      await expect(
        page.getByTestId(EntityDataClass.user2.responseData?.['displayName'])
      ).toBeVisible();

      await page.getByTestId('column-display-name').click();

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('loader', { state: 'hidden' });

      // Verify Tags
      await expect(
        page.getByRole('link', {
          name: 'Sensitive',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'Tier1',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: EntityDataClass.glossaryTerm1.data.displayName,
        })
      ).toBeVisible();
    });

    await table.delete(apiContext);
    await afterAction();
  });

  test('Database Schema', async ({ page }) => {
    test.slow(true);

    let customPropertyRecord: Record<string, string> = {};
    const table = new TableClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await table.create(apiContext);

    await test.step('create custom properties for extension edit', async () => {
      customPropertyRecord = await createCustomPropertiesForEntity(
        page,
        GlobalSettingOptions.TABLES
      );
    });

    await test.step('Perform bulk edit action', async () => {
      // visit entity page
      await visitServiceDetailsPage(
        page,
        {
          name: table.service.name,
          type: SERVICE_TYPE.Database,
        },
        false
      );

      const databaseResponse = page.waitForResponse(
        `/api/v1/databases/name/*${table.database.name}?**`
      );
      await page.getByTestId(table.database.name).click();
      await databaseResponse;
      const databaseSchemaResponse = page.waitForResponse(
        `/api/v1/databaseSchemas/name/*${table.schema.name}?*`
      );
      await page.getByTestId(table.schema.name).click();
      await databaseSchemaResponse;

      await page.click('[data-testid="bulk-edit-table"]');

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).not.toBeVisible();

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      // Click on first cell and edit
      await page.click('.rdg-cell[role="gridcell"]');
      await fillRowDetails(
        {
          ...tableDetails1,
          name: table.entity.name,
          owners: [
            EntityDataClass.user1.responseData?.['displayName'],
            EntityDataClass.user2.responseData?.['displayName'],
          ],
          domains: EntityDataClass.domain1.responseData,
        },
        page,
        customPropertyRecord
      );

      await page.getByRole('button', { name: 'Next' }).click();

      await validateImportStatus(page, {
        passed: '2',
        processed: '2',
        failed: '0',
      });
      const updateButtonResponse = page.waitForResponse(
        `/api/v1/databaseSchemas/name/*/importAsync?*dryRun=false&recursive=false*`
      );
      await page.getByRole('button', { name: 'Update' }).click();

      await updateButtonResponse;
      await page.waitForEvent('framenavigated');
      await toastNotification(page, /details updated successfully/);

      // Verify Details updated
      await expect(page.getByTestId('column-name')).toHaveText(
        `${table.entity.name}${tableDetails1.displayName}`
      );

      await expect(
        page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
      ).toContainText('Playwright Table description');

      // Go to Table Page
      await page
        .getByTestId('column-display-name')
        .getByTestId(table.entity.name)
        .click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('loader', { state: 'hidden' });

      // Verify Domain
      await expect(page.getByTestId('domain-link')).toContainText(
        EntityDataClass.domain1.responseData.displayName
      );

      // Verify Owners
      await expect(
        page.getByTestId(EntityDataClass.user1.responseData?.['displayName'])
      ).toBeVisible();

      await expect(
        page.getByTestId(EntityDataClass.user2.responseData?.['displayName'])
      ).toBeVisible();

      // Verify Tags
      await expect(
        page.getByRole('link', {
          name: 'Sensitive',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: 'Tier1',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: EntityDataClass.glossaryTerm1.data.displayName,
        })
      ).toBeVisible();
    });

    await table.delete(apiContext);
    await afterAction();
  });

  test('Table', async ({ page }) => {
    test.slow(true);

    const tableEntity = new TableClass();

    const { apiContext, afterAction } = await getApiContext(page);
    await tableEntity.create(apiContext);

    await test.step('Perform bulk edit action', async () => {
      await tableEntity.visitEntityPageWithCustomSearchBox(page);

      await page.click('[data-testid="bulk-edit-table"]');

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).not.toBeVisible();

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      // click on row first cell
      await page.click('.rdg-cell[role="gridcell"]');

      await page.click(RDG_ACTIVE_CELL_SELECTOR);

      await pressKeyXTimes(page, 2, 'ArrowRight');

      await fillDescriptionDetails(page, columnDetails1.description);

      await pressKeyXTimes(page, 5, 'ArrowRight');

      await fillTagDetails(page, columnDetails1.tag);

      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowRight', { delay: 100 });
      await fillGlossaryTermDetails(page, columnDetails1.glossary);

      // Reverse traves to first cell to fill the details
      await page.click(RDG_ACTIVE_CELL_SELECTOR);
      await page
        .locator(RDG_ACTIVE_CELL_SELECTOR)
        .press('ArrowDown', { delay: 100 });

      await page.click('[type="button"] >> text="Next"', { force: true });

      await validateImportStatus(page, {
        passed: '9',
        processed: '9',
        failed: '0',
      });

      const updateButtonResponse = page.waitForResponse(
        `/api/v1/tables/name/*/importAsync?*dryRun=false&recursive=false*`
      );
      await page.click('[type="button"] >> text="Update"', { force: true });
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await updateButtonResponse;
      await page.waitForSelector('.message-banner-wrapper', {
        state: 'detached',
      });
      await toastNotification(page, /details updated successfully/);

      // Verify Details updated
      await expect(
        page.getByRole('cell', { name: 'Playwright Table column' })
      ).toBeVisible();

      // Verify Tags
      await expect(
        page.getByRole('link', {
          name: 'Sensitive',
        })
      ).toBeVisible();

      await expect(
        page.getByRole('link', {
          name: EntityDataClass.glossaryTerm1.data.displayName,
        })
      ).toBeVisible();
    });

    await tableEntity.delete(apiContext);
    await afterAction();
  });

  test('Glossary', async ({ page }) => {
    test.slow();

    const additionalGlossaryTerm = createGlossaryTermRowDetails();
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    const { apiContext, afterAction } = await getApiContext(page);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);

    await test.step('Perform bulk edit action', async () => {
      await glossary.visitEntityPage(page);

      await page.click('[data-testid="bulk-edit-table"]');

      // Adding some assertion to make sure that CSV loaded correctly
      await expect(page.locator('.rdg-header-row')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Previous' })
      ).not.toBeVisible();

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      // Click on first cell and edit
      await page.click('.rdg-cell[role="gridcell"]');

      // Click on first cell and edit
      await fillGlossaryRowDetails(
        {
          ...additionalGlossaryTerm,
          name: glossaryTerm.data.name,
          owners: [EntityDataClass.user1.responseData?.['displayName']],
          reviewers: [EntityDataClass.user2.responseData?.['displayName']],
          relatedTerm: {
            parent: glossary.data.name,
            name: glossaryTerm.data.name,
          },
        },
        page
      );

      await page.getByRole('button', { name: 'Next' }).click();
      const loader = page.locator(
        '.inovua-react-toolkit-load-mask__background-layer'
      );

      await loader.waitFor({ state: 'hidden' });

      await validateImportStatus(page, {
        passed: '2',
        processed: '2',
        failed: '0',
      });

      await page.waitForSelector('.rdg-header-row', {
        state: 'visible',
      });

      const rowStatus = ['Entity updated'];

      await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

      await page.getByRole('button', { name: 'Update' }).click();
      await page
        .locator('.inovua-react-toolkit-load-mask__background-layer')
        .waitFor({ state: 'detached' });

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await toastNotification(
        page,
        `Glossaryterm ${glossary.responseData.fullyQualifiedName} details updated successfully`
      );

      await selectActiveGlossaryTerm(page, additionalGlossaryTerm.displayName);

      // Verify Description
      await expect(page.getByText('Playwright GlossaryTerm')).toBeVisible();

      // Verify Synonyms
      await expect(
        page.getByTestId('playwright,glossaryTerm,testing')
      ).toBeVisible();

      // Verify References
      await expect(page.getByTestId('reference-link-data')).toBeVisible();

      // Verify Tags
      await expect(page.getByTestId('tag-PII.Sensitive')).toBeVisible();

      // Verify Owners
      await expect(
        page.getByTestId(EntityDataClass.user1.responseData?.['displayName'])
      ).toBeVisible();

      // Verify Reviewers
      await expect(
        page.getByTestId(EntityDataClass.user2.responseData?.['displayName'])
      ).toBeVisible();
    });

    await glossary.delete(apiContext);
    await afterAction();
  });
});
