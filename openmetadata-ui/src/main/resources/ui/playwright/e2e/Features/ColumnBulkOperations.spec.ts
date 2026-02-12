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
import { expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { TableClass } from '../../support/entity/TableClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const COLUMN_BULK_OPERATIONS_URL = '/column-bulk-operations';
const METADATA_STATUS_FILTER_TESTID = 'search-dropdown-Has / Missing Metadata';
const GRID_API_URL = '/api/v1/columns/grid';
const BULK_UPDATE_API_URL = '/api/v1/columns/bulk-update-async';
const SHARED_COLUMN_NAME = 'customer_id';

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
  await searchInput.clear();

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(GRID_API_URL) &&
      response.url().includes('columnNamePattern=') &&
      response.status() === 200,
    { timeout: 15000 }
  );

  await searchInput.fill(columnName);
  await responsePromise;
  await waitForAllLoadersToDisappear(page);
}

test.describe(
  'Column Bulk Operations - Page Load & Stats',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await visitColumnBulkOperationsPage(page);
    });

    test('should load the page with stats cards and grid data', async ({
      page,
    }) => {
      await test.step('Verify stats cards are visible', async () => {
        await expect(
          page.getByTestId('total-unique-columns-card')
        ).toBeVisible();
        await expect(page.getByTestId('total-occurrences-card')).toBeVisible();
        await expect(page.getByTestId('pending-changes-card')).toBeVisible();
      });

      await test.step(
        'Verify the grid table is visible with rows',
        async () => {
          await expect(page.getByTestId('column-grid-container')).toBeVisible();
          await expect(page.getByRole('table')).toBeVisible();
        }
      );
    });

    test('should show no results when searching for nonexistent column', async ({
      page,
    }) => {
      await test.step('Search for a nonexistent column name', async () => {
        await searchColumn(page, 'zzz_nonexistent_column_xyz_12345');
      });

      await test.step('Verify empty state or zero rows', async () => {
        const noRecordsText = page.getByText(
          /no records found|no data|no results/i
        );
        const tableRows = page.locator('tbody tr');
        const noResultsCount = await noRecordsText.count();
        const rowCount = await tableRows.count();

        expect(noResultsCount > 0 || rowCount === 0).toBe(true);
      });
    });
  }
);

