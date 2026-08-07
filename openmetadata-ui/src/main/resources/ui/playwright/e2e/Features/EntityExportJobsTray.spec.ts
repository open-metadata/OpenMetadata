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

import { expect, Page, test } from '@playwright/test';

import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const buildRunningExportJob = (jobId: string, entityType: string) => ({
  jobId,
  operation: 'EXPORT',
  entityType,
  createdBy: 'admin',
  status: 'RUNNING',
  progress: 4,
  total: 12,
});

const stubExportAsync = (page: Page, jobId: string) =>
  page.route('**/exportAsync**', (route) =>
    route.fulfill({ contentType: 'application/json', json: { jobId } })
  );

const mockCsvJobsPolling = (
  page: Page,
  jobs: Record<string, unknown>[]
): Promise<void> =>
  page.route('**/api/v1/csvAsyncJobs**', (route) =>
    route.fulfill({ contentType: 'application/json', json: jobs })
  );

// Trigger export from a data asset's Manage menu (databaseService, database,
// databaseSchema, table all share this dropdown + button).
const triggerDataAssetExport = async (page: Page) => {
  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/exportAsync') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('manage-button').click();
  await page
    .getByTestId('manage-dropdown-list-container')
    .waitFor({ state: 'visible' });
  await page.getByTestId('export-button-title').click();

  // Assert the real button issued the async export request (its response is the
  // stubbed job object).
  expect((await exportResponse).ok()).toBeTruthy();
};

// Glossary uses its own Manage dropdown container and export button test id.
const triggerGlossaryExport = async (page: Page) => {
  const exportResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/glossaries/name/') &&
      response.url().includes('/exportAsync') &&
      response.request().method() === 'GET'
  );

  await page.getByTestId('manage-button').click();
  const manageDropdown = page
    .locator('.glossary-manage-dropdown-list-container')
    .last();
  await expect(manageDropdown).toBeVisible();
  await manageDropdown.getByTestId('export-button').click();

  expect((await exportResponse).ok()).toBeTruthy();
};

const assertRunningExportInTray = async (page: Page) => {
  const tray = page.locator('.csv-jobs-tray');
  await expect(tray).toBeVisible({ timeout: 30_000 });

  const popover = page.locator('.csv-jobs-tray-popover');
  if (!(await popover.isVisible())) {
    await page.locator('.csv-jobs-tray-launcher').click();
  }

  await expect(popover).toBeVisible();
  await expect(page.locator('.csv-jobs-tray-item-running')).toHaveCount(1);
  await expect(popover.getByText(/Exporting/i).first()).toBeVisible();
};

test.describe('Export jobs tray surfaces entity exports', () => {
  test.slow();

  test.beforeEach(async ({ page }) => {
    // The tray is a global, user-scoped widget that polls /csvAsyncJobs from
    // the moment the app loads. Mock it BEFORE any navigation so a real
    // RUNNING job created by a parallel worker (all CI workers share the
    // admin user) can never leak into this page's tray state. Per-test mocks
    // registered later take precedence (Playwright matches routes LIFO).
    await mockCsvJobsPolling(page, []);
    await redirectToHomePage(page);
  });

  test('Database service export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const dbService = new DatabaseServiceClass();
    const jobId = 'pw-tray-dbservice-export';

    try {
      await dbService.create(apiContext);

      await stubExportAsync(page, jobId);
      await mockCsvJobsPolling(page, [
        buildRunningExportJob(jobId, 'databaseService'),
      ]);
      await dbService.visitEntityPage(page);

      await triggerDataAssetExport(page);
      await assertRunningExportInTray(page);
    } finally {
      await dbService.delete(apiContext);
      await afterAction();
    }
  });

  test('Database export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const database = new DatabaseClass();
    const jobId = 'pw-tray-database-export';

    try {
      await database.create(apiContext);

      await stubExportAsync(page, jobId);
      await mockCsvJobsPolling(page, [
        buildRunningExportJob(jobId, 'database'),
      ]);
      await database.visitEntityPage(page);

      await triggerDataAssetExport(page);
      await assertRunningExportInTray(page);
    } finally {
      await database.delete(apiContext);
      await afterAction();
    }
  });

  test('Database schema export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const schema = new DatabaseSchemaClass();
    const jobId = 'pw-tray-schema-export';

    try {
      await schema.create(apiContext);

      await stubExportAsync(page, jobId);
      await mockCsvJobsPolling(page, [
        buildRunningExportJob(jobId, 'databaseSchema'),
      ]);
      await schema.visitEntityPage(page);

      await triggerDataAssetExport(page);
      await assertRunningExportInTray(page);
    } finally {
      await schema.delete(apiContext);
      await afterAction();
    }
  });

  test('Table export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const table = new TableClass();
    const jobId = 'pw-tray-table-export';

    try {
      await table.create(apiContext);

      await stubExportAsync(page, jobId);
      await mockCsvJobsPolling(page, [buildRunningExportJob(jobId, 'table')]);
      await table.visitEntityPage(page);

      await triggerDataAssetExport(page);
      await assertRunningExportInTray(page);
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });

  test('Glossary export appears in the jobs tray', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const jobId = 'pw-tray-glossary-export';

    try {
      await glossary.create(apiContext);

      await stubExportAsync(page, jobId);
      await mockCsvJobsPolling(page, [
        buildRunningExportJob(jobId, 'glossaryTerm'),
      ]);
      await glossary.visitEntityPage(page);

      await triggerGlossaryExport(page);
      await assertRunningExportInTray(page);
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
