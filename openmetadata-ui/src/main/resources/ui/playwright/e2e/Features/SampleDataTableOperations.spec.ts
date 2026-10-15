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
import {
  fillDeleteConfirmationIfPresent,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  addSampleDataViaApi,
  navigateToSampleDataTab,
} from '../../utils/sampleData';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { test } from '../fixtures/pages';

test.describe('Sample Data Tab - Delete Functionality', () => {
  const tableForDelete = new TableClass();

  test.beforeAll('Setup table with sample data', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableForDelete.create(apiContext);
    await addSampleDataViaApi(apiContext, tableForDelete);

    await afterAction();
  });

  test.afterAll('Cleanup table', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableForDelete.delete(apiContext);

    await afterAction();
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
      const deleteResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response
            .url()
            .includes(
              `/api/v1/tables/${tableForDelete.entityResponseData.id}/sampleData`
            ) && response.request().method() === 'DELETE',
        200
      );

      const refetchResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response
            .url()
            .includes(
              `/api/v1/tables/${tableForDelete.entityResponseData.id}/sampleData`
            ) && response.request().method() === 'GET',
        200
      );

      await fillDeleteConfirmationIfPresent(page);
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
});
