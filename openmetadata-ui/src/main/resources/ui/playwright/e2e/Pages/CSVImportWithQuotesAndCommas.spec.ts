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
import * as fs from 'fs';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import {
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import { selectActiveGlossary } from '../../utils/glossary';
import { validateImportStatus } from '../../utils/importUtils';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('CSV Import with Commas and Quotes - All Entity Types', () => {
  test.slow(true);

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Glossary: Import CSV with commas and quotes in fields', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const quoteCommaGlossary = new Glossary('QuoteCommaTest');

    try {
      await test.step('Create glossary for quote and comma test', async () => {
        await quoteCommaGlossary.create(apiContext);
      });

      await test.step(
        'Import CSV with fields containing both commas and quotes',
        async () => {
          await sidebarClick(page, SidebarItem.GLOSSARY);
          await selectActiveGlossary(page, quoteCommaGlossary.data.displayName);

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="import-button-description"]');
          await page.waitForLoadState('networkidle');

          // CSV with displayName and description containing both commas and quotes
          // This is the exact scenario that was failing before the fix
          // The quotes inside quoted fields must be escaped by doubling them (""login"")
          const csvWithQuotesAndCommas = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,"Term1",TermAnuj,"<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,
,"Test1234","Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.","<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,
,"TermWithComma,AndQuote","Display name with ""quoted"" text, and comma","<p>Description with ""quotes"" and, commas</p>",,,,,,user:admin,Approved,,,`;

          const csvBlob = new Blob([csvWithQuotesAndCommas], {
            type: 'text/csv',
          });
          const csvFile = new File([csvBlob], 'quotes-commas-test.csv', {
            type: 'text/csv',
          });

          const fileInput = page.getByTestId('upload-file-widget');
          await fileInput?.setInputFiles([
            {
              name: csvFile.name,
              mimeType: csvFile.type,
              buffer: Buffer.from(await csvFile.arrayBuffer()),
            },
          ]);

          await page.waitForTimeout(500);
          await expect(page.locator('.rdg-header-row')).toBeVisible();
          await expect(page.getByTestId('add-row-btn')).toBeVisible();
          const rows = await page.$$('.rdg-row');
          expect(rows.length).toBeGreaterThanOrEqual(3); 
          await expect(
            page.getByText('Contains a timestamp for the most recent "login"', {
              exact: false,
            })
          ).toBeVisible();

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

          const rowStatus = await page.$$('.rdg-cell-details');
          expect(rowStatus.length).toBeGreaterThan(0);

          for (const statusCell of rowStatus) {
            const statusText = await statusCell.textContent();
            expect(statusText).toMatch(/success|Entity created|Entity updated/i);
            expect(statusText).not.toContain('failure');
            expect(statusText).not.toContain('error');
          }
        }
      );
    } finally {
      await quoteCommaGlossary.delete(apiContext);
      await afterAction();
    }
  });
  test('Export and re-import CSV with commas and quotes', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const exportImportGlossary = new Glossary('ExportImportTest');
    const glossaryTerm = new GlossaryTerm(exportImportGlossary);

    try {
      await test.step('Create glossary and term with quotes and commas', async () => {
        await exportImportGlossary.create(apiContext);
        await glossaryTerm.create(apiContext);
      });

      await test.step('Export CSV and verify it contains properly escaped quotes', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, exportImportGlossary.data.displayName);

        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="export-button-description"]');
        await page.fill('#fileName', exportImportGlossary.data.displayName);
        await page.click('#submit-button');
        const download = await downloadPromise;

        // Save the exported CSV
        const filePath = 'downloads/' + download.suggestedFilename();
        await download.saveAs(filePath);

        // Read the CSV content
        const csvContent = fs.readFileSync(filePath, 'utf-8');

        // Verify the CSV contains properly escaped quotes
        // Quotes inside quoted fields should be doubled
        expect(csvContent).toContain('""');
        // Verify the CSV is valid and can be parsed
        expect(csvContent.split('\n').length).toBeGreaterThan(1);
      });

      await test.step('Re-import the exported CSV', async () => {
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await selectActiveGlossary(page, exportImportGlossary.data.displayName);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');
        await page.waitForLoadState('networkidle');

        const fileInput = page.getByTestId('upload-file-widget');
        await fileInput?.setInputFiles([
          'downloads/' + exportImportGlossary.data.displayName + '.csv',
        ]);

        await page.waitForTimeout(500);
        await expect(page.locator('.rdg-header-row')).toBeVisible();
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
      });
    } finally {
      await exportImportGlossary.delete(apiContext);
      await afterAction();
    }
  });
});
