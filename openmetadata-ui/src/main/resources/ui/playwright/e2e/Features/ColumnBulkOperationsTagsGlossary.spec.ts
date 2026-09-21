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
import { APIRequestContext, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const GRID_API_URL = '/api/v1/columns/grid';

async function waitForGridResponse(page: Page) {
  return page.waitForResponse(
    (r) => r.url().includes(GRID_API_URL) && r.status() === 200
  );
}

async function visitColumnBulkOperationsPage(page: Page) {
  await redirectToHomePage(page);
  const dataRes = waitForGridResponse(page);
  await sidebarClick(page, SidebarItem.COLUMN_BULK_OPERATIONS);
  await dataRes;
  await waitForAllLoadersToDisappear(page);
}

async function searchColumn(page: Page, columnName: string) {
  const searchInput = page.getByPlaceholder('Search columns');
  const matchingRowLocator = page.getByTestId(`column-row-${columnName}`);

  const runSearch = async () => {
    await searchInput.clear();
    const encodedColumnName = encodeURIComponent(columnName);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(GRID_API_URL) &&
        response.url().includes(`columnNamePattern=${encodedColumnName}`),
      { timeout: 15000 }
    );
    await searchInput.fill(columnName);
    const response = await responsePromise.catch(() => null);

    if (response && response.status() !== 200) {
      return 0;
    }

    await waitForAllLoadersToDisappear(page);

    return matchingRowLocator.count();
  };

  await expect
    .poll(async () => runSearch(), {
      timeout: 90000,
      intervals: [1000, 2000, 3000],
    })
    .toBeGreaterThan(0);
}

async function waitForColumnInGridIndex(
  apiContext: APIRequestContext,
  columnName: string,
  minOccurrences = 1
) {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/columns/grid?size=1000&columnNamePattern=${encodeURIComponent(
            columnName
          )}`
        );

        if (!response.ok()) {
          return 0;
        }

        const body = await response.json();
        const match = body.columns?.find(
          (column: { columnName?: string }) => column.columnName === columnName
        );

        return match?.totalOccurrences ?? 0;
      },
      { timeout: 90000, intervals: [1000, 2000, 3000] }
    )
    .toBeGreaterThanOrEqual(minOccurrences);
}

async function waitForGlossaryTermInSearch(
  apiContext: APIRequestContext,
  termFqn: string,
  searchText: string
) {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/search/query?q=${encodeURIComponent(
            searchText
          )}&index=glossaryTerm&size=50`
        );

        if (!response.ok()) {
          return false;
        }

        const body = await response.json();
        const hits: Array<{ _source?: { fullyQualifiedName?: string } }> =
          body.hits?.hits ?? [];

        return hits.some((hit) => hit._source?.fullyQualifiedName === termFqn);
      },
      { timeout: 90000, intervals: [1000, 2000, 3000] }
    )
    .toBe(true);
}

function getColumnRowCheckbox(page: Page, rowId: string) {
  return page
    .locator(`[data-row-id="${rowId}"]`)
    .first()
    .locator('[slot="selection"]');
}

test.describe('Column Bulk Operations - Tags & Glossary Select in Drawer', () => {
  const CLASSIFICATION_TAG_FQN = 'PII.Sensitive';
  const table = new TableClass();
  const glossaryTerm = new GlossaryTerm();
  let sharedColumnName: string;

  test.beforeAll(
    'Setup table, column and glossary term',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      sharedColumnName = table.columnsName[0];
      await glossaryTerm.create(apiContext);

      await waitForColumnInGridIndex(apiContext, sharedColumnName);
      await waitForGlossaryTermInSearch(
        apiContext,
        glossaryTerm.responseData.fullyQualifiedName,
        glossaryTerm.randomName
      );
      await afterAction();
    }
  );

  test.afterAll('Cleanup tags/glossary test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await visitColumnBulkOperationsPage(page);
  });

  const openEditDrawer = async (page: Page) => {
    await searchColumn(page, sharedColumnName);

    const checkbox = getColumnRowCheckbox(page, sharedColumnName);
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    const editButton = page.getByTestId('edit-button');
    await expect(editButton).toBeEnabled();
    await editButton.click();

    const drawer = page.getByTestId('column-bulk-operations-form-drawer');
    await expect(drawer).toBeVisible();

    return drawer;
  };

  test('should select a classification tag from the dropdown inside the drawer', async ({
    page,
  }) => {
    const drawer = await openEditDrawer(page);
    const tagsField = drawer.getByTestId('tags-field');

    await test.step('Open the tags dropdown and search', async () => {
      const tagInput = tagsField
        .getByTestId('tag-selector')
        .locator('input')
        .first();
      await tagInput.click();

      const searchRes = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes('index=tag')
      );
      await tagInput.fill('Sensitive');
      await searchRes;
    });

    await test.step('Option renders inside the drawer top layer', async () => {
      // Before the fix this option portaled to document.body, outside the
      // drawer — so scoping the locator to the drawer would not find it.
      await expect(
        drawer.getByTestId(`tag-${CLASSIFICATION_TAG_FQN}`)
      ).toBeVisible();
    });

    await test.step('Clicking the option selects the tag', async () => {
      await drawer.getByTestId(`tag-${CLASSIFICATION_TAG_FQN}`).click();

      await expect(
        tagsField.locator('[data-testid^="selected-tag-"]')
      ).toHaveCount(1);
    });

    await test.step('Close drawer', async () => {
      await page.keyboard.press('Escape');
    });
  });

  test('should select a glossary term from the tree dropdown inside the drawer', async ({
    page,
  }) => {
    const drawer = await openEditDrawer(page);
    const glossaryField = drawer.getByTestId('glossary-terms-field');
    const termFqn = glossaryTerm.responseData.fullyQualifiedName;

    await test.step('Open the glossary tree dropdown and search', async () => {
      const glossaryInput = glossaryField
        .getByTestId('tag-selector')
        .locator('input')
        .first();
      await glossaryInput.click();

      const searchRes = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes('index=glossaryTerm')
      );
      await glossaryInput.fill(glossaryTerm.randomName);
      await searchRes;
    });

    await test.step('Term option renders inside the drawer top layer', async () => {
      await expect(drawer.getByTestId(`tag-${termFqn}`)).toBeVisible();
    });

    await test.step('Clicking the term selects it', async () => {
      await drawer.getByTestId(`tag-${termFqn}`).click();

      await expect(
        glossaryField.locator('[data-testid^="selected-tag-"]')
      ).toHaveCount(1);
    });

    await test.step('Close drawer', async () => {
      await page.keyboard.press('Escape');
    });
  });
});
