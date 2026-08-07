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

import { APIRequestContext, expect, Page } from '@playwright/test';

import { performAdminLogin } from '../../utils/admin';
import { getExportModalContent, openExportScopeModal } from '../../utils/explore';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

// ── helpers ──────────────────────────────────────────────────────────────────

const startAsyncExport = async (page: Page): Promise<string> => {
  const asyncResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/api/v1/search/export/async') && res.status() === 202
  );

  await getExportModalContent(page)
    .getByRole('button', { name: 'Export' })
    .click();

  const { jobId } = (await (await asyncResponse).json()) as { jobId: string };

  await expect(page.getByText('Export started')).toBeVisible();
  await expect(getExportModalContent(page)).not.toBeVisible();

  return jobId;
};

const waitForJobCompleted = async (
  apiContext: APIRequestContext,
  jobId: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const res = await apiContext.get('/api/v1/csvAsyncJobs?limit=50');
        const jobs = (await res.json()) as Array<{
          jobId: string;
          status: string;
        }>;

        if (!Array.isArray(jobs)) {
          throw new Error(
            `Unexpected response ${res.status()}: ${JSON.stringify(jobs).slice(0, 200)}`
          );
        }

        return jobs.find((j) => j.jobId === jobId)?.status;
      },
      { timeout: 90_000 }
    )
    .toBe('COMPLETED');
};

const triggerJobsRefresh = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('csv-jobs-refresh')));

// Scope all assertions to the tray item that belongs to the specific job
// created by this test — other jobs from parallel workers are ignored.
const jobItem = (page: Page, jobId: string) =>
  page.locator(`[data-testid="csv-jobs-tray-item-${jobId}"]`);

// ── suite ─────────────────────────────────────────────────────────────────────

// Serial mode prevents the shared admin user's job list from being polluted by
// jobs that the previous test left in RUNNING state (clear-completed only
// dismisses terminal jobs). Cross-file parallel workers are less of a concern
// because assertions are scoped to the specific jobId created by each test.
test.describe.serial('CsvJobsTray', () => {
  test.beforeEach(async ({ page }) => {
    const searchResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/search/query') && res.status() === 200
    );
    await page.goto('/explore/tables?search=sample_data');
    await expect(page.getByTestId('explore-page')).toBeVisible();
    await searchResponse;
  });

  test.afterEach(async ({ page }) => {
    // Best-effort: dismiss terminal jobs so they don't accumulate across tests.
    try {
      const clearButton = page.locator('.csv-jobs-tray-clear');
      if (await clearButton.isVisible({ timeout: 2_000 })) {
        await clearButton.click();

        return;
      }
      for (const btn of await page.locator('.csv-jobs-tray-dismiss').all()) {
        if (await btn.isVisible()) {
          await btn.click();
        }
      }
    } catch {
      // tray may already be hidden — ignore
    }
  });

  test('tray surfaces an export job after export starts', async ({
    page,
    browser,
  }) => {
    test.slow();

    await openExportScopeModal(page);
    const jobId = await startAsyncExport(page);

    // The export modal fires csv-jobs-refresh internally; the tray renders once
    // the component picks up the new job from the first poll.
    await expect(page.locator('.csv-jobs-tray')).toBeVisible({
      timeout: 30_000,
    });
    await expect(jobItem(page, jobId)).toBeVisible({ timeout: 30_000 });

    // Wait for completion so afterEach can clear the item via clear-completed.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await waitForJobCompleted(apiContext, jobId);
    await afterAction();
  });

  test('auto-opens the tray when an export job completes', async ({
    page,
    browser,
  }) => {
    test.slow();

    await openExportScopeModal(page);
    const jobId = await startAsyncExport(page);

    // Tray auto-opens once the component polls and sees the RUNNING→COMPLETED
    // transition for a job that was not already terminal on initial load.
    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 90_000,
    });
    await expect(jobItem(page, jobId)).toBeVisible({ timeout: 30_000 });

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await waitForJobCompleted(apiContext, jobId);
    await afterAction();
  });

  test('shows Download button for a completed job and triggers file download', async ({
    page,
    browser,
  }) => {
    test.slow();

    await openExportScopeModal(page);
    const jobId = await startAsyncExport(page);

    // Poll the backend until done before asserting the Download button so that a
    // slow job doesn't exhaust the assertion timeout.
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await waitForJobCompleted(apiContext, jobId);
    await afterAction();

    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 30_000,
    });

    const downloadButton = jobItem(page, jobId).getByRole('button', {
      name: 'Download',
    });
    await expect(downloadButton).toBeVisible({ timeout: 30_000 });

    const resultResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/v1/csvAsyncJobs/${jobId}/result`) &&
        res.status() === 200
    );
    const downloadEvent = page.waitForEvent('download');

    await downloadButton.click();
    await resultResponse;

    const download = await downloadEvent;
    expect(download.suggestedFilename()).toContain(jobId);
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('Clear completed removes terminal jobs and hides the tray', async ({
    page,
    browser,
  }) => {
    test.slow();

    await openExportScopeModal(page);
    const jobId = await startAsyncExport(page);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await waitForJobCompleted(apiContext, jobId);
    await afterAction();

    await triggerJobsRefresh(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      jobItem(page, jobId).filter({ has: page.locator('.csv-jobs-tray-item-success') })
    ).toBeVisible({ timeout: 30_000 });

    await page.locator('.csv-jobs-tray-clear').click();

    await expect(page.locator('.csv-jobs-tray')).not.toBeVisible();
  });

  test('does not re-open the tray after the user minimizes it', async ({
    page,
    browser,
  }) => {
    test.slow();

    await openExportScopeModal(page);
    const jobId = await startAsyncExport(page);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await waitForJobCompleted(apiContext, jobId);
    await afterAction();

    await triggerJobsRefresh(page);

    // Tray auto-opens on completion.
    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 30_000,
    });

    // User closes the tray.
    await page.locator('.csv-jobs-tray-close').click();
    await expect(page.locator('.csv-jobs-tray-popover')).toBeHidden();
    await expect(page.locator('.csv-jobs-tray-launcher')).toBeVisible();

    // Next poll must not re-open it (autoOpenedJobIds prevents it).
    const reFetch = page.waitForResponse('**/api/v1/csvAsyncJobs**');
    await triggerJobsRefresh(page);
    await reFetch;

    await expect(page.locator('.csv-jobs-tray-popover')).toBeHidden();
  });
});
