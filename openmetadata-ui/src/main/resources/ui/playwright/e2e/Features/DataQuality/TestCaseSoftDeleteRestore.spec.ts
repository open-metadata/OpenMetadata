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
import { APIRequestContext, expect, Page } from '@playwright/test';
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
import { enableAiAppMode } from '../../Utils/appMode';

const APP_MODES = [
  {
    label: 'Classic',
    testCaseListPath: '/data-quality/test-cases',
    openApp: redirectToHomePage,
  },
  {
    label: 'AI',
    testCaseListPath: '/observability/data-quality/test-cases',
    openApp: enableAiAppMode,
  },
];

const waitForTestCaseListInclude = (
  page: Page,
  include: 'deleted' | 'non-deleted'
) =>
  page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      new URL(response.url()).searchParams.get('include') === include
  );

const openTestCaseList = async (
  page: Page,
  testCaseListPath: string,
  testCaseName: string,
  include: 'deleted' | 'non-deleted'
) => {
  const initialListResponse = waitForTestCaseListResponse(page);
  await page.goto(testCaseListPath, { waitUntil: 'domcontentloaded' });
  await initialListResponse;

  // The search box is debounced: match the response on `q`, or a stale list
  // response lets the test click the row before the debounced search fires
  // and navigates back to the list.
  const searchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testCases/search/list') &&
      (new URL(response.url()).searchParams.get('q') ?? '').includes(
        testCaseName
      )
  );
  await page.getByTestId('searchbar').fill(testCaseName);
  await searchResponse;

  if (include === 'deleted') {
    const deletedListResponse = waitForTestCaseListInclude(page, include);
    await page.getByTestId('show-deleted').click();
    await deletedListResponse;
    await waitForAllLoadersToDisappear(page);
  }

  await expect(page.getByTestId(testCaseName)).toBeVisible();
};

const softDeleteTestCase = async (
  apiContext: APIRequestContext,
  testCaseId: string
) => {
  await apiContext.delete(`/api/v1/dataQuality/testCases/${testCaseId}`, {
    params: { hardDelete: false, recursive: true },
  });
};

const waitForDeletedTestCase = async (
  apiContext: APIRequestContext,
  testCaseName: string
) => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          '/api/v1/dataQuality/testCases/search/list',
          {
            params: {
              include: 'deleted',
              includeAllTests: true,
              q: `*${testCaseName}*`,
            },
          }
        );
        const body = await response.json();

        return (body.data ?? []).some(
          (testCase: { name?: string }) => testCase.name === testCaseName
        );
      },
      { timeout: 45_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toBe(true);
};

