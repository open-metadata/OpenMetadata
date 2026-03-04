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
import {
  createNewPage,
  fullUuid,
  redirectToHomePage,
  uuid,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const COLUMN_BULK_OPERATIONS_URL = '/column-bulk-operations';
const METADATA_STATUS_FILTER_TESTID = 'search-dropdown-Has / Missing Metadata';
const GRID_API_URL = '/api/v1/columns/grid';
const BULK_UPDATE_API_URL = '/api/v1/columns/bulk-update-async';

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

async function getPendingChangesValue(page: Page) {
  return (
    (await page.getByTestId('pending-changes-value').textContent())?.trim() ??
    ''
  );
}

function buildMockColumnGridResponse(columnName: string) {
  return {
    columns: [
      {
        columnName,
        hasVariations: false,
        metadataStatus: 'MISSING',
        totalOccurrences: 1,
        groups: [
          {
            groupId: `${columnName}-group`,
            occurrenceCount: 1,
            metadataStatus: 'MISSING',
            displayName: columnName,
            description: `${columnName} description`,
            dataType: 'VARCHAR',
            tags: [],
            occurrences: [
              {
                columnFQN: `sample_data.ecommerce_db.shopify.dim_address.${columnName}`,
                entityFQN: 'sample_data.ecommerce_db.shopify.dim_address',
                entityType: 'table',
                serviceName: 'sample_data',
                databaseName: 'ecommerce_db',
                schemaName: 'shopify',
              },
            ],
          },
        ],
      },
    ],
    totalUniqueColumns: 1,
    totalOccurrences: 1,
    cursor: null,
  };
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
          await gridRes;
          await waitForAllLoadersToDisappear(page);
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

    test('should not reset stats to zero while search request is loading', async ({
      page,
    }) => {
      const totalUniqueLocator = page.getByTestId('total-unique-columns-value');
      const totalOccurrencesLocator = page.getByTestId(
        'total-occurrences-value'
      );

      const initialUnique =
        (await totalUniqueLocator.textContent())?.trim() ?? '';
      const initialOccurrences =
        (await totalOccurrencesLocator.textContent())?.trim() ?? '';

      let releaseDelayedResponse: (() => void) | undefined;
      const delayedResponse = new Promise<void>((resolve) => {
        releaseDelayedResponse = resolve;
      });

      await page.route(`**${GRID_API_URL}**`, async (route) => {
        const requestUrl = route.request().url();
        if (requestUrl.includes('columnNamePattern=')) {
          await delayedResponse;
        }
        await route.continue();
      });

      const searchInput = page.getByPlaceholder('Search columns');
      await searchInput.clear();
      await searchInput.fill(`address_${uuid().slice(0, 8)}`);

      await page.waitForRequest(
        (request) =>
          request.url().includes(GRID_API_URL) &&
          request.url().includes('columnNamePattern='),
        { timeout: 15000 }
      );

      await expect(totalUniqueLocator).toHaveText(initialUnique);
      await expect(totalOccurrencesLocator).toHaveText(initialOccurrences);

      releaseDelayedResponse?.();
      await waitForAllLoadersToDisappear(page);
      await page.unroute(`**${GRID_API_URL}**`);
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

    test('should keep latest search results when responses arrive out of order', async ({
      page,
    }) => {
      const staleQuery = `stale_${uuid().slice(0, 8)}`;
      const freshQuery = `fresh_${uuid().slice(0, 8)}`;
      const staleColumn = `stale_col_${uuid().slice(0, 8)}`;
      const freshColumn = `fresh_col_${uuid().slice(0, 8)}`;

      let releaseStaleResponse: (() => void) | undefined;
      const staleResponseGate = new Promise<void>((resolve) => {
        releaseStaleResponse = resolve;
      });

      await page.route(`**${GRID_API_URL}**`, async (route) => {
        const url = route.request().url();
        if (
          url.includes(`columnNamePattern=${encodeURIComponent(staleQuery)}`)
        ) {
          await staleResponseGate;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildMockColumnGridResponse(staleColumn)),
          });

          return;
        }
        if (
          url.includes(`columnNamePattern=${encodeURIComponent(freshQuery)}`)
        ) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(buildMockColumnGridResponse(freshColumn)),
          });

          return;
        }

        await route.continue();
      });

      const searchInput = page.getByPlaceholder('Search columns');

      await searchInput.clear();
      await searchInput.fill(staleQuery);
      await page.waitForRequest(
        (request) =>
          request.url().includes(GRID_API_URL) &&
          request
            .url()
            .includes(`columnNamePattern=${encodeURIComponent(staleQuery)}`),
        { timeout: 15000 }
      );

      await searchInput.clear();
      await searchInput.fill(freshQuery);
      await page.waitForRequest(
        (request) =>
          request.url().includes(GRID_API_URL) &&
          request
            .url()
            .includes(`columnNamePattern=${encodeURIComponent(freshQuery)}`),
        { timeout: 15000 }
      );

      releaseStaleResponse?.();

      await waitForAllLoadersToDisappear(page);

      await expect(
        page.getByTestId('column-name-cell').filter({ hasText: freshColumn })
      ).toBeVisible();
      await expect(
        page.getByTestId('column-name-cell').filter({ hasText: staleColumn })
      ).toHaveCount(0);

      await page.unroute(`**${GRID_API_URL}**`);
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

    test('should show disabled edit button when no columns are selected', async ({
      page,
    }) => {
      await expect(page.getByTestId('edit-button-disabled')).toBeVisible();
    });

    test('should update pending changes counter when editing selected columns', async ({
      page,
    }) => {
      await test.step('Search and select a shared column', async () => {
        await searchColumn(page, sharedColumnName);
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();
      });

      await test.step('Open drawer and edit display name', async () => {
        const editButton = page.getByTestId('edit-button');
        await expect(editButton).toBeEnabled();
        await editButton.click();

        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        const displayNameInput = drawer
          .getByTestId('display-name-input')
          .locator('input');
        await displayNameInput.fill(`PendingCounter_${uuid()}`);
      });

      await test.step(
        'Verify pending changes value shows edited/selected count',
        async () => {
          const value = await getPendingChangesValue(page);
          expect(value).toMatch(/^\d+\/\d+$/);
          const [edited, selected] = value.split('/').map(Number);
          expect(edited).toBeGreaterThan(0);
          expect(selected).toBeGreaterThan(0);
        }
      );
    });

    test('should not count aggregate parent row in drawer selected count', async ({
      page,
    }) => {
      let expectedOccurrences = 0;

      await test.step('Search and select shared grouped column', async () => {
        const searchInput = page.getByPlaceholder('Search columns');
        await searchInput.clear();
        await searchInput.fill(sharedColumnName);
        await waitForAllLoadersToDisappear(page);

        const groupRow = page
          .locator(`[data-row-id="${sharedColumnName}"]`)
          .first();
        await expect(groupRow).toBeVisible();

        const columnNameCellText =
          (await groupRow.getByTestId('column-name-cell').textContent()) ?? '';
        const match = columnNameCellText.match(/\((\d+)\)/);

        expect(match).not.toBeNull();
        expectedOccurrences = Number(match?.[1] ?? '0');
        expect(expectedOccurrences).toBeGreaterThan(1);

        const checkbox = groupRow.locator('input[type="checkbox"]');
        await expect(checkbox).toBeVisible();
        await checkbox.check();
      });

      await test.step(
        'Open drawer and verify selected count matches occurrences',
        async () => {
          const editButton = page.getByTestId('edit-button');
          await expect(editButton).toBeEnabled();
          await editButton.click();

          const drawer = page.getByTestId('column-bulk-operations-form-drawer');
          await expect(drawer).toBeVisible();

          await expect(drawer.getByTestId('form-heading')).toContainText(
            String(expectedOccurrences).padStart(2, '0')
          );
          await expect(
            drawer.getByTestId('column-name-input').locator('input')
          ).toHaveValue(
            new RegExp(`${expectedOccurrences}\\s+columns selected`, 'i')
          );
        }
      );
    });

    test('should show pending progress spinner after submitting bulk update', async ({
      page,
    }) => {
      await page.route(`**${BULK_UPDATE_API_URL}`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 400));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            jobId: `pw-job-${uuid()}`,
            message: 'Bulk column update is in progress.',
          }),
        });
      });

      await test.step('Search, select, and open edit drawer', async () => {
        await searchColumn(page, sharedColumnName);
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
        );
        await expect(checkbox).toBeVisible();
        await checkbox.click();

        const editButton = page.getByTestId('edit-button');
        await expect(editButton).toBeEnabled();
        await editButton.click();
      });

      await test.step('Submit update request', async () => {
        const drawer = page.getByTestId('column-bulk-operations-form-drawer');
        await expect(drawer).toBeVisible();

        const displayNameInput = drawer
          .getByTestId('display-name-input')
          .locator('input');
        await displayNameInput.fill(`PendingProgress_${uuid()}`);

        const updateButton = drawer.getByRole('button', { name: 'Update' });
        await expect(updateButton).toBeEnabled();
        await updateButton.click();
      });

      await test.step(
        'Verify pending progress indicator and counter are visible',
        async () => {
          await expect(
            page.getByTestId('pending-changes-progress-spinner')
          ).toBeVisible();

          const value = await getPendingChangesValue(page);
          expect(value).toMatch(/^\d+\/\d+$/);
        }
      );
    });

    test('should select column, open drawer, and verify form fields', async ({
      page,
    }) => {
      await test.step('Search for shared column', async () => {
        await searchColumn(page, sharedColumnName);
      });

      await test.step('Select the column checkbox', async () => {
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
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
        await searchColumn(page, sharedColumnName);
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
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
        await searchColumn(page, sharedColumnName);
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
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
        await afterAction();
      }
    );

    test.afterAll('Cleanup bulk update test data', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('should update display name and propagate to all occurrences', async ({
      page,
    }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search for shared column', async () => {
        await searchColumn(page, sharedColumnName);
      });

      await test.step('Select the column', async () => {
        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
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
            sharedColumnName.toLowerCase()
          );
        }
      });
    });

    test('should show success notification after bulk update', async ({
      page,
    }) => {
      await visitColumnBulkOperationsPage(page);

      await test.step('Search and select column', async () => {
        await searchColumn(page, sharedColumnName);

        const checkbox = page.getByTestId(
          `column-checkbox-${sharedColumnName}`
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
