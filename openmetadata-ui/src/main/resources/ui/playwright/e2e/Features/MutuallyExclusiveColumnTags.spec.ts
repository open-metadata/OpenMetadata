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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

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

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const firstColumnName = table.columnsName[0];
    const columnRowSelector = `[data-row-key$="${firstColumnName}"]`;

    // Add PII.Sensitive tag to the first column
    await page.click(
      `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="add-tag"]`
    );

    const tagSearchResponse = page.waitForResponse(
      '/api/v1/search/query?q=*Sensitive*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'Sensitive');
    await tagSearchResponse;

    await page.click('[data-testid="tag-PII.Sensitive"]');

    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).toContainText('Sensitive');

    const saveTagResponse = page.waitForResponse('/api/v1/columns/name/**');
    await page.click('[data-testid="saveAssociatedTag"]');
    await saveTagResponse;

    await page.waitForSelector('.ant-select-dropdown', { state: 'detached' });

    // Verify the tag was added successfully
    await expect(
      page.locator(
        `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"]`
      )
    ).toContainText('Sensitive');

    // Now try to add a mutually exclusive tag (PII.NonSensitive) to the same column
    // The edit button is inside tags-container
    await page.click(
      `${columnRowSelector} [data-testid*="classification-tags"] [data-testid="tags-container"] [data-testid="edit-button"]`
    );

    const tagSearchResponse2 = page.waitForResponse(
      '/api/v1/search/query?q=*NonSensitive*'
    );
    await page.fill('[data-testid="tag-selector"] input', 'NonSensitive');
    await tagSearchResponse2;

    await page.click('[data-testid="tag-PII.NonSensitive"]');

    await expect(
      page.locator('[data-testid="tag-selector"] > .ant-select-selector')
    ).toContainText('NonSensitive');

    // Wait for the API call which should return an error
    const errorResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/columns/name/') &&
        response.status() >= 400
    );
    await page.click('[data-testid="saveAssociatedTag"]');
    await errorResponse;

    // Verify that error alert is displayed
    await expect(page.getByTestId('alert-bar')).toBeVisible();

    // Verify the error message contains information about mutually exclusive tags
    await expect(page.getByTestId('alert-message')).toContainText(
      'mutually exclusive'
    );

    // Verify that the dropdown closes after error
    await expect(page.locator('.ant-select-dropdown')).not.toBeVisible();

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