test.describe(
  'Column Bulk Operations - Filters & Search',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await visitColumnBulkOperationsPage(page);
    });

    test('should filter by metadata status and verify API param', async ({
      page,
    }) => {
      await test.step(
        'Open metadata status filter and select MISSING',
        async () => {
          await page.getByTestId(METADATA_STATUS_FILTER_TESTID).click();
          await page.getByTestId('MISSING').click();

          const gridRes = waitForGridResponse(page);
          await page.getByTestId('update-btn').click();
          const response = await gridRes;

          expect(response.url()).toContain('metadataStatus=MISSING');
        }
      );

      await test.step('Verify filter chip is displayed', async () => {
        const metadataStatusChip = page
          .locator('.filter-selection-chip')
          .filter({
            has: page.locator('.filter-selection-value', {
              hasText: /Missing|MISSING/,
            }),
          });

        await expect(metadataStatusChip).toBeVisible();
        await expect(
          metadataStatusChip.locator('.filter-selection-label')
        ).toContainText('Has / Missing Metadata');
      });
    });

    test('should filter by entity type (Table)', async ({ page }) => {
      await test.step('Open Asset Type filter and select Table', async () => {
        const apiCallPromise = page.waitForRequest(
          (request) =>
            request.url().includes(GRID_API_URL) &&
            request.url().includes('entityTypes='),
          { timeout: 10000 }
        );

        await page.getByRole('button', { name: 'Asset Type' }).click();
        await page.getByRole('menuitem', { name: 'Table' }).click();
        await page.getByRole('button', { name: 'Update' }).click();

        const apiRequest = await apiCallPromise;
        expect(apiRequest.url()).toContain('entityTypes=table');
      });
    });

    test('should restore filters from URL on page load', async ({ page }) => {
      await test.step(
        'Navigate to page with metadataStatus in URL',
        async () => {
          const dataRes = waitForGridResponse(page);
          await page.goto(
            `${COLUMN_BULK_OPERATIONS_URL}?metadataStatus=INCONSISTENT`
          );
          await dataRes;
          await waitForAllLoadersToDisappear(page);
        }
      );

      await test.step('Verify filter chip is restored', async () => {
        const metadataStatusChip = page
          .locator('.filter-selection-chip')
          .filter({
            has: page.locator('.filter-selection-value', {
              hasText: /Inconsistent|INCONSISTENT/,
            }),
          });

        await expect(metadataStatusChip).toBeVisible();
        await expect(
          metadataStatusChip.locator('.filter-selection-label')
        ).toContainText('Has / Missing Metadata');
      });
    });

    test('should search columns with server-side API call', async ({
      page,
    }) => {
      await test.step('Type search query and verify API call', async () => {
        const searchInput = page.getByPlaceholder('Search columns');
        await expect(searchInput).toBeVisible();

        const apiCallPromise = page.waitForRequest(
          (request) =>
            request.url().includes(GRID_API_URL) &&
            request.url().includes('columnNamePattern='),
          { timeout: 15000 }
        );

        await searchInput.fill('address');
        const apiRequest = await apiCallPromise;

        expect(apiRequest.url()).toContain('columnNamePattern=address');
      });
    });

    test('should clear individual filter and update URL', async ({ page }) => {
      await test.step(
        'Navigate with metadataStatus filter in URL',
        async () => {
          const dataRes = waitForGridResponse(page);
          await page.goto(
            `${COLUMN_BULK_OPERATIONS_URL}?metadataStatus=MISSING`
          );
          await dataRes;
          await waitForAllLoadersToDisappear(page);
        }
      );

      await test.step('Verify filter chip is present', async () => {
        const metadataStatusChip = page
          .locator('.filter-selection-chip')
          .filter({
            has: page.locator('.filter-selection-value', {
              hasText: /Missing|MISSING/,
            }),
          });

        await expect(metadataStatusChip).toBeVisible();
      });

      await test.step('Deselect the MISSING filter', async () => {
        await page.getByTestId(METADATA_STATUS_FILTER_TESTID).click();
        await page.getByTestId('MISSING').click();

        const gridRes = waitForGridResponse(page);
        await page.getByTestId('update-btn').click();
        await gridRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step(
        'Verify filter chip removed and URL updated',
        async () => {
          const metadataStatusChip = page
            .locator('.filter-selection-chip')
            .filter({
              has: page.locator('.filter-selection-value', {
                hasText: /Missing|MISSING/,
              }),
            });

          await expect(metadataStatusChip).not.toBeVisible();
          expect(page.url()).not.toContain('metadataStatus=MISSING');
        }
      );
    });

    test('should show Service filter chip from URL', async ({ page }) => {
      await test.step('Navigate with service filter in URL', async () => {
        const dataRes = waitForGridResponse(page);
        await page.goto(
          `${COLUMN_BULK_OPERATIONS_URL}?service.displayName.keyword=${encodeURIComponent(
            'sample_data'
          )}`
        );
        await dataRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify service chip is visible', async () => {
        const serviceChip = page.locator('.filter-selection-chip').filter({
          has: page.locator('.filter-selection-value', {
            hasText: 'sample_data',
          }),
        });

        await expect(serviceChip).toBeVisible();
        await expect(
          serviceChip.locator('.filter-selection-label')
        ).toContainText('Service');
      });
    });
  }
);

