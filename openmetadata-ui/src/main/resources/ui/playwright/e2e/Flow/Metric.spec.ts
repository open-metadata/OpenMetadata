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
import { expect, Page, test as base } from '@playwright/test';
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

const metric1 = new MetricClass();
const metric2 = new MetricClass();
const metric3 = new MetricClass();
const metric4 = new MetricClass();
const metric5 = new MetricClass();

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

test.describe('Metric Entity Special Test Cases', () => {
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
    await metric1.visitEntityPageWithCustomSearchBox(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);

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

test.describe('Listing page and add Metric flow should work', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);

    await Promise.all([metric4.create(apiContext), metric5.create(apiContext)]);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);

    await Promise.all([metric4.delete(apiContext), metric5.delete(apiContext)]);

    await afterAction();
  });

  test('Metric listing page and add metric from the "Add button"', async ({
    page,
  }) => {
    test.slow(true);

    const listAPIPromise = page.waitForResponse(
      '/api/v1/metrics?fields=owners%2Ctags&limit=15&include=all'
    );

    await sidebarClick(page, SidebarItem.METRICS);

    await listAPIPromise;

    await expect(page.getByTestId('heading')).toHaveText('Metrics');
    await expect(page.getByTestId('sub-heading')).toHaveText(
      'Track the health of your data assets with metrics.'
    );

    const pageSizeDropdown = page.getByTestId('page-size-selection-dropdown');
    if (await pageSizeDropdown.isVisible()) {
      await pageSizeDropdown.click();
      await page.getByText('25 / Page').click();
    }

    await expect(
      page.getByRole('cell', { name: 'Name', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Description', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Tags', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Glossary Terms', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Owners', exact: true })
    ).toBeVisible();

    // check for metric entities in table
    await expect(
      page.getByRole('row', {
        name: `${metric4.entity.name} ${metric4.entity.description} -- -- No Owner`,
      })
    ).toBeVisible();

    await expect(
      page.getByRole('row', {
        name: `${metric5.entity.name} ${metric5.entity.description} -- -- No Owner`,
      })
    ).toBeVisible();

    await page.getByTestId('create-metric').click();

    await addMetric(page);
  });
});
