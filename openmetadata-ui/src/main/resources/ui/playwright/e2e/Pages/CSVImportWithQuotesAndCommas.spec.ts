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
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { selectActiveGlossary } from '../../utils/glossary';
import { validateImportStatus } from '../../utils/importUtils';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const CSV_WITH_QUOTES_AND_COMMAS = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,"Term1",TermAnuj,"<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,
,"Test1234","Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.","<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,
,"TermWithComma,AndQuote","Display name with ""quoted"" text, and comma","<p>Description with ""quotes"" and, commas</p>",,,,,,user:admin,Approved,,,`;

const CSV_FOR_EXPORT_IMPORT_TEST = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,extension
,"InitialTerm","Term with ""quotes"" and, comma","<p>Description with ""quotes"" and, commas</p>",,,,,,user:admin,Approved,,,`;

test.describe('CSV Import with Commas and Quotes - All Entity Types', () => {

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Glossary: Import CSV with commas and quotes in fields', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);
    const quoteCommaGlossary = new Glossary('QuoteCommaTest');

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

        const csvBlob = new Blob([CSV_WITH_QUOTES_AND_COMMAS], {
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
          page.getByRole('gridcell', { name: 'Term1' }).first()
        ).toBeVisible();
        await expect(
          page.getByRole('gridcell', { name: 'Test1234' }).first()
        ).toBeVisible();
        await expect(
          page.getByRole('gridcell', { name: 'TermWithComma,AndQuote' })
            .first()
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
  });
  test('Export and re-import CSV with commas and quotes', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);
    const exportImportGlossary = new Glossary('ExportImportTest');

    await test.step('Create glossary and import data with quotes and commas', async () => {
      await exportImportGlossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, exportImportGlossary.data.displayName);

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="import-button-description"]');
      await page.waitForLoadState('networkidle');

      const csvBlob = new Blob([CSV_FOR_EXPORT_IMPORT_TEST], {
        type: 'text/csv',
      });
      const csvFile = new File([csvBlob], 'initial.csv', {
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

      await page.getByRole('button', { name: 'Update' }).click();
      await loader.waitFor({ state: 'detached' });
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

      const filePath = 'downloads/' + download.suggestedFilename();
      await download.saveAs(filePath);

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent
        .split('\n')
        .filter((line) => line.trim().length > 0);

      expect(csvContent).toContain('InitialTerm');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(csvContent).toContain('Term with');
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
  });
});
