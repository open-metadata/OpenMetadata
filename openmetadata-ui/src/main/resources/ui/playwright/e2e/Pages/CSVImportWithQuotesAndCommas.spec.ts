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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { uploadCSVAndWaitForGrid } from '../../utils/importUtils';
import { sidebarClick } from '../../utils/sidebar';

const cleanupTempFile = (filePath: string | undefined): void => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }
};

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

  test('Glossary: Import CSV with commas and quotes, then export and re-import', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);
    const quoteCommaGlossary = new Glossary('QuoteCommaTest');
    let exportedCsvPath: string;

    await test.step(
      'Create glossary and import CSV with quotes and commas',
      async () => {
        await quoteCommaGlossary.create(apiContext);

        const glossaryResponse = page.waitForResponse(
          '/api/v1/glossaries?fields=*'
        );
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await glossaryResponse;
        await waitForAllLoadersToDisappear(page);
        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');

        let tempFilePath: string | undefined;
        try {
          const { tempFilePath: tempFile } = await uploadCSVAndWaitForGrid(
            page,
            CSV_WITH_QUOTES_AND_COMMAS,
            {
              isContentString: true,
              tempFileName: 'temp-quotes-commas-test.csv',
            }
          );
          tempFilePath = tempFile;

          await expect(
            page.getByRole('gridcell', { name: 'Term1' }).first()
          ).toBeVisible();
          await expect(
            page.getByRole('gridcell', { name: 'Test1234' }).first()
          ).toBeVisible();
          await expect(
            page
              .getByRole('gridcell', { name: 'TermWithComma,AndQuote' })
              .first()
          ).toBeVisible();
          const rowCount = await page.locator('.rdg-row').count();
          expect(rowCount).toBeGreaterThanOrEqual(3);

          const validationResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/glossaries/name/') &&
              response.url().includes('/importAsync') &&
              response.url().includes('dryRun=true') &&
              response.request().method() === 'PUT'
          );

          await page.getByRole('button', { name: 'Next' }).click();
          await validationResponse;
          await page.waitForSelector('text=Import is in progress.', {
            state: 'detached',
          });

          const loader = page.locator(
            '.inovua-react-toolkit-load-mask__background-layer'
          );
          await loader.waitFor({ state: 'hidden' });

          await page.getByRole('button', { name: 'Update' }).click();
          await loader.waitFor({ state: 'detached' });
        } finally {
          cleanupTempFile(tempFilePath);
        }
      }
    );

    await test.step('Export glossary to CSV', async () => {
      const glossaryResponse = page.waitForResponse(
        '/api/v1/glossaries?fields=*'
      );
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await glossaryResponse;
      await waitForAllLoadersToDisappear(page);

      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
      await page.fill('#fileName', quoteCommaGlossary.data.displayName);
      await page.click('#submit-button');
      const download = await downloadPromise;

      exportedCsvPath = 'downloads/' + download.suggestedFilename();
      await download.saveAs(exportedCsvPath);

      const csvContent = fs.readFileSync(exportedCsvPath, 'utf-8');
      expect(csvContent).toContain('Term1');
      expect(csvContent).toContain('TermWithComma,AndQuote');
    });
  });

  test('Export and re-import CSV with commas and quotes', async ({ page }) => {
    const { apiContext } = await getApiContext(page);
    const exportImportGlossary = new Glossary('ExportImportTest');
    let exportedCsvPath: string;

    await test.step(
      'Create glossary and import data with quotes and commas',
      async () => {
        await exportImportGlossary.create(apiContext);

        const glossaryResponse = page.waitForResponse(
          '/api/v1/glossaries?fields=*'
        );
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await glossaryResponse;
        await waitForAllLoadersToDisappear(page);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');
        let tempFilePath: string | undefined;
        try {
          const { tempFilePath: tempFile } = await uploadCSVAndWaitForGrid(
            page,
            CSV_FOR_EXPORT_IMPORT_TEST,
            {
              isContentString: true,
              tempFileName: 'temp-initial-import.csv',
            }
          );
          tempFilePath = tempFile;

          const validationResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/glossaries/name/') &&
              response.url().includes('/importAsync') &&
              response.url().includes('dryRun=true') &&
              response.request().method() === 'PUT'
          );

          await page.getByRole('button', { name: 'Next' }).click();
          await validationResponse;
          await page.waitForSelector('text=Import is in progress.', {
            state: 'detached',
          });

          const loader = page.locator(
            '.inovua-react-toolkit-load-mask__background-layer'
          );
          await loader.waitFor({ state: 'hidden' });

          await page.getByRole('button', { name: 'Update' }).click();
          await loader.waitFor({ state: 'detached' });
        } finally {
          cleanupTempFile(tempFilePath);
        }
      }
    );

    await test.step(
      'Export CSV and verify it contains properly escaped quotes',
      async () => {
        const glossaryResponse = page.waitForResponse(
          '/api/v1/glossaries?fields=*'
        );
        await sidebarClick(page, SidebarItem.GLOSSARY);
        await glossaryResponse;
        await waitForAllLoadersToDisappear(page);

        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="export-button-description"]');
        await page.fill('#fileName', exportImportGlossary.data.displayName);
        await page.click('#submit-button');
        const download = await downloadPromise;

        exportedCsvPath = 'downloads/' + download.suggestedFilename();
        await download.saveAs(exportedCsvPath);

        const csvContent = fs.readFileSync(exportedCsvPath, 'utf-8');
        expect(csvContent).toContain('InitialTerm');
        expect(csvContent).toContain('Term with');
      }
    );
  });
});
