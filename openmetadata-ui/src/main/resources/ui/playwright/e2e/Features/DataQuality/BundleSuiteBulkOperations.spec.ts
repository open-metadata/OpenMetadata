/*
 *  Copyright 2026 Collate.
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
import { BundleTestSuiteClass } from '../../../support/entity/BundleTestSuiteClass';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, redirectToHomePage, uuid } from '../../../utils/common';
import {
  fillAndSubmitBundleSuiteForm,
  navigateToDataQualityTestCases,
  openAddToExistingBundleSuiteModal,
  openCreateNewBundleSuiteForm,
  selectExistingBundleSuite,
  selectTestCasesByCheckbox,
  submitAddToExistingBundleSuite,
  verifyBundleSuitePageLoaded,
  verifyTestCaseSelectionCount,
} from '../../../utils/dataQuality';
import { test } from '../../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

let table1: TableClass;
let table2: TableClass;
const bundleTestSuite = new BundleTestSuiteClass();
let bundleSuiteName: string;
let existingBundleSuiteName: string;

test.beforeAll(async ({ browser }) => {
  table1 = new TableClass();
  table2 = new TableClass();
  const { apiContext, afterAction } = await createNewPage(browser);

  await table1.create(apiContext);
  await table2.create(apiContext);

  await table1.createTestCase(apiContext, {
    name: `test_column_values_not_null_${uuid()}`,
    entityLink: `<#E::table::${table1.entityResponseData?.['fullyQualifiedName']}::columns::${table1.entity?.columns[0].name}>`,
    parameterValues: [],
    testDefinition: 'columnValuesToBeNotNull',
  });

  await table1.createTestCase(apiContext, {
    name: `test_column_values_unique_${uuid()}`,
    entityLink: `<#E::table::${table1.entityResponseData?.['fullyQualifiedName']}::columns::${table1.entity?.columns[0].name}>`,
    parameterValues: [],
    testDefinition: 'columnValuesToBeUnique',
  });

  await table2.createTestCase(apiContext, {
    name: `test_table_row_count_${uuid()}`,
    entityLink: `<#E::table::${table2.entityResponseData?.['fullyQualifiedName']}>`,
    parameterValues: [{ name: 'value', value: '100' }],
    testDefinition: 'tableRowCountToEqual',
  });

  await bundleTestSuite.createBundleTestSuite(apiContext);

  bundleSuiteName = `bundle_suite_${uuid()}`;
  existingBundleSuiteName =
    bundleTestSuite.bundleTestSuiteResponseData?.name ?? '';

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Create new Bundle Suite with bulk selected test cases', async ({
  page,
}) => {
  await test.step('Navigate and select test case', async () => {
    await navigateToDataQualityTestCases(page);
    await selectTestCasesByCheckbox(page, 1);
    await verifyTestCaseSelectionCount(page, 1);
  });

  await test.step('Open create bundle suite form', async () => {
    await openCreateNewBundleSuiteForm(page);
  });

  await test.step('Fill form and create bundle suite', async () => {
    await fillAndSubmitBundleSuiteForm(page, bundleSuiteName);
  });

  await test.step('Verify bundle suite created with test case', async () => {
    await verifyBundleSuitePageLoaded(page, bundleSuiteName, 1);
  });
});

test('Add test case to existing Bundle Suite', async ({ page }) => {
  await test.step('Navigate and select test case', async () => {
    await navigateToDataQualityTestCases(page);
    await selectTestCasesByCheckbox(page, 1);
    await verifyTestCaseSelectionCount(page, 1);
  });

  await test.step('Add to existing bundle suite', async () => {
    await openAddToExistingBundleSuiteModal(page);
    await selectExistingBundleSuite(page, existingBundleSuiteName);
    await submitAddToExistingBundleSuite(page);
  });

  await test.step('Verify test case added to bundle suite', async () => {
    await verifyBundleSuitePageLoaded(page, existingBundleSuiteName, 1);
  });
});

test('Bulk selection operations', async ({ page }) => {
  await navigateToDataQualityTestCases(page);

  await test.step('Verify button not visible when no selection', async () => {
    await expect(
      page.getByTestId('add-selected-to-bundle-suite')
    ).not.toBeVisible();
  });

  await test.step('Select test cases and verify button appears', async () => {
    await selectTestCasesByCheckbox(page, 2);
    await verifyTestCaseSelectionCount(page, 2);
  });

  await test.step('Clear selection and verify button hidden', async () => {
    await page.getByTestId('bulk-clear-test-case-selection').click();
    await expect(
      page.getByTestId('add-selected-to-bundle-suite')
    ).not.toBeVisible();
  });

  await test.step('Select all and unselect all', async () => {
    const selectAllCheckbox = page
      .locator('thead input[type="checkbox"]')
      .first();
    await selectAllCheckbox.check();
    await expect(page.getByText(/\d+ test case\(s\) selected/)).toBeVisible();
    await expect(
      page.getByTestId('add-selected-to-bundle-suite')
    ).toBeVisible();

    await selectAllCheckbox.uncheck();
    await expect(
      page.getByTestId('add-selected-to-bundle-suite')
    ).not.toBeVisible();
  });
});
