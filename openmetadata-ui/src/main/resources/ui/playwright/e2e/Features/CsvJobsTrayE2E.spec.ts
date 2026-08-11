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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch csv-jobs-refresh AND wait for the tray's fetchJobs network response.
 * A bare page.evaluate() dispatch races ahead of the network call; this helper
 * ensures the tray has processed the updated job list before returning.
 */
const refreshTray = async (page: Page): Promise<void> => {
  // Register the waiter BEFORE dispatching so we never miss the response.
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

/**
 * Create a user-team export job and immediately notify the tray.
 * GET /users/exportAsync?team=Organization reliably reaches COMPLETED on every
 * properly-configured test server.  Use this for any test that must assert on
 * COMPLETED status or the Download button.
 */
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

/**
 * Create a db-service export job and immediately notify the tray.
 * Use only for tests that check "export job appears in tray" — do NOT use for
 * tests that need COMPLETED, because this endpoint may return FAILED on some
 * test-server configurations.
 */
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

/**
 * Poll the single-job endpoint until status equals targetStatus.
 */
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

/**
 * Poll until the job reaches any terminal status (COMPLETED / FAILED / CANCELLED)
 * and return that status.
 */
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

/**
 * Navigate to a page, wait for it to load, and pre-activate the tray so that
 * hasLoadedInitialJobs becomes true before any new job is created.  Jobs
 * created after this point will not be dismissed on first render.
 */
const activateTrayOnPage = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await waitForAllLoadersToDisappear(page);
  await refreshTray(page);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe(
  'CsvJobsTray — real server',
  { tag: ['@Features', '@import-export'] },
  () => {
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
      // Guards the autoOpenedJobIds useEffect path. The tray must open on its
      // own when a newly-completed job appears — user never clicks the launcher.
      // Uses user export which reliably reaches COMPLETED on every test server.
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await activateTrayOnPage(page, '/settings/teams/Organization');
      const jobId = await queueUserExport(apiContext, page);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');

      // Mirror what WebSocket does: tell the tray to re-fetch so the auto-open
      // useEffect fires for the newly-completed job.
      await refreshTray(page);

      // Never click the launcher — the tray must open on its own.
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
      // Verifies GET /csvAsyncJobs/{jobId}/result returns a valid CSV.
      // Uses user export which always produces a structured CSV result.
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

      const downloadBtn = page
        .getByRole('button', { name: 'Download' })
        .first();

      await expect(downloadBtn).toBeVisible();

      // Register both listeners BEFORE clicking so we don't race.
      const resultResPromise = page.waitForResponse(
        (r) => r.url().includes(`/api/v1/csvAsyncJobs/${jobId}/result`)
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
      // Verifies the tray handles multiple in-flight jobs from the same session.
      // Uses two different entity-type exports (db service + user) so the jobs
      // have distinct entityType labels in the tray.
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
      // Creates a real glossary and imports one term via the async API.
      // Verifies the tray surfaces the import job without any page.route() mocking.
      // importCsvInternalAsync returns HTTP 200 (Response.ok()) with {jobId}.
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      const glossaryName = `pw-tray-import-e2e-${Date.now()}`;

      const glossaryRes = await apiContext.post('/api/v1/glossaries', {
        data: { name: glossaryName, displayName: 'PW Tray Import E2E' },
      });
      const glossary = (await glossaryRes.json()) as { id: string };

      // activateTrayOnPage marks hasLoadedInitialJobs=true before the import
      // job exists, so the new job will not be dismissed on first render.
      await activateTrayOnPage(page, '/glossary');

      const csv = [
        'parent,name,displayName,description',
        ',term1,Term One,A test glossary term',
      ].join('\n');

      const importRes = await apiContext.put(
        `/api/v1/glossaries/name/${encodeURIComponent(glossaryName)}/importAsync?dryRun=false`,
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

    test('lineage export for a table shows in the tray', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await activateTrayOnPage(page, '/explore/tables?search=sample_data');

      const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
      const exportRes = await apiContext.get(
        `/api/v1/lineage/exportAsync?fqn=${encodeURIComponent(fqn)}&type=table&upstreamDepth=1&downstreamDepth=1&includeDeleted=false`
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

      // Lineage export returns a UUID jobId, which the individual
      // GET /csvAsyncJobs/{id} endpoint cannot parse as a Long.  The visual
      // assertion above is the meaningful check — no terminal-state poll here.
      void jobId;
      await afterAction();
    });

    test('lineage by entity count export shows in the tray', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await activateTrayOnPage(page, '/explore/tables?search=sample_data');

      const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
      const exportRes = await apiContext.get(
        `/api/v1/lineage/exportByEntityCountAsync?fqn=${encodeURIComponent(fqn)}&entityType=table&direction=UPSTREAM&nodeDepth=1&maxDepth=1`
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

      // Same as lineage export: UUID jobId cannot be polled via the individual
      // csvAsyncJobs endpoint.  Visual check above is sufficient.
      void jobId;
      await afterAction();
    });

    test('user export from team shows in the tray', async ({
      browser,
      page,
    }) => {
      // Guards the GET /users/exportAsync?team=... path used in UserTab.
      // Uses the Organization team which always exists in OpenMetadata.
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
        `/api/v1/dataQuality/testCases/name/${encodeURIComponent(fqn)}/exportAsync`
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
        `/api/v1/glossaries/name/${encodeURIComponent(glossaryName)}/importAsync?dryRun=false`,
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
      await expect(
        page.locator('.csv-jobs-tray-item-error').first()
      ).toBeVisible({ timeout: 10_000 });
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
      await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible();

      // Simulate another WebSocket tick — job is already in autoOpenedJobIds
      // so the tray must NOT re-open.
      await refreshTray(page);

      await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible();
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

      const downloadBtn = page
        .getByRole('button', { name: 'Download' })
        .first();

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
  }
);
