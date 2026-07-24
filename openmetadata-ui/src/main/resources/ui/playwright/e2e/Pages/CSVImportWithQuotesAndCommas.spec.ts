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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import { Glossary } from '../../support/glossary/Glossary';
import {
  fetchCompletedCsvAsyncJobResult,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  uploadCSVAndWaitForGrid,
  validateImportStatus,
  waitForImportGridLoadMaskToDisappear,
} from '../../utils/importUtils';
import { setupCsvImportListener } from '../../utils/websocket';

const cleanupTempFile = (filePath: string | undefined): void => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }
};

const selectGlossaryManageItem = async (page: Page, itemTestId: string) => {
  await page.getByTestId('manage-button').click();

  const manageDropdown = page
    .locator('.glossary-manage-dropdown-list-container')
    .last();

  await expect(manageDropdown).toBeVisible();
  await manageDropdown.getByTestId(itemTestId).click();
};

type GlossaryTermsResponse = {
  data?: Array<{
    name?: string;
  }>;
};

type CsvExportResponse = {
  jobId: string;
};

const waitForGlossaryTerms = async (
  apiContext: APIRequestContext,
  glossaryId: string,
  termNames: string[]
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/glossaryTerms?glossary=${glossaryId}&limit=100`
        );

        if (!response.ok()) {
          return [];
        }

        const data = (await response.json()) as GlossaryTermsResponse;

        return data.data?.map((term) => term.name ?? '') ?? [];
      },
      { timeout: 60000 }
    )
    .toEqual(expect.arrayContaining(termNames));
};

test.use({
  storageState: 'playwright/.auth/admin.json',
});

const CSV_WITH_QUOTES_AND_COMMAS = `parent,name*,displayName,description,synonyms,relatedTerms,references,tags,reviewers,owner,glossaryStatus,color,iconURL,domains,extension
,"Term1",TermAnuj,"<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,,
,"Test1234","Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.","<p>Contains a timestamp for the most recent ""login"" of this feature user, to be used for PIN expiration.</p>",,,,,,user:admin,Approved,,,,
,"TermWithComma,AndQuote","Display name with ""quoted"" text, and comma","<p>Description with ""quotes"" and, commas</p>",,,,,,user:admin,Approved,,,,`;

test.describe('CSV Import with Commas and Quotes - All Entity Types', () => {
  let createCsvImportPromise: () => Promise<void>;

  test.beforeEach(async ({ page }) => {
    createCsvImportPromise = await setupCsvImportListener(page);
    await redirectToHomePage(page);
  });

  test('Create glossary with CSV, export it, create new glossary and import exported data', async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const { apiContext } = await getApiContext(page);
    const sourceGlossary = new Glossary(`QuotesCommas-${uuid()}`);
    const targetGlossary = new Glossary(`QuotesCommas-Target-${uuid()}`);
    let exportedCsvPath: string;

    await test.step('Create glossary and import CSV with quotes and commas', async () => {
      await sourceGlossary.create(apiContext);
      await sourceGlossary.visitPage(page);

      await selectGlossaryManageItem(page, 'import-button');

      let tempFilePath: string | undefined;
      try {
        const { tempFilePath: tempFile } = await uploadCSVAndWaitForGrid(
          page,
          CSV_WITH_QUOTES_AND_COMMAS,
          {
            isContentString: true,
            tempFileName: `temp-quotes-commas-${uuid()}.csv`,
            csvImportCompletedPromise: createCsvImportPromise(),
          }
        );
        tempFilePath = tempFile;

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
        await page.getByText('Import is in progress.').waitFor({
          state: 'detached',
        });

        await waitForImportGridLoadMaskToDisappear(page);

        const expectedProcessed = await page
          .getByTestId('processed-row')
          .textContent();
        await validateImportStatus(page, {
          passed: expectedProcessed?.trim() ?? '0',
          processed: expectedProcessed?.trim() ?? '0',
          failed: '0',
        });

        const importResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/glossaries/name/') &&
            response.url().includes('/importAsync') &&
            response.url().includes('dryRun=false') &&
            response.request().method() === 'PUT'
        );
        const importCompletedPromise = createCsvImportPromise();

        await page.getByRole('button', { name: 'Update' }).click();
        await importResponse;
        await importCompletedPromise;
        await waitForImportGridLoadMaskToDisappear(page);
        await waitForGlossaryTerms(apiContext, sourceGlossary.responseData.id, [
          'Term1',
          'TermWithComma,AndQuote',
        ]);
      } finally {
        cleanupTempFile(tempFilePath);
      }
    });

    await test.step('Export CSV and verify it contains properly escaped quotes', async () => {
      await sourceGlossary.visitPage(page);

      const exportResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaries/name/') &&
          response.url().includes('/exportAsync') &&
          response.request().method() === 'GET'
      );

      await selectGlossaryManageItem(page, 'export-button');

      const exportResponse = await exportResponsePromise;
      expect(exportResponse.ok()).toBeTruthy();

      const { jobId } = (await exportResponse.json()) as CsvExportResponse;
      const csvContent = await fetchCompletedCsvAsyncJobResult(
        apiContext,
        jobId
      );

      exportedCsvPath = `downloads/exported-${uuid()}.csv`;
      fs.mkdirSync('downloads', { recursive: true });
      fs.writeFileSync(exportedCsvPath, csvContent);

      expect(csvContent).toContain('Term1');
      expect(csvContent).toContain('TermWithComma,AndQuote');
      expect(csvContent).toContain('""');
      expect(csvContent).toContain('""quoted""');
      expect(csvContent).toContain('""quotes""');
    });

    await test.step('Create new glossary and import exported CSV', async () => {
      await targetGlossary.create(apiContext);
      await targetGlossary.visitPage(page);

      await selectGlossaryManageItem(page, 'import-button');

      try {
        await uploadCSVAndWaitForGrid(page, exportedCsvPath, {
          csvImportCompletedPromise: createCsvImportPromise(),
        });

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
        await page.getByText('Import is in progress.').waitFor({
          state: 'detached',
        });

        await waitForImportGridLoadMaskToDisappear(page);

        const expectedProcessed = await page
          .getByTestId('processed-row')
          .textContent();
        await validateImportStatus(page, {
          passed: expectedProcessed?.trim() ?? '0',
          processed: expectedProcessed?.trim() ?? '0',
          failed: '0',
        });

        const importResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/glossaries/name/') &&
            response.url().includes('/importAsync') &&
            response.url().includes('dryRun=false') &&
            response.request().method() === 'PUT'
        );
        const importCompletedPromise = createCsvImportPromise();

        await page.getByRole('button', { name: 'Update' }).click();
        await importResponse;
        await importCompletedPromise;
        await waitForImportGridLoadMaskToDisappear(page);
      } finally {
        if (exportedCsvPath && fs.existsSync(exportedCsvPath)) {
          cleanupTempFile(exportedCsvPath);
        }
      }
    });
  });
});
