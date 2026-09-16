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
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

const emptyTable = new TableClass();
const testSuiteTable = new TableClass();

test.describe('Asset Health widget', () => {
  test.beforeAll('Create the tables under test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await emptyTable.create(apiContext);
    await testSuiteTable.create(apiContext);
    const testCase = await testSuiteTable.createTestCase(apiContext);
    await testSuiteTable.addTestCaseResult(
      apiContext,
      testCase.fullyQualifiedName,
      {
        result: 'Asset health widget fixture',
        testCaseStatus: 'Success',
        timestamp: Date.now(),
      }
    );
    await afterAction();
  });

  test.afterAll('Remove the tables under test', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await emptyTable.delete(apiContext);
    await testSuiteTable.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('renders the widget with all four category rows', async ({ page }) => {
    await testSuiteTable.visitEntityPage(page);

    await expect(page.getByTestId('asset-health-widget')).toBeVisible();
    await expect(page.getByTestId('asset-health-row-pipeline')).toBeVisible();
    await expect(
      page.getByTestId('asset-health-row-dataQuality')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-row-dataObservability')
    ).toBeVisible();
    await expect(page.getByTestId('asset-health-row-contract')).toBeVisible();
  });

  test('shows setup CTAs for unconfigured categories', async ({ page }) => {
    await emptyTable.visitEntityPage(page);

    await expect(page.getByTestId('asset-health-widget')).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataQuality')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataObservability')
    ).toBeVisible();
    await expect(page.getByTestId('asset-health-cta-contract')).toBeVisible();
  });

  test('Add tests CTA navigates to the Profiler tab', async ({ page }) => {
    await emptyTable.visitEntityPage(page);

    await page.getByTestId('asset-health-cta-dataQuality').click();

    await expect(page).toHaveURL(/\/table\/.*\/profiler/);
  });

  test('Enable observability CTA navigates to the Profiler tab', async ({
    page,
  }) => {
    await emptyTable.visitEntityPage(page);

    await page.getByTestId('asset-health-cta-dataObservability').click();

    await expect(page).toHaveURL(/\/table\/.*\/profiler/);
  });

  test('Create contract CTA navigates to the Contract tab', async ({
    page,
  }) => {
    await emptyTable.visitEntityPage(page);

    await page.getByTestId('asset-health-cta-contract').click();

    await expect(page).toHaveURL(/\/table\/.*\/contract/);
  });

  test('replaces the setup CTAs with status badges once tests are configured', async ({
    page,
  }) => {
    await testSuiteTable.visitEntityPage(page);

    await expect(
      page.getByTestId('asset-health-row-dataObservability')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-row-dataQuality')
    ).toBeVisible();
    await expect(
      page.getByTestId('asset-health-cta-dataObservability')
    ).toBeHidden();
    await expect(page.getByTestId('asset-health-cta-dataQuality')).toBeHidden();
  });
});
