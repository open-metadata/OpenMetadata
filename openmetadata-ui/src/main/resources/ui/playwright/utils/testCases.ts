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
import { TableClass } from '../support/entity/TableClass';
import { toastNotification } from './common';

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

  await expect(page.getByTestId('breadcrumb-link').nth(0)).toHaveText(
    `${table.entityResponseData.service.displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(1)).toHaveText(
    `${table.entityResponseData?.['database'].displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(2)).toHaveText(
    `${table.entityResponseData?.['databaseSchema'].displayName}/`
  );
  await expect(page.getByTestId('breadcrumb-link').nth(3)).toHaveText(
    `${table.entityResponseData?.displayName}/`
  );

  await page.getByTestId('breadcrumb-link').nth(3).click();

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
};

/**
 * Click the manage button in the Data Quality tab
 * @param page - Playwright page object
 * @param context - 'table' for table-level or 'global' for global data quality page
 */
export const clickManageButton = async (
  page: Page,
  context: 'table' | 'global' = 'table'
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
 * Verify user is blocked from accessing a page (404 redirect)
 * @param page - Playwright page object
 * @param url - URL to navigate to
 */
export const verifyPageAccessDenied = async (page: Page, url: string) => {
  const permissionResponse = page.waitForResponse((response) =>
    response.url().includes('api/v1/permissions')
  );
  await page.goto(url);
  await permissionResponse;
  await page.waitForSelector("[data-testid='loader']", { state: 'detached' });
  await page.getByText('Page Not FoundThe page you').waitFor({ state: 'visible' });

  expect(page.url()).not.toContain(url);
  const currentUrl = page.url();
  const isRedirected = currentUrl.includes('404');
  expect(isRedirected).toBeTruthy();
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
    timeout: 15000,
  });
  await expect(page.locator('.rdg-header-row')).toBeVisible({
    timeout: 10000,
  });
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
