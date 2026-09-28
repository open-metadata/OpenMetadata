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
import { Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { expect, test } from '../../support/fixtures/base';
import {
  redirectToHomePage,
  uuid,
  waitForMetricsListingResponse,
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
  fieldTestId: string,
  title: string
) => {
  const field = page.getByTestId(fieldTestId);
  await field.getByRole('button').click();
  await page.getByRole('option', { exact: true, name: title }).click();
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
        const listAPIPromise = waitForMetricsListingResponse(page);
        await sidebarClick(page, SidebarItem.METRICS);
        await listAPIPromise;

        // Click Add Metric button and create metric using existing utility
        await page.getByTestId('create-metric').click();

        // Use a simplified metric creation approach
        const metricName = `test-unit-metric-${uuid()}`;

        // Click create to trigger validation
        await page.getByTestId('create-button').click();

        await expect(page.getByText('Name is required')).toBeVisible();

        // Fill required fields only
        await page.getByTestId('name').fill(metricName);
        await page.getByTestId('display-name').fill(metricName);

        // Fill description
        await page
          .getByRole('textbox', { exact: true, name: 'Description' })
          .fill(`Test metric for unit testing ${metricName}`);

        // Select granularity
        await selectMetricFormOption(page, 'granularity-select', 'Quarter');

        // Select metric type
        await selectMetricFormOption(page, 'metric-type-select', 'Sum');

        // Select unit of measurement (use Bytes as initial unit)
        await selectMetricFormOption(
          page,
          'unit-of-measurement-select',
          'Events'
        );

        await page
          .getByTestId('metric-code')
          .getByRole('textbox')
          .fill('SELECT SUM(amount) FROM sales');

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
        await expect(page.getByTestId('metric-definition-unit')).toContainText(
          'Events'
        );
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
        await page.getByTestId('delete-modal').waitFor();

        await expect(page.getByTestId('delete-modal')).toBeVisible();

        await page.click('[data-testid="hard-delete"]');

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
