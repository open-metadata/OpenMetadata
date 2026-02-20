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
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';
import { CONTAINER_CHILDREN } from '../../constant/contianer';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import {
  assignTagToChildren,
  copyAndGetClipboardText,
  removeTagsFromChildren,
  testCopyLinkButton,
  validateCopiedLinkFormat,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

// Grant clipboard permissions for copy link tests
test.use({
  contextOptions: {
    permissions: ['clipboard-read', 'clipboard-write'],
  },
});

const container = new ContainerClass();

test.slow(true);

test.describe('Container entity specific tests ', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);
    await container.create(apiContext, CONTAINER_CHILDREN);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    test.slow(true);

    const { afterAction, apiContext } = await performAdminLogin(browser);

    await container.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ dataConsumerPage: page }) => {
    await redirectToHomePage(page);
  });

  test('Container page should show Schema and Children count', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    await expect(page.getByTestId('schema').getByTestId('count')).toBeVisible();
    await expect(
      page.getByTestId('children').getByTestId('count')
    ).toBeVisible();
  });

  test('Container page children pagination', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    await page.getByText('Children').click();

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2 '
    );

    // Check the second page pagination
    const childrenResponse = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=15&offset=15'
    );
    await page.getByTestId('next').click();
    await childrenResponse;

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 2 of 2 '
    );

    // Check around the page sizing change
    const childrenResponseSizeChange = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=25&offset=0'
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('25 / Page').click();
    await childrenResponseSizeChange;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 1'
    );

    // Back to the original page size
    const childrenResponseSizeChange2 = page.waitForResponse(
      '/api/v1/containers/name/*/children?limit=15&offset=0'
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('15 / Page').click();
    await childrenResponseSizeChange2;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2'
    );
  });

  test(
    'expand / collapse should not appear after updating nested fields for container',
    PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
    async ({ page }) => {
      await page.goto('/container/s3_storage_sample.departments.finance');

      await waitForAllLoadersToDisappear(page);

      await assignTagToChildren({
        page,
        tag: 'PersonalData.Personal',
        rowId: 's3_storage_sample.departments.finance.budget_executor',
        entityEndpoint: 'containers',
      });

      // Should not show expand icon for non-nested columns
      expect(
        page
          .locator(
            '[data-row-key="s3_storage_sample.departments.finance.budget_executor"]'
          )
          .getByTestId('expand-icon')
      ).not.toBeVisible();

      await removeTagsFromChildren({
        page,
        tags: ['PersonalData.Personal'],
        rowId: 's3_storage_sample.departments.finance.budget_executor',
        entityEndpoint: 'containers',
      });
    }
  );

  test('Copy column link button should copy the column URL to clipboard', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await testCopyLinkButton({
      page,
      buttonTestId: 'copy-column-link-button',
      containerTestId: 'container-data-model-table',
      expectedUrlPath: '/container/',
      entityFqn: container.entityResponseData?.['fullyQualifiedName'] ?? '',
    });
  });

  test('Copy column link should have valid URL format', async ({
    dataConsumerPage: page,
  }) => {
    await container.visitEntityPage(page);
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(page.getByTestId('container-data-model-table')).toBeVisible();

    const copyButton = page.getByTestId('copy-column-link-button').first();
    await expect(copyButton).toBeVisible();

    const clipboardText = await copyAndGetClipboardText(page, copyButton);

    const validationResult = validateCopiedLinkFormat({
      clipboardText,
      expectedEntityType: 'container',
      entityFqn: container.entityResponseData?.['fullyQualifiedName'] ?? '',
    });

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.protocol).toMatch(/^https?:$/);
    expect(validationResult.pathname).toContain('container');

    // Visit the copied link to verify it opens the side panel
    await page.goto(clipboardText);

    // Verify side panel is open
    const sidePanel = page.locator('.column-detail-panel');
    await expect(sidePanel).toBeVisible();

    // Verify the correct column is showing in the panel
    const columnName = (container.entityResponseData as any)?.dataModel
      ?.columns?.[0]?.name;
    if (columnName) {
      await expect(sidePanel).toContainText(columnName);
    }

    // Close side panel
    await page.getByTestId('close-button').click();
    await expect(sidePanel).not.toBeVisible();

    // Verify URL does not contain the column part
    await expect(page).toHaveURL(
      new RegExp(
        `/container/${container.entityResponseData?.['fullyQualifiedName']}$`
      )
    );
  });
});
