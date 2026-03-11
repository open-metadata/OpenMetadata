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
import test, { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.describe('Global Search Column Suggestions', () => {
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

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Navigate to column from column suggestion', async ({ page }) => {
    const column = table.entityResponseData?.columns?.[0];
    const columnName = column?.name;
    const columnSelector = `[data-testid="${table.service.name}-${columnName}"]`;

    const searchInput = page.getByTestId('searchBox');
    await searchInput.click();

    await searchInput.fill(columnName);

    const suggestionsRes = page.waitForResponse('/api/v1/search/query?*');
    await suggestionsRes;

    const suggestionsContainer = page.locator(
      '[data-testid="global-search-suggestion-box"]'
    );
    await expect(suggestionsContainer).toBeVisible();

    const columnSuggestion = suggestionsContainer
      .getByTestId('group-column_search_index')
      .locator(columnSelector);

    await expect(columnSuggestion).toContainText(columnName);

    await expect(columnSuggestion).toContainText(
      table.entityResponseData.fullyQualifiedName ?? ''
    );

    const columnListAPI = page.waitForResponse(
      '/api/v1/tables/name/*/columns*'
    );

    await columnSuggestion.click();

    await columnListAPI;
    await waitForAllLoadersToDisappear(page);

    await expect(
      page.locator('.ant-drawer-open [data-testid="entity-link"]', {
        hasText: columnName,
      })
    ).toBeVisible();
  });
});
