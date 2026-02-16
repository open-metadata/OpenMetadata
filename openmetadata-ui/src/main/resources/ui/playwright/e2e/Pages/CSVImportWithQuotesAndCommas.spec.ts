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
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import {
  uploadCSVAndWaitForGrid,
  validateImportStatus,
  waitForImportGridLoadMaskToDisappear,
} from '../../utils/importUtils';

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

const EXPECTED_PROCESSED = 4;

test.describe('CSV Import with Commas and Quotes - All Entity Types', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Create glossary with CSV, export it, create new glossary and import exported data', async ({
    page,
  }) => {
    const { apiContext } = await getApiContext(page);
    const sourceGlossary = new Glossary(`QuotesCommas-${uuid()}`);
    const targetGlossary = new Glossary(`QuotesCommas-Target-${uuid()}`);
    let exportedCsvPath: string;

    await test.step(
      'Create glossary and import CSV with quotes and commas',
      async () => {
        await sourceGlossary.create(apiContext);
        await sourceGlossary.visitPage(page);

        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="import-button-description"]');

        let tempFilePath: string | undefined;
        try {
          const { tempFilePath: tempFile } = await uploadCSVAndWaitForGrid(
            page,
            CSV_WITH_QUOTES_AND_COMMAS,
            {
              isContentString: true,
              tempFileName: `temp-quotes-commas-${uuid()}.csv`,
            }
          );
          tempFilePath = tempFile;

          await expect(
            page.getByRole('gridcell', { name: 'Term1' }).first()
          ).toBeVisible();
          await expect(
            page
              .getByRole('gridcell', { name: 'TermWithComma,AndQuote' })
              .first()
          ).toBeVisible();

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

          await waitForImportGridLoadMaskToDisappear(page);

          await validateImportStatus(page, {
            passed: String(EXPECTED_PROCESSED),
            processed: String(EXPECTED_PROCESSED),
            failed: '0',
          });

          const importResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/glossaries/name/') &&
              response.url().includes('/importAsync') &&
              response.url().includes('dryRun=false') &&
              response.request().method() === 'PUT'
          );

          await page.getByRole('button', { name: 'Update' }).click();
          await importResponse;
          await waitForImportGridLoadMaskToDisappear(page);
        } finally {
          cleanupTempFile(tempFilePath);
        }
      }
    );

    await test.step(
      'Export CSV and verify it contains properly escaped quotes',
      async () => {
        await sourceGlossary.visitPage(page);

        const downloadPromise = page.waitForEvent('download');
        await page.click('[data-testid="manage-button"]');
        await page.click('[data-testid="export-button-description"]');
        await page.fill('#fileName', sourceGlossary.data.displayName);
        await page.click('#submit-button');
        const download = await downloadPromise;

        exportedCsvPath = `downloads/exported-${uuid()}.csv`;
        await download.saveAs(exportedCsvPath);

        const csvContent = fs.readFileSync(exportedCsvPath, 'utf-8');
        expect(csvContent).toContain('Term1');
        expect(csvContent).toContain('TermWithComma,AndQuote');
        expect(csvContent).toContain('""');
        expect(csvContent).toContain('""quoted""');
        expect(csvContent).toContain('""quotes""');
      }
    );

    await test.step('Create new glossary and import exported CSV', async () => {
      await targetGlossary.create(apiContext);
      await targetGlossary.visitPage(page);

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="import-button-description"]');

      try {
        await uploadCSVAndWaitForGrid(page, exportedCsvPath);

        await expect(
          page.getByRole('gridcell', { name: 'Term1' }).first()
        ).toBeVisible();
        await expect(
          page.getByRole('gridcell', { name: 'TermWithComma,AndQuote' }).first()
        ).toBeVisible();

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

        await waitForImportGridLoadMaskToDisappear(page);

        await validateImportStatus(page, {
          passed: String(EXPECTED_PROCESSED),
          processed: String(EXPECTED_PROCESSED),
          failed: '0',
        });

        const importResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/glossaries/name/') &&
            response.url().includes('/importAsync') &&
            response.url().includes('dryRun=false') &&
            response.request().method() === 'PUT'
        );

        await page.getByRole('button', { name: 'Update' }).click();
        await importResponse;
        await waitForImportGridLoadMaskToDisappear(page);
      } finally {
        if (exportedCsvPath && fs.existsSync(exportedCsvPath)) {
          cleanupTempFile(exportedCsvPath);
        }
      }
    });
  });
});
