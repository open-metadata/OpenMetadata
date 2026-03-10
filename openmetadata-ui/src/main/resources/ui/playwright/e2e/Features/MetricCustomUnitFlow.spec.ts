/*
 *  Copyright 2024 Collate.
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
import { expect, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import {
  clickOutside,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import {
  removeUnitOfMeasurement,
  updateUnitOfMeasurement,
} from '../../utils/metric';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe(
  'Metric Custom Unit of Measurement Flow',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('Should create metric and test unit of measurement updates', async ({
      page,
    }) => {
      await redirectToHomePage(page);

      await test.step('Navigate to Metrics and create a metric', async () => {
        // Navigate to Metrics
        await sidebarClick(page, SidebarItem.METRICS);

        const listAPIPromise = page.waitForResponse(
          '/api/v1/metrics?fields=owners%2Ctags&limit=15&include=all'
        );
        await listAPIPromise;

        // Click Add Metric button and create metric using existing utility
        await page.getByTestId('create-metric').click();

        // Use a simplified metric creation approach
        const metricName = `test-unit-metric-${Date.now()}`;

        // Click create to trigger validation
        await page.getByTestId('create-button').click();

        await expect(page.locator('#name_help')).toHaveText('Name is required');

        // Fill required fields only
        await page.locator('#root\\/name').fill(metricName);
        await page.locator('#root\\/displayName').fill(metricName);

        // Fill description
        await page
          .locator(descriptionBox)
          .fill(`Test metric for unit testing ${metricName}`);

        // Select granularity
        await page.getByTestId('granularity').locator('input').fill('Quarter');
        await page.getByTitle('Quarter', { exact: true }).click();

        // Select metric type
        await page.getByTestId('metricType').locator('input').fill('Sum');
        await page.getByTitle('Sum', { exact: true }).click();

        await clickOutside(page);

        // Select unit of measurement (use Bytes as initial unit)
        await page
          .getByTestId('unitOfMeasurement')
          .locator('input')
          .fill('Events');
        await page.getByTitle('Events', { exact: true }).click();
        await clickOutside(page);

        // Select language and add expression
        await page.getByTestId('language').locator('input').fill('SQL');
        await page.getByTitle('SQL', { exact: true }).click();

        await clickOutside(page);

        await page.locator("pre[role='presentation']").last().click();
        await page.keyboard.type('SELECT SUM(amount) FROM sales');

        // Save the metric
        const postPromise = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            response.url().includes('/api/v1/metrics')
        );

        const getPromise = page.waitForResponse((response) =>
          response.url().includes(`/api/v1/metrics/name/${metricName}`)
        );

        await page.getByTestId('create-button').click();
        await postPromise;
        await getPromise;

        // Verify creation
        await expect(
          page.getByTestId('entity-header-display-name')
        ).toContainText(metricName);
      });

      await test.step(
        'Verify initial unit of measurement is displayed',
        async () => {
          await expect(
            page.getByTestId('data-asset-header-metadata').getByText('EVENTS')
          ).toBeVisible();
        }
      );

      await test.step('Update unit of measurement to Dollars', async () => {
        await updateUnitOfMeasurement(page, 'Dollars');
      });

      await test.step('Remove unit of measurement', async () => {
        await removeUnitOfMeasurement(page);
      });

      await test.step('Set unit back to Percentage', async () => {
        await updateUnitOfMeasurement(page, 'Percentage');
      });

      await test.step('Clean up - delete the metric', async () => {
        await page.getByTestId('manage-button').click();
        await page.getByTestId('delete-button').click();
        await page.waitForSelector('[role="dialog"].ant-modal');

        await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

        await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

        const deletePromise = page.waitForResponse(
          (response) =>
            response.request().method() === 'DELETE' &&
            response.url().includes('/api/v1/metrics/')
        );

        await page.click('[data-testid="confirm-button"]');

        await deletePromise;
      });
    });
  }
);