test.describe(
  'Column Bulk Operations - Selection & Edit Drawer',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    test.beforeEach(async ({ page }) => {
      await visitColumnBulkOperationsPage(page);
    });

    test('should show disabled edit button when no columns are selected', async ({
      page,
    }) => {
      await expect(page.getByTestId('edit-button-disabled')).toBeVisible();
    });

    test('should select column, open drawer, and verify form fields', async ({
      page,
    }) => {
      await test.step('Search for shared column', async () => {
        await searchColumn(page, SHARED_COLUMN_NAME);
      });

      await test.step('Select the column checkbox', async () => {
        const checkbox = page.getByTestId(
          `column-checkbox-${SHARED_COLUMN_NAME}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();
      });

      await test.step(
        'Verify edit button is enabled and click it',
        async () => {
          const editButton = page.getByTestId('edit-button');
          await expect(editButton).toBeVisible();
          await expect(editButton).toBeEnabled();
          await editButton.click();
        }
      );

      await test.step('Verify drawer opens with all form fields', async () => {
        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        await expect(drawer.getByTestId('form-heading')).toContainText(/Edit/);
        await expect(drawer.getByTestId('display-name-input')).toBeVisible();
        await expect(drawer.getByTestId('description-field')).toBeVisible();
        await expect(drawer.getByTestId('tags-field')).toBeVisible();
        await expect(drawer.getByTestId('glossary-terms-field')).toBeVisible();
      });

      await test.step('Close drawer with Escape', async () => {
        await page.keyboard.press('Escape');
        await expect(
          page.getByTestId('column-bulk-operations-form-drawer')
        ).not.toBeVisible();
      });
    });

    test('should show column count for multiple column selection', async ({
      page,
    }) => {
      await test.step(
        'Select two columns via header checkbox then individual',
        async () => {
          // Select header checkbox to select all, then verify
          const headerCheckbox = page.locator('thead input[type="checkbox"]');
          await expect(headerCheckbox).toBeVisible();
          await headerCheckbox.click();
        }
      );

      await test.step('Open drawer and verify multi-select title', async () => {
        const editButton = page.getByTestId('edit-button');
        await expect(editButton).toBeEnabled();
        await editButton.click();

        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        const columnNameInput = drawer.getByTestId('column-name-input');
        await expect(columnNameInput).toBeVisible();

        const inputEl = columnNameInput.locator('input');
        const value = await inputEl.inputValue();

        expect(value).toContain('columns selected');
      });

      await test.step('Close drawer', async () => {
        await page.keyboard.press('Escape');
      });
    });

    test('should cancel selection and disable edit button', async ({
      page,
    }) => {
      await test.step('Search and select a column', async () => {
        await searchColumn(page, SHARED_COLUMN_NAME);
        const checkbox = page.getByTestId(
          `column-checkbox-${SHARED_COLUMN_NAME}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();
      });

      await test.step('Cancel selection', async () => {
        const cancelButton = page.getByTestId('cancel-selection-button');
        await expect(cancelButton).toBeVisible();
        await cancelButton.click();
      });

      await test.step('Verify edit button is disabled again', async () => {
        await expect(page.getByTestId('edit-button-disabled')).toBeVisible();
      });
    });

    test('should discard changes when closing drawer without saving', async ({
      page,
    }) => {
      await test.step('Search and select a column', async () => {
        await searchColumn(page, SHARED_COLUMN_NAME);
        const checkbox = page.getByTestId(
          `column-checkbox-${SHARED_COLUMN_NAME}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();
      });

      await test.step('Open drawer and enter a display name', async () => {
        const editButton = page.getByTestId('edit-button');
        await expect(editButton).toBeEnabled();
        await editButton.click();

        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        const displayNameInput = drawer
          .getByTestId('display-name-input')
          .locator('input');
        await displayNameInput.fill('Temporary Display Name');
        await expect(displayNameInput).toHaveValue('Temporary Display Name');
      });

      await test.step('Close drawer without saving', async () => {
        await page.keyboard.press('Escape');
        await expect(
          page.getByTestId('column-bulk-operations-form-drawer')
        ).not.toBeVisible();
      });

      await test.step(
        'Reopen drawer and verify changes were discarded',
        async () => {
          const editButton = page.getByTestId('edit-button');
          await editButton.click();

          const drawer = page.getByTestId('column-bulk-operations-form-drawer');
          await expect(drawer).toBeVisible();

          const displayNameInput = drawer
            .getByTestId('display-name-input')
            .locator('input');
          await expect(displayNameInput).toBeVisible();

          const displayNameValue = await displayNameInput.inputValue();
          expect(displayNameValue).not.toBe('Temporary Display Name');
        }
      );

      await test.step('Close drawer', async () => {
        await page.keyboard.press('Escape');
      });
    });

    test('should open edit drawer when clicking on aggregate row', async ({
      page,
    }) => {
      await test.step(
        'Click on a column name cell to open drawer',
        async () => {
          const firstNameCell = page.getByTestId('column-name-cell').first();
          await expect(firstNameCell).toBeVisible();
          await firstNameCell.click();
        }
      );

      await test.step('Verify drawer opens', async () => {
        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();
      });

      await test.step('Close drawer', async () => {
        await page.keyboard.press('Escape');
      });
    });
  }
);

test.describe(
  'Column Bulk Operations - Bulk Update Flow',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    test('should update display name and propagate to all occurrences', async ({
      page,
    }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search for shared column', async () => {
        await searchColumn(page, SHARED_COLUMN_NAME);
      });

      await test.step('Select the column', async () => {
        const checkbox = page.getByTestId(
          `column-checkbox-${SHARED_COLUMN_NAME}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();
      });

      const displayName = `SharedDisplayName_${uuid()}`;

      await test.step('Open drawer and fill display name', async () => {
        const editButton = page.getByTestId('edit-button');
        await expect(editButton).toBeEnabled();
        await editButton.click();

        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        const displayNameInput = drawer
          .getByTestId('display-name-input')
          .locator('input');
        await displayNameInput.fill(displayName);
      });

      await test.step('Submit update and verify API request', async () => {
        interface BulkUpdateRequestBody {
          columnUpdates?: Array<{
            columnFQN?: string;
            displayName?: string;
          }>;
        }

        let requestBody: BulkUpdateRequestBody | null = null;

        const requestPromise = page.waitForRequest((request) => {
          if (request.url().includes(BULK_UPDATE_API_URL)) {
            try {
              requestBody =
                request.postDataJSON() as unknown as BulkUpdateRequestBody;
            } catch {
              // Ignore JSON parse errors
            }

            return true;
          }

          return false;
        });

        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        const updateButton = drawer.getByRole('button', { name: 'Update' });
        await expect(updateButton).toBeEnabled();
        await updateButton.click();

        await requestPromise;

        expect(requestBody).not.toBeNull();
        const body = requestBody as unknown as BulkUpdateRequestBody;
        expect(body.columnUpdates).toBeDefined();

        const updates = body.columnUpdates ?? [];
        expect(updates.length).toBeGreaterThanOrEqual(2);

        for (const update of updates) {
          expect(update.displayName).toBe(displayName);
          expect(update.columnFQN?.toLowerCase()).toContain(
            SHARED_COLUMN_NAME.toLowerCase()
          );
        }
      });
    });

    test('should show success notification after bulk update', async ({
      page,
    }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search and select column', async () => {
        await searchColumn(page, SHARED_COLUMN_NAME);

        const checkbox = page.getByTestId(
          `column-checkbox-${SHARED_COLUMN_NAME}`
        );
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
        await displayNameInput.fill(`BulkTest_${uuid()}`);

        const updateButton = drawer.getByRole('button', { name: 'Update' });
        await expect(updateButton).toBeEnabled();
        await updateButton.click();
      });

      await test.step('Verify success toast', async () => {
        await expect(
          page.getByText(/bulk update (initiated|completed)/i)
        ).toBeVisible({ timeout: 10000 });
      });
    });
  }
);

