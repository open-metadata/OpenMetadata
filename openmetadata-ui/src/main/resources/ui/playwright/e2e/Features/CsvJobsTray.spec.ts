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

import { expect, Page, Route } from '@playwright/test';

import { redirectToHomePage } from '../../utils/common';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

const JOB_ID_EXPORT = 'pw-tray-export-running';
const JOB_ID_IMPORT = 'pw-tray-import-running';

const RUNNING_EXPORT_JOB = {
  jobId: JOB_ID_EXPORT,
  operation: 'EXPORT',
  entityType: 'metric',
  createdBy: 'admin',
  status: 'RUNNING',
  progress: 5,
  total: 18,
};

const RUNNING_IMPORT_JOB = {
  jobId: JOB_ID_IMPORT,
  operation: 'IMPORT',
  entityType: 'metric',
  createdBy: 'admin',
  status: 'RUNNING',
  progress: 3,
  total: 10,
};

const fulfillJobsRoute = (
  route: Route,
  jobs: Record<string, unknown>[]
) => route.fulfill({ contentType: 'application/json', json: jobs });

const mockJobsApi = (
  page: Page,
  jobs: Record<string, unknown>[]
) => page.route('**/api/v1/csvAsyncJobs**', (route) => fulfillJobsRoute(route, jobs));

const triggerJobsRefresh = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('csv-jobs-refresh')));

const openTray = async (page: Page) => {
  await page.locator('.csv-jobs-tray-launcher').click();
  await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible();
};

test.describe('CsvJobsTray', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await page.goto('/metrics');
    await page.waitForURL(/\/metrics/);
  });

  test('shows a running export job and its progress text', async ({ page }) => {
    await mockJobsApi(page, [RUNNING_EXPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await expect(page.locator('.csv-jobs-tray-item-running')).toHaveCount(1);
    await expect(page.getByText(/Exporting Metrics/i)).toBeVisible();
  });

  test('shows an import job in the tray', async ({ page }) => {
    await mockJobsApi(page, [RUNNING_IMPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await expect(page.getByText(/Importing Metrics/i)).toBeVisible();
  });

  test('can cancel a running job from the tray', async ({ page }) => {
    await mockJobsApi(page, [RUNNING_EXPORT_JOB]);
    await triggerJobsRefresh(page);

    let cancelCalled = false;
    await page.route(
      `**/api/v1/csvAsyncJobs/${JOB_ID_EXPORT}/cancel`,
      async (route) => {
        cancelCalled = true;
        await route.fulfill({
          contentType: 'application/json',
          json: { ...RUNNING_EXPORT_JOB, status: 'CANCELLING' },
        });
      }
    );

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await page
      .locator('.csv-jobs-tray-action')
      .filter({ hasText: 'Cancel' })
      .click();

    await expect.poll(() => cancelCalled, { timeout: 10_000 }).toBe(true);
  });

  test('shows Download button for a completed export job', async ({ page }) => {
    await mockJobsApi(page, [RUNNING_EXPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await mockJobsApi(page, [
      { ...RUNNING_EXPORT_JOB, status: 'COMPLETED', progress: 18 },
    ]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-item-success')).toHaveCount(1);

    let downloadCalled = false;
    await page.route(
      `**/api/v1/csvAsyncJobs/${JOB_ID_EXPORT}/result`,
      async (route) => {
        downloadCalled = true;
        await route.fulfill({
          contentType: 'text/csv',
          body: 'name,displayName\ntest_metric,Test Metric',
        });
      }
    );

    await page
      .locator('.csv-jobs-tray-action')
      .filter({ hasText: 'Download' })
      .click();

    await expect.poll(() => downloadCalled, { timeout: 10_000 }).toBe(true);
  });

  test('FAILED import job shows error styling and dismiss button', async ({
    page,
  }) => {
    await mockJobsApi(page, [RUNNING_IMPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await mockJobsApi(page, [
      {
        ...RUNNING_IMPORT_JOB,
        status: 'FAILED',
        error: 'Invalid CSV format',
        progress: 0,
        total: 0,
      },
    ]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-item-error')).toHaveCount(1);
    await expect(page.locator('.csv-jobs-tray-dismiss')).toBeVisible();
  });

  test('dismiss button removes a completed import job and hides the tray', async ({
    page,
  }) => {
    // COMPLETED EXPORT shows Download; COMPLETED IMPORT shows the dismiss (XClose) button
    await mockJobsApi(page, [RUNNING_IMPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await mockJobsApi(page, [
      { ...RUNNING_IMPORT_JOB, status: 'COMPLETED', progress: 10 },
    ]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-item-success')).toHaveCount(1);
    await expect(page.locator('.csv-jobs-tray-dismiss')).toBeVisible();
    await page.locator('.csv-jobs-tray-dismiss').click();

    await expect(page.locator('.csv-jobs-tray')).not.toBeVisible();
  });

  test('multiple jobs co-exist in the tray', async ({ page }) => {
    await mockJobsApi(page, [RUNNING_EXPORT_JOB, RUNNING_IMPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toContainText('2');
    await openTray(page);

    await expect(page.locator('.csv-jobs-tray-item')).toHaveCount(2);
    await expect(page.getByText(/Exporting Metrics/i)).toBeVisible();
    await expect(page.getByText(/Importing Metrics/i)).toBeVisible();
  });

  test('Clear completed removes all terminal jobs and hides the tray', async ({
    page,
  }) => {
    await mockJobsApi(page, [RUNNING_EXPORT_JOB]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();
    await openTray(page);

    await mockJobsApi(page, [
      { ...RUNNING_EXPORT_JOB, status: 'COMPLETED', progress: 18 },
    ]);
    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-item-success')).toHaveCount(1);
    await page.locator('.csv-jobs-tray-clear').click();

    await expect(page.locator('.csv-jobs-tray')).not.toBeVisible();
  });
});
