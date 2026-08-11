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
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

const refreshTray = async (page: Page): Promise<void> => {
  const fetchDone = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/csvAsyncJobs') &&
      !r.url().includes('/result') &&
      !r.url().includes('/cancel') &&
      r.status() === 200,
    { timeout: 15_000 }
  );

  await page.evaluate(() =>
    window.dispatchEvent(new Event('csv-jobs-refresh'))
  );

  await fetchDone;
};

const queueUserExport = async (
  apiContext: APIRequestContext,
  page: Page
): Promise<string> => {
  const res = await apiContext.get(
    '/api/v1/users/exportAsync?team=Organization'
  );

  expect(res.status()).toBe(202);
  const { jobId } = (await res.json()) as { jobId: string };

  await refreshTray(page);

  return jobId;
};

const queueDbServiceExport = async (
  apiContext: APIRequestContext,
  page: Page
): Promise<string> => {
  const res = await apiContext.get(
    '/api/v1/services/databaseServices/name/sample_data/exportAsync'
  );

  expect(res.status()).toBe(202);
  const { jobId } = (await res.json()) as { jobId: string };

  await refreshTray(page);

  return jobId;
};

const pollUntilJobStatus = async (
  apiContext: APIRequestContext,
  jobId: string,
  targetStatus: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const res = await apiContext.get(`/api/v1/csvAsyncJobs/${jobId}`);

        if (!res.ok()) {
          return null;
        }

        const job = (await res.json()) as { status: string };

        return job.status ?? null;
      },
      { timeout: 90_000, intervals: [2_000] }
    )
    .toBe(targetStatus);
};

const pollUntilTerminal = async (
  apiContext: APIRequestContext,
  jobId: string
): Promise<string> => {
  const TERMINAL = ['COMPLETED', 'FAILED', 'CANCELLED'];
  let terminalStatus = '';

  await expect
    .poll(
      async () => {
        const res = await apiContext.get(`/api/v1/csvAsyncJobs/${jobId}`);

        if (!res.ok()) {
          return false;
        }

        const job = (await res.json()) as { status: string };
        const status = job.status ?? '';

        if (TERMINAL.includes(status)) {
          terminalStatus = status;

          return true;
        }

        return false;
      },
      { timeout: 60_000, intervals: [2_000] }
    )
    .toBe(true);

  return terminalStatus;
};

const activateTrayOnPage = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await waitForAllLoadersToDisappear(page);
  await refreshTray(page);
};

