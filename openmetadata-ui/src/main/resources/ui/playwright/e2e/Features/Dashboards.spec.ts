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
import {
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ,
} from '../../constant/config';
import { BIG_ENTITY_DELETE_TIMEOUT } from '../../constant/delete';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { performAdminLogin } from '../../utils/admin';
import {
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  assignTagToChildren,
  generateEntityChildren,
  removeTagsFromChildren,
  restoreEntity,
} from '../../utils/entity';
import { test } from '../fixtures/pages';

const dashboardEntity = new DashboardServiceClass();
const dashboard = new DashboardClass();

test.describe('Dashboards', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    const dashboardChildren = generateEntityChildren('dashboard', 25);

    await dashboardEntity.create(apiContext, dashboardChildren);

    await afterAction();
  });

  test.afterAll('Clean up', async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    await dashboardEntity.delete(apiContext);
    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ dataConsumerPage: page }) => {
    await redirectToHomePage(page);
  });

  test(`should change the page size`, async ({ dataConsumerPage: page }) => {
    await dashboardEntity.visitEntityPage(page);

    await page.getByRole('tab', { name: 'Dashboards' }).click();

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('pagination')).toBeVisible();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 2 '
    );

    // Check the page sizing change
    const childrenResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/dashboards') &&
        res.url().includes('limit=25')
    );
    await page.getByTestId('page-size-selection-dropdown').click();
    await page.getByText('25 / Page').click();
    await childrenResponse;

    await page.waitForSelector('.ant-spin', {
      state: 'detached',
    });

    await expect(page.getByTestId('next')).toBeDisabled();
    await expect(page.getByTestId('previous')).toBeDisabled();
    await expect(page.getByTestId('page-indicator')).toContainText(
      'Page 1 of 1'
    );
  });
});

test.describe(
  'Dashboard and Charts deleted toggle',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.slow(true);

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await dashboard.create(apiContext);

      await afterAction();
    });

    test.afterAll('Clean up', async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      await dashboard.delete(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit home page', async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('should be able to toggle between deleted and non-deleted charts', async ({
      page,
    }) => {
      await dashboard.visitEntityPage(page);
      await page.waitForLoadState('networkidle');

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await page.click('[data-testid="manage-button"]');
      await page.click('[data-testid="delete-button"]');

      await page.waitForSelector('[role="dialog"].ant-modal');

      await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

      await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
      const deleteResponse = page.waitForResponse(
        `/api/v1/${EntityTypeEndpoint.Dashboard}/async/*?hardDelete=false&recursive=true`
      );
      await page.click('[data-testid="confirm-button"]');

      await deleteResponse;
      await page.waitForLoadState('networkidle');

      await toastNotification(
        page,
        /(deleted successfully!|Delete operation initiated)/,
        BIG_ENTITY_DELETE_TIMEOUT
      );

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      // Retry mechanism for checking deleted badge
      let deletedBadge = page.locator('[data-testid="deleted-badge"]');
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        const isVisible = await deletedBadge.isVisible();
        if (isVisible) {
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          await page.reload();
          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });
          deletedBadge = page.locator('[data-testid="deleted-badge"]');
        }
      }

      await expect(deletedBadge).toHaveText('Deleted');
      await expect(
        page.getByTestId('charts-table').getByTestId('no-data-placeholder')
      ).toBeVisible();

      await page.getByTestId('show-deleted').click();

      await expect(
        page.getByTestId('charts-table').getByTestId('no-data-placeholder')
      ).not.toBeVisible();

      await restoreEntity(page);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      await expect(
        page.getByTestId('charts-table').getByTestId('no-data-placeholder')
      ).toBeVisible();

      await page.getByTestId('show-deleted').click();

      await expect(
        page.getByTestId('charts-table').getByTestId('no-data-placeholder')
      ).not.toBeVisible();
    });
  }
);

test.describe('Data Model', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, () => {
  test('expand / collapse should not appear after updating nested fields for dashboardDataModels', async ({
    page,
  }) => {
    await page.goto(
      '/dashboardDataModel/sample_superset.model.big_analytics_data_model_with_nested_columns'
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    await assignTagToChildren({
      page,
      tag: 'PersonalData.Personal',
      rowId:
        'sample_superset.model.big_analytics_data_model_with_nested_columns.revenue_metrics_0031',
      entityEndpoint: 'dashboard/datamodels',
    });

    // Should not show expand icon for non-nested columns
    expect(
      page
        .locator(
          '[data-row-key="sample_superset.model.big_analytics_data_model_with_nested_columns.revenue_metrics_0031"]'
        )
        .getByTestId('expand-icon')
    ).not.toBeVisible();

    await removeTagsFromChildren({
      page,
      tags: ['PersonalData.Personal'],
      rowId:
        'sample_superset.model.big_analytics_data_model_with_nested_columns.revenue_metrics_0031',
      entityEndpoint: 'dashboard/datamodels',
    });
  });
});

test.describe(
  'Data Model with special characters in name',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    const uniqueId = uuid();
    const serviceNameWithDot = `pw.dashboard.service-${uniqueId}`;
    const dataModelName = `pw-data-model-${uniqueId}`;
    let serviceResponseData: { fullyQualifiedName: string };
    let dataModelResponseData: { fullyQualifiedName: string; name: string };

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const serviceResponse = await apiContext.post(
        '/api/v1/services/dashboardServices',
        {
          data: {
            name: serviceNameWithDot,
            serviceType: 'PowerBI',
            connection: {
              config: {
                type: 'PowerBI',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                tenantId: 'test-tenant-id',
              },
            },
          },
        }
      );

      expect(serviceResponse.ok()).toBeTruthy();

      serviceResponseData = await serviceResponse.json();

      const dataModelResponse = await apiContext.post(
        '/api/v1/dashboard/datamodels',
        {
          data: {
            name: dataModelName,
            displayName: dataModelName,
            description: `Data model for service with dots in name`,
            service: serviceNameWithDot,
            columns: [
              {
                name: 'column_1',
                dataType: 'VARCHAR',
                dataLength: 256,
                dataTypeDisplay: 'varchar',
                description: 'Test column',
              },
            ],
            dataModelType: 'PowerBIDataModel',
          },
        }
      );

      expect(dataModelResponse.ok()).toBeTruthy();

      dataModelResponseData = await dataModelResponse.json();

      await afterAction();
    });

    test.afterAll('Clean up', async ({ browser }) => {
      const { afterAction, apiContext } = await performAdminLogin(browser);

      await apiContext.delete(
        `/api/v1/services/dashboardServices/name/${encodeURIComponent(
          serviceResponseData.fullyQualifiedName
        )}?recursive=true&hardDelete=true`
      );

      await afterAction();
    });

    test('should display data model when service name contains dots', async ({
      page,
    }) => {
      await page.goto(
        `/service/dashboardServices/${encodeURIComponent(
          serviceNameWithDot
        )}/data-model`
      );

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'hidden' });

      await page.waitForSelector('.ant-spin', {
        state: 'detached',
      });

      const dataModelLink = page.getByTestId(
        `data-model-${dataModelResponseData.name}`
      );

      await expect(dataModelLink).toBeVisible();
      await expect(dataModelLink).toHaveText(dataModelResponseData.name);

      await dataModelLink.click();
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('entity-header-name')).toContainText(
        dataModelName
      );
    });
  }
);
