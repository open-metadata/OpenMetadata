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
import { ColumnGridResponse } from '../../../src/generated/api/data/columnGridResponse';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import {
  createNewPage,
  fullUuid,
  getApiContext,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

// The UI state matrix lives in ColumnGrid.integration.test.tsx. These cases
// retain assembled-page, browser-editor and real background-job contracts.
const GRID_API_URL = '/api/v1/columns/grid';

async function visitColumnBulkOperationsPage(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(GRID_API_URL), {
      timeout: 30000,
    }),
    page.goto('/column-bulk-operations'),
  ]);
  expect(response.status()).toBe(200);
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
    .poll(
      async () => {
        return runSearch();
      },
      { timeout: 90000, intervals: [1000, 2000, 3000] }
    )
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

function getColumnRowCheckbox(page: Page, rowId: string) {
  return page
    .locator(`[data-row-id="${rowId}"]`)
    .first()
    .locator('[slot="selection"]');
}

test.describe('Column Bulk Operations - Page Load & Stats', () => {
  test.beforeEach(async ({ page }) => {
    await visitColumnBulkOperationsPage(page);
  });

  test('should load the page with stats cards and grid data', async ({
    page,
  }) => {
    await test.step('Verify stats cards are visible', async () => {
      await expect(page.getByTestId('total-unique-columns-card')).toBeVisible();
      await expect(page.getByTestId('total-occurrences-card')).toBeVisible();
      await expect(page.getByTestId('pending-changes-card')).toBeVisible();
    });

    await test.step('Verify the grid table is visible with rows', async () => {
      await expect(page.getByTestId('column-grid-container')).toBeVisible();
      await expect(page.getByTestId('table-view-container')).toBeVisible();
    });
  });
});

test.describe('Column Bulk Operations - Selection & Edit Drawer', () => {
  test.setTimeout(120000);

  const table = new TableClass();
  let sharedColumnName: string;

  test.beforeAll('Setup tables with shared column', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    sharedColumnName = table.columnsName[0];

    // Create a second table in the same schema with the same columns
    // to guarantee multiple occurrences of the shared column
    await table.createAdditionalTable(
      {
        name: `pw-table-${fullUuid()}`,
        displayName: `pw table additional ${fullUuid()}`,
      },
      apiContext
    );

    await waitForColumnInGridIndex(apiContext, sharedColumnName, 2);
    await afterAction();
  });

  test.afterAll('Cleanup test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await visitColumnBulkOperationsPage(page);
  });

  test('should accept text with spaces in the description field', async ({
    page,
  }) => {
    const descriptionBox = '.om-block-editor[contenteditable="true"]';
    const descriptionText = 'Testing for whitespace';

    await test.step('Search and select a shared column', async () => {
      await searchColumn(page, sharedColumnName);
      const checkbox = getColumnRowCheckbox(page, sharedColumnName);
      await expect(checkbox).toBeVisible();
      await checkbox.click();
    });

    await test.step('Open the edit drawer', async () => {
      const editButton = page.getByTestId('edit-button');
      await expect(editButton).toBeEnabled();
      await editButton.click();

      const drawer = page.getByTestId('column-bulk-operations-form-drawer');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByTestId('description-field')).toBeVisible();
    });

    await test.step('Type text with spaces in the description editor', async () => {
      const drawer = page.getByTestId('column-bulk-operations-form-drawer');
      const editor = drawer.locator(descriptionBox).first();
      await expect(editor).toBeVisible();
      await editor.click();
      await editor.fill(descriptionText);
      await expect(editor).toContainText(descriptionText);
    });

    await test.step('Close drawer', async () => {
      await page.keyboard.press('Escape');
    });
  });
});

test.describe('Column Bulk Operations - Bulk Update Flow', () => {
  test.setTimeout(120000);

  const table = new TableClass();
  let sharedColumnName: string;

  test.beforeAll(
    'Setup tables with shared column for bulk update',
    async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      sharedColumnName = table.columnsName[0];

      await table.createAdditionalTable(
        {
          name: `pw-table-${fullUuid()}`,
          displayName: `pw table bulk ${fullUuid()}`,
        },
        apiContext
      );

      await waitForColumnInGridIndex(apiContext, sharedColumnName, 2);
      await afterAction();
    }
  );

  test.afterAll('Cleanup bulk update test data', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('should show success notification after bulk update', async ({
    page,
  }) => {
    const displayName = `BulkTest_${uuid()}`;
    await visitColumnBulkOperationsPage(page);

    await test.step('Search and select column', async () => {
      await searchColumn(page, sharedColumnName);

      const checkbox = getColumnRowCheckbox(page, sharedColumnName);
      await expect(checkbox).toBeVisible();
      await checkbox.click();
    });

    await test.step('Fill display name and submit', async () => {
      const editButton = page.getByTestId('edit-button');
      await expect(editButton).toBeEnabled();
      await editButton.click();

      const drawer = page.getByTestId('column-bulk-operations-form-drawer');
      await expect(drawer).toBeVisible();

      const displayNameInput = drawer
        .getByTestId('display-name-input')
        .locator('input');
      await displayNameInput.fill(displayName);

      const updateButton = drawer.getByRole('button', { name: 'Update' });
      await expect(updateButton).toBeEnabled();
      await updateButton.click();
    });

    await test.step('Verify success toast', async () => {
      await expect(
        page.getByText(/bulk update (initiated|completed)/i)
      ).toBeVisible({ timeout: 10000 });
    });

    await test.step('Verify both column occurrences were updated in the server index', async () => {
      const { apiContext, afterAction } = await getApiContext(page);
      try {
        await expect
          .poll(
            async () => {
              const response = await apiContext.get(
                `${GRID_API_URL}?size=1000&columnNamePattern=${encodeURIComponent(
                  sharedColumnName
                )}`
              );
              expect(response.ok()).toBe(true);
              const result: ColumnGridResponse = await response.json();
              const column = result.columns.find(
                ({ columnName }) => columnName === sharedColumnName
              );

              return (
                column?.groups
                  .filter((group) => group.displayName === displayName)
                  .reduce((count, group) => count + group.occurrenceCount, 0) ??
                0
              );
            },
            { timeout: 30000 }
          )
          .toBe(2);
      } finally {
        await afterAction();
      }
    });
  });
});
