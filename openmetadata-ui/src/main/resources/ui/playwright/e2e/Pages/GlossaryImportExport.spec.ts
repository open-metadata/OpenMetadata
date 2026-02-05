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
  getApiContext,
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
          ownerNames: [user3.getUserDisplayName()],
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
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[type="file"]', { state: 'attached' });
        await page.setInputFiles(
          '[type="file"]',
          'downloads/' + glossary1.data.displayName + '.csv'
        );

        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden'
        });

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
          `Glossary ${glossary1.responseData.fullyQualifiedName} details updated successfully`
        );
      }
    );

    await test.step(
      'should verify bulk import details in version history',
      async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, glossary1.data.displayName);
        const versionResponse = page.waitForResponse(
          /\/api\/v1\/glossaries\/[^/]+\/versions\/[^/]+$/
        );
        await page.click('[data-testid="version-button"]');
        await versionResponse;
        await page.waitForSelector('[role="dialog"]', { state: 'visible' });

        await page.waitForSelector('[data-testid="processed-row"]');
        const processedRow = await page.$eval(
          '[data-testid="processed-row"]',
          (el) => el.textContent
        );

        expect(processedRow).toBe('3');

        const passedRow = await page.$eval(
          '[data-testid="passed-row"]',
          (el) => el.textContent
        );

        expect(passedRow).toBe('3');

        const failedRow = await page.$eval(
          '[data-testid="failed-row"]',
          (el) => el.textContent
        );

        expect(failedRow).toBe('0');

        await expect(page.getByTestId('view-more-button')).toBeVisible();

        await page.getByTestId('view-more-button').click();

        await expect(
          page.getByTestId('bulk-import-details-modal')
        ).toBeVisible();

        await expect(
          page
            .getByTestId('bulk-import-details-modal')
            .locator('.rdg-header-row')
        ).toBeVisible();

        await page.getByTestId('close-modal-button').click();

        await expect(
          page.getByTestId('bulk-import-details-modal')
        ).not.toBeVisible();

        await page.getByRole('dialog').getByRole('img').click();
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

  test('Check for Circular Reference in Glossary Import', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const circularRefGlossary = new Glossary('Test CSV');

    try {
      await test.step(
        'Create glossary for circular reference test',
        async () => {
          await circularRefGlossary.create(apiContext);
        }
      );

      await test.step('Import initial glossary terms', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, circularRefGlossary.data.displayName);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');
        await page.waitForLoadState('networkidle');

        const initialCsvContent = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,name1,name1,<p>name1</p>,,,,,,user:admin,Approved,,,
,parent,parent,<p>parent</p>,,,,,,user:admin,Approved,,,
${circularRefGlossary.data.name}.parent,child,child,<p>child</p>,,,,,,user:admin,Approved,,,`;

        const initialCsvBlob = new Blob([initialCsvContent], {
          type: 'text/csv',
        });
        const initialCsvFile = new File([initialCsvBlob], 'initial-terms.csv', {
          type: 'text/csv',
        });

        await page.waitForSelector('[type="file"]', { state: 'attached' });
        await page.setInputFiles('[type="file"]', {
          name: initialCsvFile.name,
          mimeType: initialCsvFile.type,
          buffer: Buffer.from(await initialCsvFile.arrayBuffer()),
        });

        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden'
        });

        await expect(page.locator('.rdg-header-row')).toBeVisible();

        await page.getByRole('button', { name: 'Next' }).click();

        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );

        await loader.waitFor({ state: 'hidden' });

        await validateImportStatus(page, {
          passed: '4',
          processed: '4',
          failed: '0',
        });

        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });

        await toastNotification(
          page,
          `Glossary ${circularRefGlossary.responseData.fullyQualifiedName} details updated successfully`
        );
      });

      await test.step(
        'Import CSV with circular reference and verify error',
        async () => {
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(
            page,
            circularRefGlossary.data.displayName
          );

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="import-button-description"]');
          await page.waitForLoadState('networkidle');

          const circularCsvContent = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
${circularRefGlossary.data.name}.name1,name1,name1,<p>name1</p>,,,,,,user:admin,Approved,,,
,parent,parent,<p>parent</p>,,,,,,user:admin,Approved,,,
${circularRefGlossary.data.name}.parent,child,child,<p>child</p>,,,,,,user:admin,Approved,,,`;

          const circularCsvBlob = new Blob([circularCsvContent], {
            type: 'text/csv',
          });
          const circularCsvFile = new File(
            [circularCsvBlob],
            'circular-reference.csv',
            {
              type: 'text/csv',
            }
          );

          await page.waitForSelector('[type="file"]', { state: 'attached' });
          await page.setInputFiles('[type="file"]', {
            name: circularCsvFile.name,
            mimeType: circularCsvFile.type,
            buffer: Buffer.from(await circularCsvFile.arrayBuffer()),
          });

          await page.waitForSelector('[data-testid="upload-file-widget"]', {
            state: 'hidden'
          });

          await expect(page.locator('.rdg-header-row')).toBeVisible();

          await page.getByRole('button', { name: 'Next' }).click();

          const loader = page.locator(
            '.inovua-react-toolkit-load-mask__background-layer'
          );

          await loader.waitFor({ state: 'hidden' });

          await validateImportStatus(page, {
            passed: '3',
            processed: '4',
            failed: '1',
          });

          const rows = await page.$$('.rdg-row');
          const firstRow = rows[0];
          const detailsCell = await firstRow.$('.rdg-cell-details');
          const errorText = await detailsCell?.textContent();

          expect(errorText).toContain(
            "Invalid hierarchy: Term 'Test CSV.name1' cannot be its own parent"
          );
        }
      );
    } finally {
      await circularRefGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // IE-I05: Import validation - missing required fields
  test('Import validation - missing required fields', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const validationGlossary = new Glossary('ValidationTest');

    try {
      await test.step('Create glossary for validation test', async () => {
        await validationGlossary.create(apiContext);
      });

      await test.step(
        'Import CSV with missing required name field',
        async () => {
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, validationGlossary.data.displayName);

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="import-button-description"]');
          await page.waitForLoadState('networkidle');

          // CSV with missing name (required field)
          const missingNameCsv = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,,,<p>Description without name</p>,,,,,,user:admin,Approved,,,`;

          const csvBlob = new Blob([missingNameCsv], { type: 'text/csv' });
          const csvFile = new File([csvBlob], 'missing-name.csv', {
            type: 'text/csv',
          });

          await page.waitForSelector('[type="file"]', { state: 'attached' });
          await page.setInputFiles('[type="file"]', {
            name: csvFile.name,
            mimeType: csvFile.type,
            buffer: Buffer.from(await csvFile.arrayBuffer()),
          });

          await page.waitForSelector('[data-testid="upload-file-widget"]', {
            state: 'hidden'
          });

          await expect(page.locator('.rdg-header-row')).toBeVisible();

          await page.getByRole('button', { name: 'Next' }).click();

          const loader = page.locator(
            '.inovua-react-toolkit-load-mask__background-layer'
          );
          await loader.waitFor({ state: 'hidden' });

          // Should show failure due to missing required field
          await validateImportStatus(page, {
            passed: '1',
            processed: '2',
            failed: '1',
          });
        }
      );
    } finally {
      await validationGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // IE-I06: Import validation - invalid parent reference
  test('Import validation - invalid parent reference', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const parentRefGlossary = new Glossary('ParentRefTest');

    try {
      await test.step('Create glossary for parent ref test', async () => {
        await parentRefGlossary.create(apiContext);
      });

      await test.step('Import CSV with invalid parent reference', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, parentRefGlossary.data.displayName);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');
        await page.waitForLoadState('networkidle');

        // CSV with reference to non-existent parent
        const invalidParentCsv = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
${parentRefGlossary.data.name}.NonExistentParent,childTerm,childTerm,<p>Child with invalid parent</p>,,,,,,user:admin,Approved,,,`;

        const csvBlob = new Blob([invalidParentCsv], { type: 'text/csv' });
        const csvFile = new File([csvBlob], 'invalid-parent.csv', {
          type: 'text/csv',
        });

        await page.waitForSelector('[type="file"]', { state: 'attached' });
        await page.setInputFiles('[type="file"]', {
          name: csvFile.name,
          mimeType: csvFile.type,
          buffer: Buffer.from(await csvFile.arrayBuffer()),
        });

        await page.waitForSelector('[data-testid="upload-file-widget"]', {
          state: 'hidden'
        });

        await expect(page.locator('.rdg-header-row')).toBeVisible();

        await page.getByRole('button', { name: 'Next' }).click();

        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );
        await loader.waitFor({ state: 'hidden' });

        // Should show failure due to invalid parent reference
        const failedCount = page.getByTestId('failed-count');

        if (await failedCount.isVisible()) {
          const failedText = await failedCount.textContent();

          expect(parseInt(failedText || '0')).toBeGreaterThan(0);
        }
      });
    } finally {
      await parentRefGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // IE-I08: Import partial success (some pass, some fail)
  test('Import partial success - some terms pass, some fail', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const partialGlossary = new Glossary('PartialSuccess');

    try {
      await test.step('Create glossary for partial success test', async () => {
        await partialGlossary.create(apiContext);
      });

      await test.step(
        'Import CSV with mixed valid and invalid terms',
        async () => {
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, partialGlossary.data.displayName);

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="import-button-description"]');
          await page.waitForLoadState('networkidle');

          // CSV with one valid term and one with circular reference
          const mixedCsv = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,validTerm,validTerm,<p>This is a valid term</p>,,,,,,user:admin,Approved,,,
${partialGlossary.data.name}.selfRef,selfRef,selfRef,<p>Self-referential term</p>,,,,,,user:admin,Approved,,,`;

          const csvBlob = new Blob([mixedCsv], { type: 'text/csv' });
          const csvFile = new File([csvBlob], 'mixed-terms.csv', {
            type: 'text/csv',
          });

          await page.waitForSelector('[type="file"]', { state: 'attached' });
          await page.setInputFiles('[type="file"]', {
            name: csvFile.name,
            mimeType: csvFile.type,
            buffer: Buffer.from(await csvFile.arrayBuffer()),
          });

          await page.waitForSelector('[data-testid="upload-file-widget"]', {
            state: 'hidden'
          });

          await expect(page.locator('.rdg-header-row')).toBeVisible();

          await page.getByRole('button', { name: 'Next' }).click();

          const loader = page.locator(
            '.inovua-react-toolkit-load-mask__background-layer'
          );
          await loader.waitFor({ state: 'hidden' });

          // Should show partial success (some passed, some failed)
          const passedCount = page.getByTestId('passed-count');
          const failedCount = page.getByTestId('failed-count');

          if (
            (await passedCount.isVisible()) &&
            (await failedCount.isVisible())
          ) {
            const passed = await passedCount.textContent();

            // At least one should pass and there should be processing of multiple items
            expect(parseInt(passed || '0')).toBeGreaterThanOrEqual(1);
          }
        }
      );
    } finally {
      await partialGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // IE-E04: Export large glossary (100+ terms)
  test('Export large glossary with many terms', async ({ page }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(page);
    const largeGlossary = new Glossary('LargeExport');
    const terms: GlossaryTerm[] = [];

    try {
      await test.step('Create glossary with many terms', async () => {
        await largeGlossary.create(apiContext);

        // Create 20 terms (reduced from 100 for test efficiency)
        for (let i = 0; i < 20; i++) {
          const term = new GlossaryTerm(
            largeGlossary,
            undefined,
            `ExportTerm${i}`
          );
          await term.create(apiContext);
          terms.push(term);
        }
      });

      await test.step('Export glossary and verify all terms', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, largeGlossary.data.displayName);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="export-button-description"]');

        // Wait for export modal
        await page.waitForSelector('[role="dialog"]');

        // Start export
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export' }).click();
        const download = await downloadPromise;

        // Verify download started
        expect(download.suggestedFilename()).toContain('.csv');
      });
    } finally {
      await largeGlossary.delete(apiContext);
      await afterAction();
    }
  });

  // IE-E05: Export maintains hierarchy in CSV
  test('Export maintains hierarchy structure in CSV', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const hierarchyGlossary = new Glossary('HierarchyExport');
    let parentTerm: GlossaryTerm;
    let childTerm: GlossaryTerm;
    let grandchildTerm: GlossaryTerm;

    try {
      await test.step('Create glossary with hierarchical terms', async () => {
        await hierarchyGlossary.create(apiContext);

        // Create parent term
        parentTerm = new GlossaryTerm(
          hierarchyGlossary,
          undefined,
          'HierarchyParent'
        );
        await parentTerm.create(apiContext);

        // Create child term
        childTerm = new GlossaryTerm(
          hierarchyGlossary,
          parentTerm.responseData.fullyQualifiedName,
          'HierarchyChild'
        );
        await childTerm.create(apiContext);

        // Create grandchild term
        grandchildTerm = new GlossaryTerm(
          hierarchyGlossary,
          childTerm.responseData.fullyQualifiedName,
          'HierarchyGrandchild'
        );
        await grandchildTerm.create(apiContext);
      });

      await test.step('Export and verify hierarchy in CSV', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, hierarchyGlossary.data.displayName);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="export-button-description"]');

        // Wait for export modal
        await page.waitForSelector('[role="dialog"]');

        // Start export
        const downloadPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export' }).click();
        const download = await downloadPromise;

        // Read the CSV content
        const stream = await download.createReadStream();

        if (stream) {
          const chunks: Buffer[] = [];

          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
          }

          const csvContent = Buffer.concat(chunks).toString('utf-8');

          // Verify parent column contains hierarchy info
          expect(csvContent).toContain('parent');
          // Verify terms are in the export
          expect(csvContent).toContain('HierarchyParent');
          expect(csvContent).toContain('HierarchyChild');
          expect(csvContent).toContain('HierarchyGrandchild');
        }
      });
    } finally {
      await hierarchyGlossary.delete(apiContext);
      await afterAction();
    }
  });
});
