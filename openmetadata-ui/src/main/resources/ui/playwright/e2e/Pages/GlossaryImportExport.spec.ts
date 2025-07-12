/*
 *  Copyright 2024 Collate.
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
import { CUSTOM_PROPERTIES_ENTITIES } from '../../constant/customProperty';
import {
  CUSTOM_PROPERTIES_TYPES,
  FIELD_VALUES_CUSTOM_PROPERTIES,
} from '../../constant/glossaryImportExport';
import { GlobalSettingOptions } from '../../constant/settings';
import { SidebarItem } from '../../constant/sidebar';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import {
  closeFirstPopupAlert,
  createNewPage,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
} from '../../utils/customProperty';
import { addMultiOwner } from '../../utils/entity';
import {
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../utils/glossary';
import {
  createGlossaryTermRowDetails,
  fillGlossaryRowDetails,
  validateImportStatus,
} from '../../utils/importUtils';
import { settingClick, sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const user1 = new UserClass();
const user2 = new UserClass();
const user3 = new UserClass();
const glossary1 = new Glossary();
const glossary2 = new Glossary();
const glossaryTerm1 = new GlossaryTerm(glossary1);
const glossaryTerm2 = new GlossaryTerm(glossary2);
const propertiesList = Object.values(CUSTOM_PROPERTIES_TYPES);

const propertyListName: Record<string, string> = {};

const additionalGlossaryTerm = createGlossaryTermRowDetails();

test.describe('Glossary Bulk Import Export', () => {
  test.slow(true);

  test.beforeAll('setup pre-test', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user1.create(apiContext);
    await user2.create(apiContext);
    await user3.create(apiContext);
    await glossary1.create(apiContext);
    await glossary2.create(apiContext);
    await glossaryTerm1.create(apiContext);
    await glossaryTerm2.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await user3.delete(apiContext);
    await glossary1.delete(apiContext);
    await glossary2.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Glossary Bulk Import Export', async ({ page }) => {
    await test.step('create custom properties for extension edit', async () => {
      for (const property of propertiesList) {
        const entity = CUSTOM_PROPERTIES_ENTITIES.entity_glossaryTerm;
        const propertyName = `pwcustomproperty${entity.name}test${uuid()}`;
        propertyListName[property] = propertyName;

        await settingClick(page, GlobalSettingOptions.GLOSSARY_TERM, true);

        await addCustomPropertiesForEntity({
          page,
          propertyName,
          customPropertyData: entity,
          customType: property,
          tableConfig: {
            columns: FIELD_VALUES_CUSTOM_PROPERTIES.TABLE.columns,
          },
        });
      }
    });

    await test.step('should export data glossary term details', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
      await page.fill('#fileName', glossary1.data.displayName);
      await page.click('#submit-button');
      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step(
      'should import and edit with one additional glossaryTerm',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);

        // Update Reviewer
        await addMultiOwner({
          page,
          ownerNames: [user3.getUserName()],
          activatorBtnDataTestId: 'Add',
          resultTestId: 'glossary-reviewer-name',
          endpoint: EntityTypeEndpoint.Glossary,
          type: 'Users',
        });

        // Safety check to close potential glossary not found alert
        // Arrived due to parallel testing
        await closeFirstPopupAlert(page);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');
        const fileInput = page.getByTestId('upload-file-widget');
        await fileInput?.setInputFiles([
          'downloads/' + glossary1.data.displayName + '.csv',
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
        await fillGlossaryRowDetails(
          {
            ...additionalGlossaryTerm,
            owners: [user1.responseData?.['displayName']],
            reviewers: [user2.responseData?.['displayName']],
            relatedTerm: {
              parent: glossary2.data.name,
              name: glossaryTerm2.data.name,
            },
          },
          page,
          propertyListName
        );

        await page.getByRole('button', { name: 'Next' }).click();
        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );

        await loader.waitFor({ state: 'hidden' });

        await validateImportStatus(page, {
          passed: '3',
          processed: '3',
          failed: '0',
        });

        await page.waitForSelector('.rdg-header-row', {
          state: 'visible',
        });

        const rowStatus = ['Entity updated', 'Entity created'];

        await expect(page.locator('.rdg-cell-details')).toHaveText(rowStatus);

        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });

        await toastNotification(
          page,
          `Glossaryterm ${glossary1.responseData.fullyQualifiedName} details updated successfully`
        );
      }
    );

    await test.step('should have term in review state', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary1.data.displayName);
      await selectActiveGlossaryTerm(page, glossaryTerm1.data.displayName);

      const statusBadge = page.locator('.status-badge');

      await expect(statusBadge).toHaveText('Approved');
    });

    await test.step('delete custom properties', async () => {
      for (const propertyName of Object.values(propertyListName)) {
        await settingClick(page, GlobalSettingOptions.GLOSSARY_TERM, true);

        await page.waitForLoadState('networkidle');

        await page.getByTestId('loader').waitFor({ state: 'detached' });

        await deleteCreatedProperty(page, propertyName);
      }
    });
  });
});
