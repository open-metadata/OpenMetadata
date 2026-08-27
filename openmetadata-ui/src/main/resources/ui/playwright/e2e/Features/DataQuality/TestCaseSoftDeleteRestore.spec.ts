/*
 *  Copyright 2026 Collate.
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
import { DOMAIN_TAGS } from '../../../constant/config';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
  waitForAntdPopupToSettle,
} from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import {
  waitForTestCaseDetailsResponse,
  waitForTestCaseListResponse,
} from '../../../utils/testCases';
import { test } from '../../fixtures/pages';

test.describe(
  'Test case soft delete and restore',
  { tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`] },
  () => {
    const testCaseName = `soft_delete_restore_${uuid()}`;
    let table: TableClass;
    let testCaseId: string;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      table = new TableClass();
      await table.create(apiContext);
      const testCase = await table.createTestCase(apiContext, {
        name: testCaseName,
        entityLink: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
        parameterValues: [{ name: 'columnCount', value: '4' }],
        testDefinition: 'tableColumnCountToEqual',
      });
      testCaseId = testCase.id;
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('soft deletes, discovers, opens, and restores a test case', async ({
      page,
    }) => {
      test.slow();
      await redirectToHomePage(page);

      await test.step('Open and find the active test case', async () => {
        const initialListResponse = waitForTestCaseListResponse(page);
        await page.goto('/data-quality/test-cases');
        await initialListResponse;

        const searchResponse = waitForTestCaseListResponse(page);
        await page.getByTestId('searchbar').fill(testCaseName);
        await searchResponse;
        await expect(page.getByTestId(testCaseName)).toBeVisible();
      });

      await test.step('Soft delete the test case', async () => {
        await page.getByTestId(`action-dropdown-${testCaseName}`).click();
        await page.getByTestId(`delete-${testCaseName}`).click();
        await expect(page.getByTestId('delete-modal')).toBeVisible();
        await expect(page.getByTestId('soft-delete')).toBeVisible();

        const deleteResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/dataQuality/testCases/${testCaseId}`) &&
            response.url().includes('hardDelete=false') &&
            response.request().method() === 'DELETE'
        );
        const activeListRefresh = waitForTestCaseListResponse(page);
        await page.getByTestId('confirm-button').click();
        expect((await deleteResponse).status()).toBe(200);
        await activeListRefresh;
        await toastNotification(page, /deleted successfully!/);
        await expect(page.getByTestId(testCaseName)).not.toBeVisible();
      });

      await test.step('Find the test case in the deleted list', async () => {
        const deletedListResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testCases/search/list') &&
            new URL(response.url()).searchParams.get('include') === 'deleted'
        );
        await page.getByTestId('show-deleted').click();
        await deletedListResponse;
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId(testCaseName)).toBeVisible();
      });

      await test.step('Verify the deleted test case detail is read-only', async () => {
        const detailResponse = waitForTestCaseDetailsResponse(page);
        await page.getByTestId(testCaseName).getByRole('link').click();
        await detailResponse;
        await expect(page.getByTestId('edit-description')).toHaveCount(0);
        await expect(page.getByTestId('edit-parameter-icon')).toHaveCount(0);

        for (const widgetTestId of [
          'tags-container',
          'glossary-container',
          'data-products-container',
        ]) {
          const widget = page.getByTestId(widgetTestId);

          await expect(widget).toBeVisible();
          await expect(widget.getByTestId('edit-button')).toHaveCount(0);
          await expect(widget.getByTestId('add-tag')).toHaveCount(0);
        }

        await page.getByTestId('manage-button').click();
        await waitForAntdPopupToSettle(page);
        await expect(page.getByTestId('restore-button')).toBeVisible();
        await expect(page.getByTestId('delete-button')).not.toBeVisible();
        await expect(page.getByTestId('rename-button')).not.toBeVisible();
      });

      await test.step('Restore the deleted test case', async () => {
        const returnListResponse = waitForTestCaseListResponse(page);
        await page.goto('/data-quality/test-cases');
        await returnListResponse;

        const returnSearchResponse = waitForTestCaseListResponse(page);
        await page.getByTestId('searchbar').fill(testCaseName);
        await returnSearchResponse;

        const returnDeletedListResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testCases/search/list') &&
            new URL(response.url()).searchParams.get('include') === 'deleted'
        );
        await page.getByTestId('show-deleted').click();
        await returnDeletedListResponse;
        await expect(page.getByTestId(testCaseName)).toBeVisible();

        await page.getByTestId(`action-dropdown-${testCaseName}`).click();
        await page.getByTestId(`restore-${testCaseName}`).click();
        const confirmationModal = page.getByTestId('confirmation-modal');
        const restoreButton = confirmationModal.getByTestId('save-button');

        // Ant Design's modal root is a zero-size portal wrapper, so the visible
        // action inside the dialog is the reliable signal that it is interactive.
        await expect(restoreButton).toBeVisible();
        await expect(confirmationModal.getByTestId('body-text')).toContainText(
          testCaseName
        );

        const restoreResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/dataQuality/testCases/restore') &&
            response.request().method() === 'PUT'
        );
        const deletedListRefresh = waitForTestCaseListResponse(page);
        await restoreButton.click();
        expect((await restoreResponse).status()).toBe(200);
        await deletedListRefresh;
        await expect(page.getByTestId(testCaseName)).not.toBeVisible();
      });

      await test.step('Verify the restored test case is active', async () => {
        const activeListResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes('/api/v1/dataQuality/testCases/search/list') &&
            new URL(response.url()).searchParams.get('include') ===
              'non-deleted'
        );
        await page.getByTestId('show-deleted').click();
        await activeListResponse;
        await expect(page.getByTestId(testCaseName)).toBeVisible();
      });
    });
  }
);