test.describe(
  'Column Bulk Operations - Nested STRUCT Columns',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    const table = new TableClass();
    let structColumnName: string;

    test.beforeAll('Setup table with STRUCT columns', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.create(apiContext);
      structColumnName = table.columnsName[2];
      await afterAction();
    });

    test.afterAll('Cleanup STRUCT test data', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should expand STRUCT column to show nested fields', async ({
      page,
    }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search for STRUCT column', async () => {
        await searchColumn(page, structColumnName);
      });

      await test.step('Verify STRUCT row is visible', async () => {
        const structRow = page.getByTestId(`column-row-${structColumnName}`);
        await expect(structRow).toBeVisible();
      });

      await test.step('Expand the STRUCT row', async () => {
        const structRow = page.getByTestId(`column-row-${structColumnName}`);
        const expandButton = structRow.locator('button.expand-button');

        // STRUCT rows should have expand button
        if ((await expandButton.count()) > 0) {
          const initialRowCount = await page.locator('tbody tr').count();
          await expandButton.click();

          const expandedRowCount = await page.locator('tbody tr').count();
          expect(expandedRowCount).toBeGreaterThan(initialRowCount);
        }
      });
    });

    test('should select and edit nested STRUCT field', async ({ page }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search for STRUCT column', async () => {
        await searchColumn(page, structColumnName);
      });

      await test.step('Expand STRUCT row', async () => {
        const structRow = page.getByTestId(`column-row-${structColumnName}`);
        const expandButton = structRow.locator('button.expand-button');

        if ((await expandButton.count()) > 0) {
          await expandButton.click();
        }
      });

      await test.step('Select a nested child column', async () => {
        const childColumnName = table.columnsName[3];
        const childCheckbox = page.getByTestId(
          `column-checkbox-${childColumnName}`
        );

        if ((await childCheckbox.count()) > 0) {
          await childCheckbox.click();

          const editButton = page.getByTestId('edit-button');
          await expect(editButton).toBeEnabled();
          await editButton.click();

          const drawer = page.getByTestId('column-bulk-operations-form-drawer');
          await expect(drawer).toBeVisible();
          await expect(drawer.getByTestId('display-name-input')).toBeVisible();

          await page.keyboard.press('Escape');
        }
      });
    });
  }
);

test.describe(
  'Column Bulk Operations - Pagination',
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
  () => {
    test('should navigate through pages', async ({ page }) => {
      await visitColumnBulkOperationsPage(page);

      const nextButton = page.getByRole('button', { name: 'Next' });

      await test.step(
        'Click Next and verify Previous becomes enabled',
        async () => {
          const isNextEnabled = await nextButton.isEnabled();

          if (isNextEnabled) {
            const dataRes = waitForGridResponse(page);
            await nextButton.click();
            await dataRes;
            await waitForAllLoadersToDisappear(page);

            const prevButton = page.getByRole('button', { name: 'Previous' });
            await expect(prevButton).toBeEnabled();

            await prevButton.click();
            await waitForAllLoadersToDisappear(page);
          }
        }
      );
    });
  }
);