for (const { label, testCaseListPath, openApp } of APP_MODES) {
  test.describe(
    `Test case soft delete and restore (${label} mode)`,
    { tag: [`${DOMAIN_TAGS.OBSERVABILITY}:Data_Quality`] },
    () => {
      const softDeleteTestCaseName = `soft_delete_${uuid()}`;
      const restoreTestCaseName = `restore_details_${uuid()}`;
      const restoreTestCaseDisplayName = `Restore details ${uuid()}`;
      const restoreTestCaseDescription = `Description preserved after restore ${uuid()}`;
      const readOnlyTestCaseName = `deleted_read_only_${uuid()}`;
      let table: TableClass;
      let softDeleteTestCaseId: string;

      test.beforeAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        table = new TableClass();
        await table.create(apiContext);

        // Test-case classification tags are inherited from the parent entity.
        await apiContext.patch(
          `/api/v1/tables/${table.entityResponseData?.id}`,
          {
            data: [
              {
                op: 'replace',
                path: '/tags',
                value: [
                  {
                    labelType: 'Manual',
                    source: 'Classification',
                    state: 'Confirmed',
                    tagFQN: 'PII.Sensitive',
                  },
                ],
              },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );

        const softDeleteCandidate = await table.createTestCase(apiContext, {
          name: softDeleteTestCaseName,
          entityLink: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          parameterValues: [{ name: 'columnCount', value: '4' }],
          testDefinition: 'tableColumnCountToEqual',
        });
        softDeleteTestCaseId = softDeleteCandidate.id;
        // A failed result opens an incident, stored as a child of the test
        // case; the list's soft delete must then go out with recursive=true.
        await table.addTestCaseResult(
          apiContext,
          softDeleteCandidate.fullyQualifiedName,
          {
            result: 'Soft delete with an open incident',
            testCaseStatus: 'Failed',
            timestamp: Date.now(),
          }
        );

        const restoreCandidateData = {
          name: restoreTestCaseName,
          displayName: restoreTestCaseDisplayName,
          description: restoreTestCaseDescription,
          entityLink: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          parameterValues: [{ name: 'columnCount', value: '4' }],
          testDefinition: 'tableColumnCountToEqual',
        };
        const restoreCandidate = await table.createTestCase(
          apiContext,
          restoreCandidateData
        );
        const readOnlyCandidate = await table.createTestCase(apiContext, {
          name: readOnlyTestCaseName,
          entityLink: `<#E::table::${table.entityResponseData?.fullyQualifiedName}>`,
          parameterValues: [{ name: 'columnCount', value: '4' }],
          testDefinition: 'tableColumnCountToEqual',
        });

        await Promise.all([
          softDeleteTestCase(apiContext, restoreCandidate.id),
          softDeleteTestCase(apiContext, readOnlyCandidate.id),
        ]);
        await Promise.all([
          waitForDeletedTestCase(apiContext, restoreTestCaseName),
          waitForDeletedTestCase(apiContext, readOnlyTestCaseName),
        ]);
        await afterAction();
      });

      test.afterAll(async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await table.delete(apiContext);
        await afterAction();
      });

      test('soft deletes an active test case and lists it as deleted', async ({
        page,
      }) => {
        await openApp(page);
        await openTestCaseList(
          page,
          testCaseListPath,
          softDeleteTestCaseName,
          'non-deleted'
        );

        await page
          .getByTestId(`action-dropdown-${softDeleteTestCaseName}`)
          .click();
        await page.getByTestId(`delete-${softDeleteTestCaseName}`).click();
        await expect(page.getByTestId('delete-modal')).toBeVisible();
        await expect(page.getByTestId('soft-delete')).toBeVisible();

        const deleteResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(
                `/api/v1/dataQuality/testCases/${softDeleteTestCaseId}`
              ) &&
            response.url().includes('hardDelete=false') &&
            response.request().method() === 'DELETE'
        );
        const activeListRefresh = waitForTestCaseListResponse(page);
        await page.getByTestId('confirm-button').click();
        const deleted = await deleteResponse;
        expect(new URL(deleted.url()).searchParams.get('recursive')).toBe(
          'true'
        );
        expect(deleted.ok()).toBe(true);
        await activeListRefresh;
        await toastNotification(page, /deleted successfully!/);
        await expect(
          page.getByTestId(softDeleteTestCaseName)
        ).not.toBeVisible();

        const deletedListResponse = waitForTestCaseListInclude(page, 'deleted');
        await page.getByTestId('show-deleted').click();
        await deletedListResponse;
        await waitForAllLoadersToDisappear(page);
        await expect(page.getByTestId(softDeleteTestCaseName)).toBeVisible();
      });

      test('restores an API-deleted test case without losing its details', async ({
        page,
      }) => {
        await openApp(page);
        await openTestCaseList(
          page,
          testCaseListPath,
          restoreTestCaseName,
          'deleted'
        );

        await page
          .getByTestId(`action-dropdown-${restoreTestCaseName}`)
          .click();
        await page.getByTestId(`restore-${restoreTestCaseName}`).click();
        const confirmationModal = page.getByTestId('confirmation-modal');
        const restoreButton = confirmationModal.getByTestId('save-button');

        // Ant Design's modal root is a zero-size portal wrapper, so the visible
        // action inside the dialog is the reliable signal that it is interactive.
        await expect(restoreButton).toBeVisible();
        await expect(confirmationModal.getByTestId('body-text')).toContainText(
          restoreTestCaseDisplayName
        );

        const restoreResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/dataQuality/testCases/restore') &&
            response.request().method() === 'PUT'
        );
        const deletedListRefresh = waitForTestCaseListResponse(page);
        await restoreButton.click();
        await restoreResponse;
        await deletedListRefresh;
        await expect(page.getByTestId(restoreTestCaseName)).not.toBeVisible();

        const activeListResponse = waitForTestCaseListInclude(
          page,
          'non-deleted'
        );
        await page.getByTestId('show-deleted').click();
        await activeListResponse;
        await expect(page.getByTestId(restoreTestCaseName)).toBeVisible();

        const detailResponse = waitForTestCaseDetailsResponse(page);
        await page.getByTestId(restoreTestCaseName).getByRole('link').click();
        await detailResponse;

        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText(restoreTestCaseDisplayName);
        await expect(page.getByTestId('entity-header-name')).toContainText(
          restoreTestCaseName
        );
        await expect(page.getByTestId('viewer-container')).toContainText(
          restoreTestCaseDescription
        );
        // The row is keyed on the parameter's name; its label is the
        // definition's display name ("Count").
        await expect(
          page.getByTestId('configuration-parameter-columnCount')
        ).toContainText('4');
        await expect(
          page.getByTestId('tags-container').getByTestId('tag-PII.Sensitive')
        ).toBeVisible();
      });

      test('keeps an API-deleted test case read-only except for restore', async ({
        page,
      }) => {
        await openApp(page);
        await openTestCaseList(
          page,
          testCaseListPath,
          readOnlyTestCaseName,
          'deleted'
        );

        const detailResponse = waitForTestCaseDetailsResponse(page);
        await page.getByTestId(readOnlyTestCaseName).getByRole('link').click();
        await detailResponse;

        await expect(page.getByTestId('deleted-badge')).toBeVisible();

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
    }
  );
}
