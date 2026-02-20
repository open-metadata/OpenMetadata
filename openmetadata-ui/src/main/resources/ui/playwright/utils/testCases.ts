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
import { expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { TableClass } from '../support/entity/TableClass';
import { toastNotification } from './common';
import { fillTagDetails, pressKeyXTimes } from './importUtils';

export const deleteTestCase = async (page: Page, testCaseName: string) => {
  await page.getByTestId(`action-dropdown-${testCaseName}`).click();
  await page.getByTestId(`delete-${testCaseName}`).click();
  await page.fill('#deleteTextInput', 'DELETE');

  await expect(page.getByTestId('confirm-button')).toBeEnabled();

  const deleteResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/*?hardDelete=true&recursive=true'
  );
  await page.getByTestId('confirm-button').click();
  await deleteResponse;

  await toastNotification(page, /deleted successfully!/);
};

export const visitDataQualityTab = async (page: Page, table: TableClass) => {
  await table.visitEntityPage(page);
  await page.getByTestId('profiler').click();
  const testCaseResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list?*fields=*'
  );
  await page.getByRole('tab', { name: 'Data Quality' }).click();
  await testCaseResponse;
};

export const verifyIncidentBreadcrumbsFromTablePageRedirect = async (
  page: Page,
  table: TableClass,
  testCaseName: string
) => {
  await page
    .getByRole('link', {
      name: testCaseName,
    })
    .click();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });

  const { service, database, databaseSchema, displayName } =
    table.entityResponseData;

  if (!service || !database || !databaseSchema) {
    throw new Error(
      `Table metadata (service, database, or databaseSchema) is missing for ${table.entity.name}`
    );
  }

  await expect(page.getByTestId('breadcrumb-link').nth(0)).toHaveText(
    `${service.displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(1)).toHaveText(
    `${database.displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(2)).toHaveText(
    `${databaseSchema.displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(3)).toHaveText(
    `${displayName}/`
  );

  await page.getByTestId('breadcrumb-link').nth(3).click();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

export const findSystemTestDefinition = async (page: Page) => {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testDefinitions') &&
      response.request().method() === 'GET'
  );

  await page.goto('/test-library');
  let response = await responsePromise;
  let data = await response.json();

  while (true) {
    const systemTest = data.data.find(
      (def: { provider: string }) => def.provider === 'system'
    );

    if (systemTest) {
      return systemTest;
    }

    const nextButton = page.getByTestId('next');

    if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
      const nextResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/dataQuality/testDefinitions') &&
          response.request().method() === 'GET'
      );
      await nextButton.click();
      response = await nextResponsePromise;
      data = await response.json();
      await page.waitForSelector('[data-testid="test-definition-table"]', {
        state: 'visible',
      });
    } else {
      throw new Error('System test definition not found');
    }
  }
};

/**
 * Click the manage button in the Data Quality tab
 * @param page - Playwright page object
 * @param context - 'table' for table-level, 'global' for global data quality page, or 'testSuite' for test suite page
 */
export const clickManageButton = async (
  page: Page,
  context: 'table' | 'global' | 'testSuite' = 'table'
) => {
  if (context === 'table') {
    await page
      .getByTestId('table-profiler-container')
      .getByTestId('manage-button')
      .click();
  } else {
    await page.waitForSelector('[data-testid="manage-button"]', {
      state: 'visible',
    });
    await page.getByTestId('manage-button').click();
  }
};

/**
 * Navigate to a test suite details page
 * @param page - Playwright page object
 * @param testSuiteFqn - Fully qualified name of the test suite
 */
export const visitTestSuitePage = async (page: Page, testSuiteFqn: string) => {
  const testCaseListResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await page.goto(`/test-suites/${testSuiteFqn}`);
  await testCaseListResponse;
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await page.waitForSelector('[data-testid="manage-button"]', {
    state: 'visible',
  });
};

/**
 * Navigate to global data quality test cases page
 * @param page - Playwright page object
 */
export const navigateToGlobalDataQuality = async (page: Page) => {
  await page.goto('/data-quality/test-cases');
  await page.waitForSelector('[data-testid="manage-button"]');
};

/**
 * Perform complete export workflow for test cases
 * @param page - Playwright page object
 * @returns Download object from Playwright
 */
export const performTestCaseExport = async (page: Page) => {
  await expect(page.getByTestId('export-button')).toBeVisible();
  await page.getByTestId('export-button').click();
  await page.waitForSelector('#export-form', {
    state: 'visible',
  });
  await expect(page.locator('#export-form')).toBeVisible();
  await expect(page.locator('#submit-button')).not.toBeDisabled();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#submit-button').click();
  const download = await downloadPromise;

  return download;
};

/**
 * Navigate to import page and validate URL
 * @param page - Playwright page object
 * @param expectedUrlPattern - Expected URL pattern (default for table-level import)
 */
export const navigateToImportPage = async (
  page: Page,
  expectedUrlPattern: RegExp = /\/bulk\/import\/testCase/
) => {
  await expect(page.getByTestId('import-button')).toBeVisible();
  await page.getByTestId('import-button').click();
  await expect(page).toHaveURL(expectedUrlPattern);
};

/**
 * Upload CSV file and wait for processing
 * @param page - Playwright page object
 * @param filePath - Path to CSV file
 */
export const uploadCSVFile = async (page: Page, filePath: string) => {
  await page.waitForSelector('[type="file"]', { state: 'attached' });
  await page.setInputFiles('[type="file"]', filePath);
  await page.waitForSelector('[data-testid="upload-file-widget"]', {
    state: 'hidden',
    timeout: 10000,
  });
};

/**
 * Validate import grid is visible with all expected elements
 * @param page - Playwright page object
 */
export const validateImportGrid = async (page: Page) => {
  await expect(page.getByRole('grid')).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
  await expect(page.getByTestId('add-row-btn')).toBeVisible();
};

/**
 * Wait for async import response and proceed to validation
 * @param page - Playwright page object
 */
export const waitForImportAsyncResponse = async (page: Page) => {
  const asyncImportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/dataQuality/testCases/name') &&
      response.url().includes('importAsync') &&
      response.url().includes('dryRun=true') &&
      response.url().includes('recursive=true') &&
      response.request().method() === 'PUT'
  );
  await page.getByRole('button', { name: 'Next' }).click();
  await asyncImportResponse;
};

/**
 * Verify page access based on user permissions
 * @param page - Playwright page object
 * @param url - URL to navigate to
 * @param shouldHaveAccess - Whether user should have access (default: false for denied)
 */
export const verifyPageAccess = async (
  page: Page,
  url: string,
  shouldHaveAccess: boolean
) => {
  const permissionResponse = page.waitForResponse((response) =>
    response.url().includes('api/v1/permissions')
  );
  await page.goto(url);
  await permissionResponse;
  await page.waitForSelector("[data-testid='loader']", { state: 'detached' });

  if (shouldHaveAccess) {
    // Verify user has access - should stay on the page
    expect(page.url()).toContain(url);

    // Verify page loaded successfully (no 404 error)
    await expect(
      page.getByText('Page Not FoundThe page you')
    ).not.toBeVisible();
  } else {
    // Verify user is blocked - should be redirected to 404
    await page
      .getByText('Page Not FoundThe page you')
      .waitFor({ state: 'visible' });
    expect(page.url()).not.toContain(url);

    const currentUrl = page.url();
    const isRedirected = currentUrl.includes('404');
    expect(isRedirected).toBeTruthy();
  }
};

/**
 * Verify button visibility in manage menu
 * @param page - Playwright page object
 * @param buttons - Object specifying which buttons should be visible
 */
export const verifyButtonVisibility = async (
  page: Page,
  buttons: {
    export?: boolean;
    import?: boolean;
    bulkEdit?: boolean;
  }
) => {
  if (buttons.export !== undefined) {
    if (buttons.export) {
      await expect(page.getByTestId('export-button')).toBeVisible();
    } else {
      await expect(page.getByTestId('export-button')).not.toBeVisible();
    }
  }

  if (buttons.import !== undefined) {
    if (buttons.import) {
      await expect(page.getByTestId('import-button')).toBeVisible();
    } else {
      await expect(page.getByTestId('import-button')).not.toBeVisible();
    }
  }

  if (buttons.bulkEdit !== undefined) {
    if (buttons.bulkEdit) {
      await expect(page.getByTestId('bulk-edit-button')).toBeVisible();
    } else {
      await expect(page.getByTestId('bulk-edit-button')).not.toBeVisible();
    }
  }
};

/**
 * Navigate to bulk edit page and wait for grid to load
 * @param page - Playwright page object
 */
export const navigateToBulkEditPage = async (page: Page) => {
  await page.getByTestId('bulk-edit-button').click();
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  await expect(page.locator('.rdg-header-row')).toBeVisible();
};

/**
 * Cancel bulk edit and wait for redirect
 * @param page - Playwright page object
 * @param expectedUrl - Expected URL after cancel
 */
export const cancelBulkEditAndVerifyRedirect = async (
  page: Page,
  expectedUrl: string
) => {
  const cancelButton = page.getByRole('button', { name: /cancel/i });
  const testCaseListResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/search/list*'
  );
  await cancelButton.click();
  await testCaseListResponse;

  expect(page.url()).toContain(expectedUrl);
};

