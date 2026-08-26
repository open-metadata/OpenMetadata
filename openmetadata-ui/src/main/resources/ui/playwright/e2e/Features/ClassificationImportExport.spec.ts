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
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { suppressCsvJobsTray } from '../../utils/importUtils';
import { performUserLogin } from '../../utils/user';

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
});
