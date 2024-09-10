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
import { test } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { MetricClass } from '../../support/entity/MetricClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  addMetric,
  removeGranularity,
  removeMetricType,
  removeUnitOfMeasurement,
  updateExpression,
  updateGranularity,
  updateMetricType,
  updateRelatedMetric,
  updateUnitOfMeasurement,
} from '../../utils/metric';
import { sidebarClick } from '../../utils/sidebar';

const metric1 = new MetricClass();
const metric2 = new MetricClass();
const metric3 = new MetricClass();

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Metric Entity Special Test Cases', () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await Promise.all([
      metric1.create(apiContext),
      metric2.create(apiContext),
      metric3.create(apiContext),
    ]);

    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
    await metric1.visitEntityPage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await Promise.all([
      metric1.delete(apiContext),
      metric2.delete(apiContext),
      metric3.delete(apiContext),
    ]);

    await afterAction();
  });

  test('Verify Metric Type Update', async ({ page }) => {
    await updateMetricType(page, 'Count');
    await removeMetricType(page);
    await updateMetricType(page, 'Count');
  });

  test('Verify Unit of Measurement Update', async ({ page }) => {
    await updateUnitOfMeasurement(page, 'Dollars');
    await removeUnitOfMeasurement(page);
    await updateUnitOfMeasurement(page, 'Dollars');
  });

  test('Verify Granularity Update', async ({ page }) => {
    await updateGranularity(page, 'Quarter');
    await removeGranularity(page);
    await updateGranularity(page, 'Month');
  });

  test('verify metric expression update', async ({ page }) => {
    await updateExpression(page, 'JavaScript', 'SUM(sales)');
    await updateExpression(page, 'SQL', 'SUM(sales)');
  });

  test('Verify Related Metrics Update', async ({ page }) => {
    await updateRelatedMetric(page, metric2, metric1.entity.name, 'add');
    await updateRelatedMetric(page, metric3, metric1.entity.name, 'update');
  });
});

test.describe('Add Metric flow should work', () => {
  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.METRICS);
  });

  test('Add metric from the "Add button"', async ({ page }) => {
    test.slow(true);

    await page.getByTestId('create-metric').click();

    await addMetric(page);
  });
});
