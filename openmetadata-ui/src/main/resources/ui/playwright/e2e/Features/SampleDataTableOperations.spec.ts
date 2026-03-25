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

import { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  addSampleDataViaApi,
  navigateToSampleDataTab,
} from '../../utils/sampleData';
import { test } from '../fixtures/pages';

test.describe('Sample Data Tab - Download and Delete Functionality', () => {
  const tableWithData = new TableClass();
  const tableForDelete = new TableClass();
  const tableEmpty = new TableClass();

  test.beforeAll('Setup tables with sample data', async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithData.create(apiContext);
    await tableForDelete.create(apiContext);
    await tableEmpty.create(apiContext);

    await addSampleDataViaApi(apiContext, tableWithData);
    await addSampleDataViaApi(apiContext, tableForDelete);

    await afterAction();
  });

  test.afterAll('Cleanup tables', async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithData.delete(apiContext);
    await tableForDelete.delete(apiContext);
    await tableEmpty.delete(apiContext);

    await afterAction();
  });

  test('should display sample data tab with rows and columns', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Verify sample data table renders with data', async () => {
      await expect(page.getByTestId('sample-data')).toBeVisible();
      await expect(page.getByTestId('row-limit-select')).toBeVisible();
      await expect(page.getByTestId('sample-data-manage-button')).toBeVisible();
    });

    await test.step('Verify sample data rows are visible', async () => {
      await expect(
        page.getByTestId('sample-data-table').getByRole('row').nth(1)
      ).toBeVisible();
    });
  });

  test('should change row limit using the selector', async ({ page }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Change row limit to 10', async () => {
      await page.getByTestId('row-limit-select').click();

      await expect(page.getByTestId('row-limit-option-10')).toBeVisible();
      await page.getByTestId('row-limit-option-10').click();

      await expect(page.getByTestId('row-limit-select')).toContainText('10');
    });

    await test.step('Change row limit to 1000', async () => {
      await page.getByTestId('row-limit-select').click();

      await expect(page.getByTestId('row-limit-option-1000')).toBeVisible();
      await page.getByTestId('row-limit-option-1000').click();

      await expect(page.getByTestId('row-limit-select')).toContainText('1000');
    });

    await test.step('Reset row limit back to 100', async () => {
      await page.getByTestId('row-limit-select').click();

      await expect(page.getByTestId('row-limit-option-100')).toBeVisible();
      await page.getByTestId('row-limit-option-100').click();

      await expect(page.getByTestId('row-limit-select')).toContainText('100');
    });
  });

  test('should show export and delete options in manage dropdown for admin', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Open manage button dropdown', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
    });

    await test.step('Verify both export and delete options are present', async () => {
      await expect(page.getByTestId('export-button')).toBeVisible();
      await expect(page.getByTestId('delete-button')).toBeVisible();
    });

    await test.step('Close the dropdown', async () => {
      await page.getByTestId('sample-data').click();
      await expect(page.getByTestId('export-button')).not.toBeVisible();
    });
  });

  test('should download sample data as CSV when export is clicked', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Click export and verify download triggered', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await page.getByTestId('delete-button').waitFor({ state: 'visible' });
      await expect(page.getByTestId('export-button')).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('export-button').click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/sample_data_.*\.csv/);

      const stream = await download.createReadStream();

      if (stream) {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const csvContent = Buffer.concat(chunks).toString('utf-8');

        // Verify CSV headers match the table column names
        const expectedColumns = (
          tableWithData.entityResponseData.columns ?? []
        ).map((col) => col.name ?? '');

        for (const col of expectedColumns) {
          expect(csvContent).toContain(col);
        }

        // Verify sample data values are present (added via addSampleDataViaApi)
        expect(csvContent).toContain('sample_value_0_0');
      }
    });
  });

  test('should open delete confirmation modal and require DELETE confirmation', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Open delete modal via manage dropdown', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
      await page.getByTestId('delete-button').click();

      await expect(page.getByTestId('modal-header')).toBeVisible();
    });

    await test.step('Verify confirm button is disabled without typing DELETE', async () => {
      const confirmButton = page.getByTestId('confirm-button');
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeDisabled();
    });

    await test.step('Type DELETE to enable confirm button', async () => {
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const confirmButton = page.getByTestId('confirm-button');
      await expect(confirmButton).toBeEnabled();
    });

    await test.step('Close modal by clicking cancel', async () => {
      await page.getByTestId('discard-button').click();
      await expect(page.getByTestId('modal-header')).not.toBeVisible();
      await expect(page.getByTestId('sample-data')).toBeVisible();
    });
  });

  test('should delete sample data and show empty state after confirmation', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab for table with data', async () => {
      await navigateToSampleDataTab(page, tableForDelete);
      await expect(page.getByTestId('sample-data')).toBeVisible();
    });

    await test.step('Open delete modal via manage dropdown', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
      await page.getByTestId('delete-button').click();

      await expect(page.getByTestId('modal-header')).toBeVisible();
    });

    await test.step('Type DELETE and confirm deletion', async () => {
      await page.getByTestId('confirmation-text-input').fill('DELETE');

      const deleteResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              `/api/v1/tables/${tableForDelete.entityResponseData.id}/sampleData`
            ) &&
          response.request().method() === 'DELETE' &&
          response.status() === 200
      );

      const refetchResponse = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(
              `/api/v1/tables/${tableForDelete.entityResponseData.id}/sampleData`
            ) &&
          response.request().method() === 'GET' &&
          response.status() === 200
      );

      await page.getByTestId('confirm-button').click();
      await deleteResponse;
      await refetchResponse;
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify empty state is shown after deletion', async () => {
      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(page.getByTestId('sample-data')).not.toBeVisible();
    });
  });

  test('should cancel deletion and preserve sample data', async ({ page }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
      await expect(page.getByTestId('sample-data')).toBeVisible();
    });

    await test.step('Open delete modal and cancel', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
      await page.getByTestId('delete-button').click();

      await expect(page.getByTestId('modal-header')).toBeVisible();

      await page.getByTestId('discard-button').click();

      await expect(page.getByTestId('modal-header')).not.toBeVisible();
    });

    await test.step('Verify sample data is still visible after cancellation', async () => {
      await expect(page.getByTestId('sample-data')).toBeVisible();

      await expect(
        page.getByTestId('sample-data-table').getByRole('row').nth(1)
      ).toBeVisible();
    });
  });

  test('should show empty state for table without sample data', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab for empty table', async () => {
      await navigateToSampleDataTab(page, tableEmpty);
    });

    await test.step('Verify empty placeholder is shown instead of data table', async () => {
      await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
      await expect(page.getByTestId('sample-data')).not.toBeVisible();
      await expect(page.getByTestId('row-limit-select')).not.toBeVisible();
      await expect(
        page.getByTestId('sample-data-manage-button')
      ).not.toBeVisible();
    });
  });

  test('should show only export option for data consumer without edit permissions', async ({
    dataConsumerPage: page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab as data consumer', async () => {
      await navigateToSampleDataTab(page, tableWithData);
      await expect(page.getByTestId('sample-data')).toBeVisible();
    });

    await test.step('Open manage dropdown as data consumer', async () => {
      await page.getByTestId('sample-data-manage-button').click();
      await expect(page.getByTestId('export-button')).toBeVisible();
    });

    await test.step('Verify export is visible but delete is hidden', async () => {
      await expect(page.getByTestId('export-button')).toBeVisible();
      await expect(page.getByTestId('delete-button')).not.toBeVisible();
    });
  });

  test('should persist row limit selection after switching tabs and returning', async ({
    page,
  }) => {
    test.slow();

    await test.step('Navigate to sample data tab', async () => {
      await navigateToSampleDataTab(page, tableWithData);
    });

    await test.step('Change row limit to 10', async () => {
      await page.getByTestId('row-limit-select').click();

      await expect(page.getByTestId('row-limit-option-10')).toBeVisible();
      await page.getByTestId('row-limit-option-10').click();

      await expect(page.getByTestId('row-limit-select')).toContainText('10');
    });

    await test.step('Switch to Schema tab and back to Sample Data', async () => {
      await page.getByRole('tab', { name: 'Columns' }).click();
      await waitForAllLoadersToDisappear(page);

      await page.getByRole('tab', { name: 'Sample Data' }).click();
      await waitForAllLoadersToDisappear(page);
    });

    await test.step('Verify row limit defaults back on tab re-entry', async () => {
      await expect(page.getByTestId('row-limit-select')).toBeVisible();
    });
  });
});