/**
 * Cleanup downloaded CSV file
 * @param tableName - Table name to find CSV file
 */
export const cleanupDownloadedCSV = (tableName: string): void => {
  const downloadsDir = 'downloads';
  if (!fs.existsSync(downloadsDir)) {
    return;
  }
  const exportedFile = fs
    .readdirSync(downloadsDir)
    .find((f: string) => f.includes(tableName) && f.endsWith('.csv'));
  if (exportedFile) {
    const filePath = path.join(downloadsDir, exportedFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

/**
 * Add 4 test case validation rows for E2E testing
 * @param page - Playwright page object
 * @param table - Table instance
 * @param testNamePrefix - Prefix for test case names
 */
export const addTestCaseValidationRows = async (
  page: Page,
  table: TableClass,
  testNamePrefix: string
) => {
  const { RDG_ACTIVE_CELL_SELECTOR } = await import(
    '../constant/bulkImportExport'
  );
  const { fillTestCaseDetails, firstTimeGridAddRowAction, pressKeyXTimes } =
    await import('./importUtils');

  const fqn = table.entityResponseData.fullyQualifiedName;

  if (!fqn) {
    throw new Error(
      `Table fullyQualifiedName is missing for ${table.entity.name}`
    );
  }

  // Row 1: Complete test case with all fields
  await page.evaluate(() => window.scrollTo(0, 0));
  await firstTimeGridAddRowAction(page);

  await fillTestCaseDetails(
    {
      name: `e2e_${testNamePrefix}_complete_test`,
      displayName: `E2E ${testNamePrefix} Complete Test Case`,
      description: 'Test case with all required fields',
      testDefinition: 'tableRowCountToBeBetween',
      entityFQN: fqn,
      testSuite: fqn + '.testSuite',
      parameterValues:
        '{"name":"minValue","value":"12"};{"name":"maxValue","value":"34"}',
      computePassedFailedRowCount: 'false',
      useDynamicAssertion: 'false',
    },
    page
  );

  // Row 2: Missing name (required field)
  await page.click('[data-testid="add-row-btn"]');
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowDown', { delay: 100 });
  await pressKeyXTimes(page, 11, 'ArrowLeft');

  await fillTestCaseDetails(
    {
      displayName: `E2E ${testNamePrefix} Missing Name Test`,
      description: 'Test case missing required name field',
      testDefinition: 'tableRowCountToBeBetween',
      entityFQN: fqn,
    },
    page
  );

  // Row 3: Missing testDefinition (required field)
  await page.click('[data-testid="add-row-btn"]');
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowDown', { delay: 100 });
  await pressKeyXTimes(page, 11, 'ArrowLeft');

  await fillTestCaseDetails(
    {
      name: `e2e_${testNamePrefix}_missing_definition`,
      displayName: `E2E ${testNamePrefix} Missing Definition Test`,
      description: 'Test case missing required testDefinition field',
      entityFQN: fqn,
    },
    page
  );

  // Row 4: Missing entityFQN (required field)
  await page.click('[data-testid="add-row-btn"]');
  await page.click(RDG_ACTIVE_CELL_SELECTOR);
  await page
    .locator(RDG_ACTIVE_CELL_SELECTOR)
    .press('ArrowDown', { delay: 100 });
  await pressKeyXTimes(page, 11, 'ArrowLeft');

  await fillTestCaseDetails(
    {
      name: `e2e_${testNamePrefix}_missing_entity_fqn`,
      displayName: `E2E ${testNamePrefix} Missing EntityFQN Test`,
      description: 'Test case missing required entityFQN field',
      testDefinition: 'columnValuesToBeNotNull',
    },
    page
  );
};

/**
 * Perform complete E2E export-import-validate flow
 * @param page - Playwright page object
 * @param table - Table instance
 * @param testNamePrefix - Prefix for test case names
 */
export const performE2EExportImportFlow = async (
  page: Page,
  table: TableClass,
  testNamePrefix: string
) => {
  const { validateImportStatus } = await import('./importUtils');
  const { test } = await import('@playwright/test');

  // Step 1: Export test case details
  await test.step('Export test case details to downloads folder', async () => {
    await visitDataQualityTab(page, table);
    await clickManageButton(page, 'table');
    const download = await performTestCaseExport(page);

    const filename = download.suggestedFilename();
    expect(filename).toContain('.csv');
    await download.saveAs(path.join('downloads', filename));
  });

  // Step 2: Import and prepare grid
  await test.step('Import CSV and prepare grid', async () => {
    await clickManageButton(page, 'table');
    await navigateToImportPage(page);

    const fileInput = await page.$('[type="file"]');
    const exportedFile = fs
      .readdirSync('downloads')
      .find((f: string) => f.includes(table.entity.name) && f.endsWith('.csv'));
    await fileInput?.setInputFiles(['downloads/' + exportedFile]);

    await page.waitForTimeout(500);

    await expect(page.locator('.rdg-header-row')).toBeVisible();
    await expect(page.getByTestId('add-row-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
  });

  // Step 3: Add 4 validation rows
  await test.step('Add 4 test case validation rows', async () => {
    await addTestCaseValidationRows(page, table, testNamePrefix);
  });

  // Step 4: Validate and update
  await test.step('Validate import status and update', async () => {
    await page.getByRole('button', { name: 'Next' }).click();

    await validateImportStatus(page, {
      passed: '3',
      processed: '6',
      failed: '3',
    });

    const cellDetails = page.locator('.rdg-cell-details');
    await expect(cellDetails.nth(0)).toContainText('Entity created');
    await expect(cellDetails.nth(1)).toContainText('Entity created');
    await expect(cellDetails.nth(2)).toContainText(
      '#FIELD_REQUIRED: Field 1 is required'
    );
    await expect(cellDetails.nth(3)).toContainText(
      '#FIELD_REQUIRED: Field 4 is required'
    );
    await expect(cellDetails.nth(4)).toContainText(
      '#FIELD_REQUIRED: Field 5 is required'
    );

    const updateButtonResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testCases/name') &&
        response.url().includes('importAsync') &&
        response.url().includes('dryRun=false') &&
        response.url().includes('recursive=true')
    );

    await page.click('[type="button"] >> text="Update"', { force: true });
    await updateButtonResponse;
    await page
      .locator('.inovua-react-toolkit-load-mask__background-layer')
      .waitFor({ state: 'detached' });
    await toastNotification(page, /updated successfully/);
  });

  // Step 5: Verify test case was added
  await test.step('Verify complete test case was added', async () => {
    await visitDataQualityTab(page, table);
    await expect(
      page.getByTestId(`e2e_${testNamePrefix}_complete_test`)
    ).toBeVisible({ timeout: 10000 });
  });

  // Step 6: Bulk edit - Update display names and add tags
  await test.step('Bulk edit: Update display names and add tags', async () => {
    // Click Manage button and navigate to bulk edit
    await clickManageButton(page, 'table');
    await page.click('[data-testid="bulk-edit-button"]');

    // Wait for bulk edit grid to load
    await page.waitForSelector('.rdg-header-row', { state: 'visible' });
    await expect(page.locator('.rdg-header-row')).toBeVisible();

    // Update display name for first test case (existing test case)
    await page.locator('.rdg-row').nth(0).click();
    const displayNameCell1 = page
      .locator('.rdg-row')
      .nth(0)
      .locator('[aria-colindex="2"]');
    await displayNameCell1.dblclick();
    await page.keyboard.type(' - Updated via Bulk Edit');
    await page.keyboard.press('Enter');

    // Update display name for second test case (e2e_${testNamePrefix}_complete_test)
    await page.locator('.rdg-row').nth(1).click();
    const displayNameCell2 = page
      .locator('.rdg-row')
      .nth(1)
      .locator('[aria-colindex="2"]');
    await displayNameCell2.dblclick();
    await page.keyboard.type(' - Bulk Edited');
    await page.keyboard.press('Enter');

    // First test case - add tag
    await page.locator('.rdg-row').nth(0).click();
    await page
      .locator('.rdg-row')
      .nth(0)
      .locator('[aria-colindex="1"]')
      .click(); // Click Name column to ensure focus
    await pressKeyXTimes(page, 9, 'ArrowRight'); // Navigate from Name (2) to Tags (11) = 9 presses
    await fillTagDetails(page, 'PII.Sensitive');

    await page.getByRole('button', { name: 'Next' }).click();

    await validateImportStatus(page, {
      passed: '3',
      processed: '3',
      failed: '0',
    });

    const cellDetails = page.locator('.rdg-cell-details');
    await expect(cellDetails.nth(0)).toContainText('Entity created');
    await expect(cellDetails.nth(1)).toContainText('Entity created');

    // Click Update button
    const bulkEditUpdateResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/dataQuality/testCases/name') &&
        response.url().includes('importAsync') &&
        response.url().includes('dryRun=false')
    );

    await page.click('[type="button"] >> text="Update"', { force: true });
    await bulkEditUpdateResponse;
    await page
      .locator('.inovua-react-toolkit-load-mask__background-layer')
      .waitFor({ state: 'detached' });
    await toastNotification(page, /updated successfully/);

    // Verify we're back on the data quality tab
    await expect(page.getByRole('tab', { name: 'Data Quality' })).toBeVisible();
  });

  // Step 7: Verify bulk edit changes
  await test.step('Verify bulk edit changes', async () => {
    // Verify updated display names are visible
    await expect(page.getByText(/ - Updated via Bulk Edit/)).toBeVisible();
    await expect(page.getByText(/ - Bulk Edited/)).toBeVisible();
  });
};
