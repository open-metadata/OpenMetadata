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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import {
  createNewPage,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import {
  openClassificationTagPicker,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

const table = new TableClass();

test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await table.delete(apiContext);
  await afterAction();
});

test(
  'Should show error toast when adding mutually exclusive tags to column',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  async ({ page }) => {
    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    await waitForAllLoadersToDisappear(page);

    const firstColumnName = table.columnsName[0];
    const columnRowSelector = `[data-row-key$="${firstColumnName}"]`;

    // Add PII.Sensitive tag to the first column
    await page.waitForLoadState('domcontentloaded');
    const addTagTrigger = page.locator(
      `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="add-tag"]`
    );
    await openClassificationTagPicker(page, addTagTrigger);

    const tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?q=*Sensitive*'
    );
    await page
      .getByTestId('classification-tag-picker-search')
      .fill('Sensitive');
    await tagSearchResponse;

    await page.getByTestId('tree-node-PII.Sensitive').click();

    const saveTagResponse = page.waitForResponse('/api/v1/columns/name/**');
    await page.getByTestId('update-btn').waitFor({ state: 'visible' });
    await expect(page.getByTestId('update-btn')).toBeEnabled();
    await page.getByTestId('update-btn').click();
    await saveTagResponse;

    await expect(page.getByTestId('update-btn')).not.toBeVisible();

    // Verify the tag was added successfully
    await expect(
      page.locator(
        `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"]`
      )
    ).toContainText('Sensitive');

    // Now try to add a mutually exclusive tag (PII.NonSensitive) to the same column
    const editTagTrigger = page.locator(
      `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"] [data-testid="edit-button"]`
    );
    await openClassificationTagPicker(page, editTagTrigger);

    const tagSearchResponse2 = page.waitForResponse(
      '/api/v1/search/query?q=*NonSensitive*'
    );
    await page
      .getByTestId('classification-tag-picker-search')
      .fill('NonSensitive');
    await tagSearchResponse2;

    await page.getByTestId('tree-node-PII.NonSensitive').click();

    // Wait for the API call which should return an error
    const errorResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/columns/name/') &&
        response.status() >= 400
    );
    await page.getByTestId('update-btn').waitFor({ state: 'visible' });
    await expect(page.getByTestId('update-btn')).toBeEnabled();
    await page.getByTestId('update-btn').click();
    await errorResponse;

    await toastNotification(page, /mutually exclusive/i);

    // Verify that the picker closes after error
    await expect(page.getByTestId('update-btn')).not.toBeVisible();

    // Verify that the original tag is still present
    await expect(
      page.locator(
        `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"]`
      )
    ).toContainText('Sensitive');

    // Verify that the mutually exclusive tag was NOT added
    await expect(
      page.locator(
        `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"]`
      )
    ).not.toContainText('NonSensitive');
  }
);
