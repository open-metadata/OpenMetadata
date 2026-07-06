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
import { expect, Locator, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import {
  clickOutside,
  descriptionBox,
  redirectToHomePage,
  uuid,
  waitForMetricsSearchResponse,
} from '../../utils/common';
import {
  removeUnitOfMeasurement,
  updateUnitOfMeasurement,
} from '../../utils/metric';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const selectMetricFormOption = async (
  page: Page,
  field: Locator,
  input: Locator,
  title: string
) => {
  await input.click();
  await input.fill(title);

  const option = page
    .locator('.ant-select-dropdown:visible')
    .getByTitle(title, { exact: true });

  await expect(option).toBeVisible();
  // eslint-disable-next-line playwright/no-force-option -- Ant select option can be obscured during page scroll.
  await option.click({ force: true });
  await expect(field).toContainText(title);
};

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
        const listAPIPromise = waitForMetricsSearchResponse(page);
        await sidebarClick(page, SidebarItem.METRICS);
        await listAPIPromise;

        // Click Add Metric button and create metric using existing utility
        await page.getByTestId('create-metric').click();

        // Use a simplified metric creation approach
        const metricName = `test-unit-metric-${uuid()}`;

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
        await selectMetricFormOption(
          page,
          page.getByTestId('granularity'),
          page.getByTestId('granularity').locator('input'),
          'Quarter'
        );

        // Select metric type
        await selectMetricFormOption(
          page,
          page.getByTestId('metricType'),
          page.getByTestId('metricType').locator('input'),
          'Sum'
        );

        await clickOutside(page);

        // Select unit of measurement (use Bytes as initial unit)
        await selectMetricFormOption(
          page,
          page.getByTestId('unitOfMeasurement'),
          page.getByTestId('unitOfMeasurement').locator('input'),
          'Events'
        );
        await clickOutside(page);

        // Select language and add expression
        await selectMetricFormOption(
          page,
          page.getByTestId('language'),
          page.getByTestId('language').locator('input'),
          'SQL'
        );

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

      await test.step('Verify initial unit of measurement is displayed', async () => {
        await expect(
          page.getByTestId('data-asset-header-metadata').getByText('EVENTS')
        ).toBeVisible();
      });

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
        await page.locator('[role="dialog"].ant-modal').waitFor();

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
