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
import { redirectToHomePage, uuid } from '../../utils/common';
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

const S3_SERVICE_CONFIG = {
  serviceType: 'S3',
  connection: {
    config: {
      type: 'S3',
      awsConfig: {
        awsAccessKeyId: 'admin',
        awsSecretAccessKey: 'key',
        awsRegion: 'us-east-2',
        assumeRoleSessionName: 'OpenMetadataSession',
      },
      supportsMetadataExtraction: true,
    },
  },
};

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
      await expect(
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

    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

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
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

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
    const columnName =
      container.entityResponseData?.dataModel?.columns?.[0]?.name;
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
test.describe('Deeply nested container navigation', () => {
  const serviceName = `pw-storage-service-deep-${uuid()}`;
  const deepContainer1Name = `pw-container-l1-${uuid()}`;
  const deepContainer2Name = `pw-container-l2-${uuid()}`;
  const deepContainer3Name = `pw-container-l3-${uuid()}`;
  const deepContainer4Name = `pw-container-l4-${uuid()}`;

  let deepContainer1Id = '';
  let deepContainer2Id = '';
  let deepContainer3Id = '';
  let deepContainer2Fqn = '';
  let deepContainer3Fqn = '';
  let deepContainer4Fqn = '';

  test.beforeAll('Setup deeply nested containers', async ({ browser }) => {
    test.slow(true);
    const { afterAction, apiContext } = await performAdminLogin(browser);

    const serviceRes = await apiContext.post(
      '/api/v1/services/storageServices',
      {
        data: {
          name: serviceName,
          ...S3_SERVICE_CONFIG,
        },
      }
    );
    await serviceRes.json();

    const container1Res = await apiContext.post('/api/v1/containers', {
      data: { name: deepContainer1Name, service: serviceName },
    });
    const containerLevel1 = await container1Res.json();
    deepContainer1Id = containerLevel1.id;

    const container2Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer2Name,
        service: serviceName,
        parent: { id: deepContainer1Id, type: 'container' },
      },
    });
    const containerLevel2 = await container2Res.json();
    deepContainer2Id = containerLevel2.id;
    deepContainer2Fqn = containerLevel2.fullyQualifiedName;

    const container3Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer3Name,
        service: serviceName,
        parent: { id: deepContainer2Id, type: 'container' },
      },
    });
    const containerLevel3 = await container3Res.json();
    deepContainer3Id = containerLevel3.id;
    deepContainer3Fqn = containerLevel3.fullyQualifiedName;

    const container4Res = await apiContext.post('/api/v1/containers', {
      data: {
        name: deepContainer4Name,
        service: serviceName,
        parent: { id: deepContainer3Id, type: 'container' },
      },
    });
    const containerLevel4 = await container4Res.json();
    deepContainer4Fqn = containerLevel4.fullyQualifiedName;

    await afterAction();
  });

  test.afterAll('Clean up deeply nested containers', async ({ browser }) => {
    test.slow(true);
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await apiContext.delete(
      `/api/v1/services/storageServices/name/${encodeURIComponent(
        serviceName
      )}?recursive=true&hardDelete=true`
    );

    await afterAction();
  });

  test('should correctly load, display breadcrumbs, and navigate deeply nested containers', async ({
    page,
  }) => {
    const initialContainerResponse = page.waitForResponse(
      '/api/v1/containers/name/*'
    );
    await page.goto(`/container/${deepContainer4Fqn}`);
    await initialContainerResponse;
    await waitForAllLoadersToDisappear(page);

    await test.step('correct container loads for 5-part FQN (4 nesting levels)', async () => {
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer4Name
      );
    });

    await test.step('breadcrumb shows all 4 ancestor levels at L4', async () => {
      const breadcrumb = page.getByTestId('breadcrumb');

      await expect(breadcrumb).toContainText(serviceName);
      await expect(breadcrumb).toContainText(deepContainer1Name);
      await expect(breadcrumb).toContainText(deepContainer2Name);
      await expect(breadcrumb).toContainText(deepContainer3Name);
    });

    await test.step('clicking L3 breadcrumb link navigates to L3 and updates page', async () => {
      const containerResponse = page.waitForResponse(
        '/api/v1/containers/name/*'
      );
      await page
        .getByTestId('breadcrumb')
        .getByRole('link', { name: deepContainer3Name })
        .click();
      await containerResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        new RegExp(`/container/${deepContainer3Fqn}$`)
      );
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer3Name
      );

      const breadcrumb = page.getByTestId('breadcrumb');
      await expect(breadcrumb).toContainText(serviceName);
      await expect(breadcrumb).toContainText(deepContainer1Name);
      await expect(breadcrumb).toContainText(deepContainer2Name);
      await expect(breadcrumb).not.toContainText(deepContainer4Name);
    });

    await test.step('clicking L2 breadcrumb link navigates to L2 and updates page', async () => {
      const containerResponse = page.waitForResponse(
        '/api/v1/containers/name/*'
      );
      await page
        .getByTestId('breadcrumb')
        .getByRole('link', { name: deepContainer2Name })
        .click();
      await containerResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(page).toHaveURL(
        new RegExp(`/container/${deepContainer2Fqn}$`)
      );
      await expect(page.getByTestId('entity-header-name')).toContainText(
        deepContainer2Name
      );

      const breadcrumb = page.getByTestId('breadcrumb');
      await expect(breadcrumb).toContainText(serviceName);
      await expect(breadcrumb).toContainText(deepContainer1Name);
      await expect(breadcrumb).not.toContainText(deepContainer3Name);
      await expect(breadcrumb).not.toContainText(deepContainer4Name);
    });
  });
});
