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
import { test as base, expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { MetricClass } from '../../support/entity/MetricClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';

const metric1 = new MetricClass();
const metric2 = new MetricClass();
const metric3 = new MetricClass();

// use the admin user to login
const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Metric Entity Special Test Cases', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  test.slow(true);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);

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

  test('Metric creation flow should work', async ({ page }) => {
    const listAPIPromise = page.waitForResponse(
      '/api/v1/metrics?fields=owners%2Ctags&limit=15&include=all'
    );

    await sidebarClick(page, SidebarItem.METRICS);

    await listAPIPromise;

    await expect(page.getByTestId('heading')).toHaveText('Metrics');
    await expect(page.getByTestId('sub-heading')).toHaveText(
      'Define and catalog standardized metrics across your organization.'
    );

    await page.getByTestId('create-metric').click();

    await addMetric(page);
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
