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
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { selectActiveGlossary } from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

const glossary = new Glossary();
const glossaryTerm1 = new GlossaryTerm(glossary);

test.describe('Bulk Import Export', () => {
  test.slow();

  test.beforeAll('setup pre-test', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.create(apiContext);
    await glossaryTerm1.create(apiContext);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await glossary.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Import and Export Glossary', async ({ page }) => {
    await test.step('Export data', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      const downloadPromise = page.waitForEvent('download');

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="export-button-description"]');
      await page.fill('#fileName', glossary.data.displayName);
      await page.click('#submit-button');
      const download = await downloadPromise;

      // Wait for the download process to complete and save the downloaded file somewhere.
      await download.saveAs('downloads/' + download.suggestedFilename());
    });

    await test.step('Import data', async () => {
      await selectActiveGlossary(page, glossary.data.displayName);
      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="import-button-description"]');
      const fileInput = await page.$('[type="file"]');
      await fileInput?.setInputFiles([
        'downloads/' + glossary.data.displayName + '.csv',
      ]);

      // Adding manual wait for the file to load
      await page.waitForTimeout(500);

      await expect(
        page.getByText('Number of rows: 2 | Passed: 2')
      ).toBeVisible();

      await expect(page.getByTestId('import-result-table')).toBeVisible();

      await expect(page.getByTestId('preview-cancel-button')).toBeVisible();

      const glossaryImport = page.waitForResponse(
        '/api/v1/glossaries/name/*/import?dryRun=false'
      );
      await page.getByTestId('import-button').click();
      await glossaryImport;

      const glossaryResponse = page.waitForResponse('/api/v1/glossaryTerms?**');
      await page.getByTestId('preview-button').click();
      await glossaryResponse;

      await expect(page.getByTestId('entity-header-display-name')).toHaveText(
        glossary.responseData.displayName
      );
    });
  });
});