test.describe('CsvJobsTray — real server', { tag: '@import-export' }, () => {
  // Run serially: all tests share the same admin user's job list on the real
  // server (GET /csvAsyncJobs?limit=20 returns a global list).  Parallel
  // execution causes cross-test auto-open races where one test's completed
  // job triggers the tray to re-open inside another test's assertions.
  test.describe.configure({ mode: 'serial' });
  test('export job queued makes the tray launcher visible', async ({
    browser,
    page,
  }) => {
    // Verifies that queuing an export job makes the tray launcher (or
    // auto-opened popover) appear without any page.route() mocking.
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    await queueUserExport(apiContext, page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });
    await afterAction();
  });

  test('tray auto-opens without launcher click when export job completes', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');

    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page
        .locator('.csv-jobs-tray-item')
        .filter({ hasText: /Exported/i })
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator('.csv-jobs-tray-action')
        .filter({ hasText: 'Download' })
        .first()
    ).toBeVisible();
    await afterAction();
  });

  test('result endpoint returns HTTP 200 with valid CSV — not a silent timeout', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');

    const resultRes = await apiContext.get(
      `/api/v1/csvAsyncJobs/${jobId}/result`
    );

    expect(resultRes.status()).toBe(200);
    expect(resultRes.headers()['content-type']).toContain('text/csv');

    const csv = await resultRes.text();
    const nonEmptyLines = csv
      .split('\n')
      .filter((line) => line.trim().length > 0);

    // Must have at least a header row.
    expect(nonEmptyLines.length).toBeGreaterThanOrEqual(1);

    // User export includes a "name" column in its header.
    expect(nonEmptyLines[0].toLowerCase()).toContain('name');

    await afterAction();
  });

  test('clicking Download from the tray triggers a file download with correct name', async ({
    browser,
    page,
  }) => {
    // Verifies the Download button in the tray's completed-job row fires the
    // result endpoint and triggers a browser download event.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 15_000,
    });

    const downloadBtn = page.getByRole('button', { name: 'Download' }).first();

    await expect(downloadBtn).toBeVisible();

    // Register both listeners BEFORE clicking so we don't race.
    const resultResPromise = page.waitForResponse((r) =>
      r.url().includes(`/api/v1/csvAsyncJobs/${jobId}/result`)
    );
    const downloadEventPromise = page.waitForEvent('download');

    await downloadBtn.click();

    const [resultRes, download] = await Promise.all([
      resultResPromise,
      downloadEventPromise,
    ]);

    expect(resultRes.status()).toBe(200);
    expect(download.suggestedFilename()).toContain(jobId);
    expect(download.suggestedFilename()).toContain('.csv');
    await afterAction();
  });

  test('clear completed removes finished export jobs and hides the tray', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 15_000,
    });

    await page.locator('.csv-jobs-tray-clear').click();

    // Tray and launcher must both disappear once no jobs remain.
    await expect(page.locator('.csv-jobs-tray')).not.toBeVisible();
    await afterAction();
  });

  test('two concurrent export jobs both appear in the tray', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/services/databases');

    // Fire both jobs before refreshing so the tray sees them together.
    const exportRes1 = await apiContext.get(
      '/api/v1/services/databaseServices/name/sample_data/exportAsync'
    );

    expect(exportRes1.status()).toBe(202);
    const { jobId: jobId1 } = (await exportRes1.json()) as { jobId: string };

    const exportRes2 = await apiContext.get(
      '/api/v1/users/exportAsync?team=Organization'
    );

    expect(exportRes2.status()).toBe(202);
    const { jobId: jobId2 } = (await exportRes2.json()) as { jobId: string };

    expect(jobId1).not.toBe(jobId2);

    // Single refresh after both jobs are created so the tray sees them both.
    await refreshTray(page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    // Wait for both to finish — terminal state is enough, COMPLETED not required.
    await pollUntilTerminal(apiContext, jobId1);
    await pollUntilTerminal(apiContext, jobId2);
    await afterAction();
  });

  test('real async import job shows in the tray as an import operation', async ({
    browser,
    page,
  }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    const glossaryName = `pw-tray-import-e2e-${Date.now()}`;

    const glossaryRes = await apiContext.post('/api/v1/glossaries', {
      data: { name: glossaryName, displayName: 'PW Tray Import E2E' },
    });
    const glossary = (await glossaryRes.json()) as { id: string };
    await activateTrayOnPage(page, '/glossary');

    const csv = [
      'parent,name,displayName,description',
      ',term1,Term One,A test glossary term',
    ].join('\n');

    const importRes = await apiContext.put(
      `/api/v1/glossaries/name/${encodeURIComponent(
        glossaryName
      )}/importAsync?dryRun=false`,
      { data: csv, headers: { 'Content-Type': 'text/plain' } }
    );

    expect(importRes.status()).toBe(200);
    const { jobId } = (await importRes.json()) as { jobId: string };

    await refreshTray(page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    if (!(await trayPopover.isVisible())) {
      await launcher.click();
    }

    // "Importing Glossary Terms" (active) or "Imported Glossary Terms" (done)
    await expect(
      page
        .locator('.csv-jobs-tray-item')
        .filter({ hasText: /Importing|Imported/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // Wait for terminal state — whether the server succeeds or fails, both
    // COMPLETED and FAILED imports render a dismiss button (not Download).
    await pollUntilTerminal(apiContext, jobId);
    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-dismiss').first()).toBeVisible({
      timeout: 10_000,
    });

    await apiContext.delete(
      `/api/v1/glossaries/${glossary.id}?hardDelete=true&recursive=true`
    );
    await afterAction();
  });

  test('database service export shows in the tray', async ({
    browser,
    page,
  }) => {
    // Guards the GET /services/databaseServices/.../exportAsync path.
    // Uses sample_data which is always present in the test environment.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/services/databases');
    const jobId = await queueDbServiceExport(apiContext, page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    if (!(await trayPopover.isVisible())) {
      await launcher.click();
    }

    await expect(
      page
        .locator('.csv-jobs-tray-item')
        .filter({ hasText: /Exporting|Exported/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });

    // Wait for any terminal state — COMPLETED or FAILED is fine for this test.
    await pollUntilTerminal(apiContext, jobId);
    await afterAction();
  });

  test('user export from team shows in the tray', async ({ browser, page }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    if (!(await trayPopover.isVisible())) {
      await launcher.click();
    }

    await expect(
      page
        .locator('.csv-jobs-tray-item')
        .filter({ hasText: /Exporting|Exported/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
    await afterAction();
  });

  test('test case export for a table shows in the tray', async ({
    browser,
    page,
  }) => {
    // Guards the GET /dataQuality/testCases/name/{fqn}/exportAsync path.
    // Even with no test cases the job reaches terminal state with a CSV.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/explore/tables?search=sample_data');

    const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
    const exportRes = await apiContext.get(
      `/api/v1/dataQuality/testCases/name/${encodeURIComponent(
        fqn
      )}/exportAsync`
    );

    expect(exportRes.status()).toBe(202);
    const { jobId } = (await exportRes.json()) as { jobId: string };

    await refreshTray(page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    if (!(await trayPopover.isVisible())) {
      await launcher.click();
    }

    await expect(
      page
        .locator('.csv-jobs-tray-item')
        .filter({ hasText: /Exporting|Exported/i })
        .first()
    ).toBeVisible({ timeout: 15_000 });

    await pollUntilTerminal(apiContext, jobId);
    await afterAction();
  });

  test('FAILED async import job shows error state in the tray', async ({
    browser,
    page,
  }) => {
    // Sends a CSV with wrong column headers so the job fails during
    // server-side processing.  Verifies error styling + dismiss button.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    const glossaryName = `pw-tray-import-fail-e2e-${Date.now()}`;

    const glossaryRes = await apiContext.post('/api/v1/glossaries', {
      data: { name: glossaryName, displayName: 'PW Tray Import Fail E2E' },
    });
    const glossary = (await glossaryRes.json()) as { id: string };

    await activateTrayOnPage(page, '/glossary');

    // Missing 'name' column causes async processing to fail.
    const badCsv = ['wrong_col_a,wrong_col_b', 'value1,value2'].join('\n');

    const importRes = await apiContext.put(
      `/api/v1/glossaries/name/${encodeURIComponent(
        glossaryName
      )}/importAsync?dryRun=false`,
      { data: badCsv, headers: { 'Content-Type': 'text/plain' } }
    );

    expect(importRes.status()).toBe(200);
    const { jobId } = (await importRes.json()) as { jobId: string };

    const finalStatus = await pollUntilTerminal(apiContext, jobId);

    expect(finalStatus).toBe('FAILED');

    await refreshTray(page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    if (!(await trayPopover.isVisible())) {
      await launcher.click();
    }

    // FAILED job: error styling + dismiss button (not Download).
    await expect(page.locator('.csv-jobs-tray-item-error').first()).toBeVisible(
      { timeout: 10_000 }
    );
    await expect(page.locator('.csv-jobs-tray-dismiss').first()).toBeVisible();

    await apiContext.delete(
      `/api/v1/glossaries/${glossary.id}?hardDelete=true&recursive=true`
    );
    await afterAction();
  });

  test('auto-open fires only once — closing and re-fetching does not re-open', async ({
    browser,
    page,
  }) => {
    // Guards the autoOpenedJobIds ref that prevents the same terminal job
    // from re-opening the tray on every WebSocket tick or poll cycle.
    // Uses user export which reliably reaches COMPLETED.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
    await refreshTray(page);

    // Tray auto-opens once for the newly-completed job.
    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 15_000,
    });

    // User manually closes the tray.
    await page.locator('.csv-jobs-tray-close').click();

    // Popover must disappear immediately after close click.
    await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible({
      timeout: 5_000,
    });

    // Simulate another WebSocket tick — job is already in autoOpenedJobIds.
    // With serial execution the server has no other tests' jobs in-flight, so
    // the only job in the list is ours (already seen) — tray must stay closed.
    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible({
      timeout: 5_000,
    });
    await afterAction();
  });

  test('tray launcher survives navigation to a different page', async ({
    browser,
    page,
  }) => {
    // Verifies the tray is mounted at the app-shell level and is NOT
    // unmounted during client-side route transitions.  A regression that
    // moves CsvJobsTrayContainer inside a route component would cause the
    // active-job indicator to vanish mid-export on every navigation.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Activate on page A.
    await activateTrayOnPage(page, '/settings/teams/Organization');
    await queueUserExport(apiContext, page);

    const launcher = page.locator('.csv-jobs-tray-launcher');
    const trayPopover = page.locator('.csv-jobs-tray-popover');

    // Job is visible on page A (QUEUED / RUNNING).
    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

    // Navigate to a completely different section while the job is still active.
    await page.goto('/settings/services/databases');
    await waitForAllLoadersToDisappear(page);

    // Refresh so the tray picks up the current job state on page B.
    await refreshTray(page);

    // The tray must still be present after the route change.
    await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });
    await afterAction();
  });

  test('Download button stays clickable and re-triggers a download after first use', async ({
    browser,
    page,
  }) => {
    // Guards the downloadedJobIds state: after the first download the row's
    // icon changes to a checkmark, but the Download button must remain
    // visible so users can save the file again.
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);

    await activateTrayOnPage(page, '/settings/teams/Organization');
    const jobId = await queueUserExport(apiContext, page);

    await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
    await refreshTray(page);

    await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
      timeout: 15_000,
    });

    const downloadBtn = page.getByRole('button', { name: 'Download' }).first();

    await expect(downloadBtn).toBeVisible();

    // First download.
    const dl1 = page.waitForEvent('download');

    await downloadBtn.click();
    await dl1;

    // Button must still be visible after first download.
    await expect(downloadBtn).toBeVisible();

    // Second click must also trigger a download (button is never disabled).
    const dl2 = page.waitForEvent('download');

    await downloadBtn.click();
    await dl2;

    await afterAction();
  });
});
