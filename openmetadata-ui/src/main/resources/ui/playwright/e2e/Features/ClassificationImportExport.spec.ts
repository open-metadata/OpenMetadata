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
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import {
  startCsvPreviewAndWaitForGrid,
  suppressCsvJobsTray,
  validateImportStatus,
} from '../../utils/importUtils';
import { performUserLogin } from '../../utils/user';

const CLASSIFICATION_CSV_HEADER =
  'parent,name*,displayName,description,reviewers,owner,tagStatus,color,iconURL,domains,mutuallyExclusive';

test.use({ storageState: 'playwright/.auth/admin.json' });

const userClassification = new ClassificationClass();
const systemClassification = new ClassificationClass({ provider: 'system' });
const userTag = new TagClass({ classification: userClassification.data.name });
const exportUser = new UserClass(undefined, true);

test.describe('Classification Import Export', { tag: '@import-export' }, () => {
  test.beforeAll('Setup classifications and a tag', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await userClassification.create(apiContext);
    await systemClassification.create(apiContext);
    await userTag.create(apiContext);
    await exportUser.create(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('user classification manage button offers import and export', async ({
    page,
  }) => {
    await userClassification.visitPage(page);

    await page.getByTestId('manage-button').click();

    await expect(page.getByTestId('import-button')).toBeVisible();
    await expect(page.getByTestId('export-button')).toBeVisible();
  });

  test('system classification hides import and export', async ({ page }) => {
    await systemClassification.visitPage(page);

    await page.getByTestId('manage-button').click();

    await expect(page.getByTestId('edit-classification')).toBeVisible();

    await expect(page.getByTestId('import-button')).toHaveCount(0);
    await expect(page.getByTestId('export-button')).toHaveCount(0);
  });

  test('export starts a CSV export job for the classification', async ({
    browser,
  }) => {
    test.slow();

    // Log in as the dedicated export user so the CSV export job stays scoped
    // to that identity and does not pollute the shared admin jobs tray.
    const { page, afterAction } = await performUserLogin(browser, exportUser);

    try {
      await suppressCsvJobsTray(page);
      await redirectToHomePage(page);
      await userClassification.visitPage(page);

      await page.getByTestId('manage-button').click();

      const exportButton = page.getByTestId('export-button');
      await expect(exportButton).toBeVisible();

      const exportResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/classifications/name/') &&
          response.url().includes('/exportAsync') &&
          response.request().method() === 'GET'
      );

      await exportButton.click();

      const response = await exportResponse;
      expect(response.ok()).toBeTruthy();
    } finally {
      await afterAction();
    }
  });

  test('import navigates to the classification bulk import page', async ({
    page,
  }) => {
    test.slow();

    await userClassification.visitPage(page);

    await page.getByTestId('manage-button').click();

    const importButton = page.getByTestId('import-button');
    await expect(importButton).toBeVisible();
    await importButton.click();

    await page.waitForURL('**/bulk/import/classification/**');

    await expect(
      page.getByText('Drag & Drop or Browse CSV file here')
    ).toBeVisible();
  });

  test('renaming a tag row on import creates a new tag and keeps the original', async ({
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await getApiContext(page);
    const originalTag = new TagClass({
      classification: userClassification.data.name,
      name: `alpha-${uuid()}`,
    });
    const renamedTagName = `beta-${uuid()}`;

    try {
      await originalTag.create(apiContext);
      const csv = [
        CLASSIFICATION_CSV_HEADER,
        `,${renamedTagName},Renamed,renamed via import,,,,,,,`,
      ].join('\n');

      await suppressCsvJobsTray(page);
      await userClassification.visitPage(page);

      await page.getByTestId('manage-button').click();
      await page.getByTestId('import-button').click();
      await page.waitForURL('**/bulk/import/classification/**');

      await page.locator('[type="file"]').waitFor({ state: 'attached' });
      await page.setInputFiles('[type="file"]', {
        name: 'classification.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv),
      });

      await startCsvPreviewAndWaitForGrid(page);

      await page.getByRole('button', { name: 'Next' }).click();
      await validateImportStatus(page, {
        passed: '1',
        processed: '1',
        failed: '0',
      });

      await page.getByRole('button', { name: 'Update' }).click();
      await page.waitForURL('**/tags/**');

      await userClassification.visitPage(page);
      await expect(page.getByTestId(originalTag.data.name)).toBeVisible();
      await expect(page.getByTestId(renamedTagName)).toBeVisible();
    } finally {
      await originalTag.delete(apiContext);
      await afterAction();
    }
  });
});
