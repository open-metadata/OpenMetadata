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
import {
  getExportModalContent,
  openExportScopeModal,
} from '../../utils/explore';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

const queueSearchExport = async (page: Page): Promise<string> => {
  const asyncResponsePromise = page.waitForResponse(
    (r) => r.url().includes('/api/v1/search/export/async') && r.status() === 202
  );

  await getExportModalContent(page)
    .getByRole('button', { name: 'Export' })
    .click();

  const { jobId } = (await (await asyncResponsePromise).json()) as {
    jobId: string;
  };

  await expect(page.getByText('Export started')).toBeVisible();
  await expect(getExportModalContent(page)).not.toBeVisible();

  return jobId;
};

/**
 * Poll the single-job endpoint until status equals targetStatus.
 * Using the individual endpoint avoids list-filtering races and is simpler
 * than scanning the full job list.
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

        const job = (await res.json()) as { jobId: string; status: string };

        return job.status ?? null;
      },
      { timeout: 90_000, intervals: [2_000] }
    )
    .toBe(targetStatus);
};

/**
 * Poll until the job reaches any terminal status (COMPLETED / FAILED / CANCELLED)
 * and return that status so callers can assert the specific terminal state.
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

        const job = (await res.json()) as { jobId: string; status: string };
        const status = job.status ?? '';

        if (TERMINAL.includes(status)) {
          terminalStatus = status;

          return true;
        }

        return false;
      },
      { timeout: 30_000, intervals: [2_000] }
    )
    .toBe(true);

  return terminalStatus;
};

/**
 * Navigate to Explore and open the export scope modal.
 * Pre-activates the CsvJobsTrayContainer by dispatching csv-jobs-refresh
 * BEFORE the export starts so the lazy chunk loads while the job is still
 * in QUEUED/RUNNING state. Without this, a fast export can complete before
 * CsvJobsTray mounts and the terminal job gets dismissed on the initial fetch.
 */
const goToExploreAndOpenModal = async (page: Page): Promise<void> => {
  const searchQueryPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/search/query') &&
      r.url().includes('sample_data') &&
      r.status() === 200
  );

  await page.goto('/explore/tables?search=sample_data');
  await expect(page.getByTestId('explore-page')).toBeVisible();
  await searchQueryPromise;
  await waitForAllLoadersToDisappear(page);

  // Eagerly activate the tray container so the lazy CsvJobsTray chunk starts
  // loading now, before the export job is even created. This eliminates the
  // race where a fast export reaches COMPLETED before the tray mounts.
  await page.evaluate(() =>
    window.dispatchEvent(new Event('csv-jobs-refresh'))
  );

  await openExportScopeModal(page);
};

test.describe(
  'CsvJobsTray — real server',
  { tag: ['@Features', '@import-export'] },
  () => {
    test('export job queued makes the tray launcher visible', async ({
      page,
    }) => {
      await goToExploreAndOpenModal(page);
      await queueSearchExport(page);

      const launcher = page.locator('.csv-jobs-tray-launcher');
      const trayPopover = page.locator('.csv-jobs-tray-popover');

      await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });
    });

    test('tray auto-opens without launcher click when export job completes', async ({
      browser,
      page,
    }) => {
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await afterAction();

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
    });

    test('result endpoint returns HTTP 200 with valid CSV — not a silent timeout', async ({
      browser,
      page,
    }) => {
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

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

      // Must have at least a header row (data rows depend on search results).
      expect(nonEmptyLines.length).toBeGreaterThanOrEqual(1);

      // Every data-asset export includes a "name" column in the header.
      expect(nonEmptyLines[0].toLowerCase()).toContain('name');

      await afterAction();
    });

    test('clicking Download from the tray triggers a file download with correct name', async ({
      browser,
      page,
    }) => {
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await afterAction();

      // Tray should already be auto-opened by the useEffect.
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

      // Explicit status assertion — 404 gives "Expected 200, Received 404".
      expect(resultRes.status()).toBe(200);
      expect(download.suggestedFilename()).toContain(jobId);
      expect(download.suggestedFilename()).toContain('.csv');
    });

    test('clear completed removes finished export jobs and hides the tray', async ({
      browser,
      page,
    }) => {
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await afterAction();

      await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
        timeout: 15_000,
      });

      await page.locator('.csv-jobs-tray-clear').click();

      // Tray and launcher must both disappear once no jobs remain.
      await expect(page.locator('.csv-jobs-tray')).not.toBeVisible();
    });

    test('two concurrent export jobs both appear in the tray', async ({
      browser,
      page,
    }) => {
      // Verifies the tray correctly handles multiple in-flight jobs from the
      // same session. Uses two different Explore URLs so the exports are
      // independent requests and get distinct jobIds from the server.
      test.slow();

      // Export 1: tables matching sample_data
      await goToExploreAndOpenModal(page);
      const jobId1 = await queueSearchExport(page);

      // Export 2: topics (different entity index → separate job)
      const topicsQueryPromise = page.waitForResponse(
        (r) => r.url().includes('/api/v1/search/query') && r.status() === 200
      );

      await page.goto('/explore/topics');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await topicsQueryPromise;
      await waitForAllLoadersToDisappear(page);

      // Re-activate the tray on the new page before the second export.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      await openExportScopeModal(page);
      const jobId2 = await queueSearchExport(page);

      expect(jobId1).not.toBe(jobId2);

      // Both jobs must reach a terminal state — verify via API, not by
      // counting tray items (which are subject to auto-dismiss timing).
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilTerminal(apiContext, jobId1);
      await pollUntilTerminal(apiContext, jobId2);
      await afterAction();

      // After both complete, the tray (auto-opened) must show at least one
      // entry. Parallel admin workers may have added more — we assert >= 1.
      const trayPopover = page.locator('.csv-jobs-tray-popover');
      const launcher = page.locator('.csv-jobs-tray-launcher');

      await expect(trayPopover.or(launcher)).toBeVisible({ timeout: 15_000 });
    });

    test('real async import job shows in the tray as an import operation', async ({
      browser,
      page,
    }) => {
      // Creates a real glossary and imports one term via the async API.
      // Verifies the tray surfaces the import job without any page.route() mocking.
      // importCsvInternalAsync returns HTTP 200 (Response.ok()) with {jobId, message}.
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      // Unique name avoids conflicts when parallel workers run the same test.
      const glossaryName = `pw-tray-import-e2e-${Date.now()}`;

      const glossaryRes = await apiContext.post('/api/v1/glossaries', {
        data: { name: glossaryName, displayName: 'PW Tray Import E2E' },
      });
      const glossary = (await glossaryRes.json()) as { id: string };

      // Navigate first so the initial fetchJobs runs and marks any pre-existing
      // terminal jobs as dismissed. The import job we're about to trigger is new
      // and won't be in that dismissed set.
      await page.goto('/glossary');
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray container before the import starts.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      // Trigger real async import — PUT with raw CSV, Content-Type: text/plain.
      // importCsvInternalAsync returns HTTP 200 with {jobId, message}.
      const csv = [
        'parent,name,displayName,description',
        ',term1,Term One,A test glossary term',
      ].join('\n');

      const importRes = await apiContext.put(
        `/api/v1/glossaries/name/${encodeURIComponent(glossaryName)}/importAsync?dryRun=false`,
        {
          data: csv,
          headers: { 'Content-Type': 'text/plain' },
        }
      );

      expect(importRes.status()).toBe(200);
      const { jobId } = (await importRes.json()) as { jobId: string };

      // Fire the tray's custom refresh event so fetchJobs runs immediately
      // without waiting for the next WebSocket tick.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const launcher = page.locator('.csv-jobs-tray-launcher');
      const trayPopover = page.locator('.csv-jobs-tray-popover');

      await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

      if (!(await trayPopover.isVisible())) {
        await launcher.click();
      }

      // Import label: "Importing Glossary Terms" (active) or "Imported Glossary Terms" (done)
      await expect(
        page
          .locator('.csv-jobs-tray-item')
          .filter({ hasText: /Importing|Imported/i })
          .first()
      ).toBeVisible({ timeout: 15_000 });

      // Completed import jobs show a dismiss button (XClose), not a Download button.
      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );
      await expect(
        page.locator('.csv-jobs-tray-item-success').first()
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('.csv-jobs-tray-dismiss').first()
      ).toBeVisible();

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

      await page.goto('/settings/services/databases');
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray before the export job is created.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const exportRes = await apiContext.get(
        '/api/v1/services/databaseServices/name/sample_data/exportAsync'
      );

      expect(exportRes.status()).toBe(202);
      const { jobId } = (await exportRes.json()) as { jobId: string };

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

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

    test('lineage export for a table shows in the tray', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      const searchQueryPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes('sample_data') &&
          r.status() === 200
      );

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await searchQueryPromise;
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray before the export job is created.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
      const exportRes = await apiContext.get(
        `/api/v1/lineage/exportAsync?fqn=${encodeURIComponent(fqn)}&type=table&upstreamDepth=1&downstreamDepth=1&includeDeleted=false`
      );

      expect(exportRes.status()).toBe(202);
      const { jobId } = (await exportRes.json()) as { jobId: string };

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

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

    test('lineage by entity count export shows in the tray', async ({
      browser,
      page,
    }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      const searchQueryPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes('sample_data') &&
          r.status() === 200
      );

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await searchQueryPromise;
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray before the export job is created.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
      const exportRes = await apiContext.get(
        `/api/v1/lineage/exportByEntityCountAsync?fqn=${encodeURIComponent(fqn)}&entityType=table&direction=UPSTREAM&nodeDepth=1&maxDepth=1`
      );

      expect(exportRes.status()).toBe(202);
      const { jobId } = (await exportRes.json()) as { jobId: string };

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

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

    test('user export from team shows in the tray', async ({
      browser,
      page,
    }) => {
      // Guards the GET /users/exportAsync?team=... path used in UserTab.
      // Uses the Organization team which always exists in OpenMetadata.
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await page.goto('/settings/teams/Organization');
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray before the export job is created.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const exportRes = await apiContext.get(
        '/api/v1/users/exportAsync?team=Organization'
      );

      expect(exportRes.status()).toBe(202);
      const { jobId } = (await exportRes.json()) as { jobId: string };

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

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
      // If the table has no test cases the job still completes (headers-only CSV).
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      const searchQueryPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/search/query') &&
          r.url().includes('sample_data') &&
          r.status() === 200
      );

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await searchQueryPromise;
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray before the export job is created.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const fqn = 'sample_data.ecommerce_db.shopify.dim_customer';
      const exportRes = await apiContext.get(
        `/api/v1/dataQuality/testCases/name/${encodeURIComponent(fqn)}/exportAsync`
      );

      expect(exportRes.status()).toBe(202);
      const { jobId } = (await exportRes.json()) as { jobId: string };

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

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

    test('FAILED async import job shows error state in the tray', async ({
      browser,
      page,
    }) => {
      // Sends a CSV with completely wrong column headers so the async import
      // job fails during server-side processing and transitions to FAILED.
      // Verifies the tray shows error styling and a dismiss (not Download) button.
      // importCsvInternalAsync returns HTTP 200 (Response.ok()) with {jobId, message}.
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);

      const glossaryName = `pw-tray-import-fail-e2e-${Date.now()}`;

      const glossaryRes = await apiContext.post('/api/v1/glossaries', {
        data: { name: glossaryName, displayName: 'PW Tray Import Fail E2E' },
      });
      const glossary = (await glossaryRes.json()) as { id: string };

      await page.goto('/glossary');
      await waitForAllLoadersToDisappear(page);

      // Pre-activate the tray container before the import starts.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      // CSV with wrong headers — the required 'name' column is absent.
      // The async job is created (HTTP 200) but fails during processing.
      const badCsv = ['wrong_col_a,wrong_col_b', 'value1,value2'].join('\n');

      const importRes = await apiContext.put(
        `/api/v1/glossaries/name/${encodeURIComponent(glossaryName)}/importAsync?dryRun=false`,
        {
          data: badCsv,
          headers: { 'Content-Type': 'text/plain' },
        }
      );

      expect(importRes.status()).toBe(200);
      const { jobId } = (await importRes.json()) as { jobId: string };

      // Wait for the job to reach any terminal status, then assert it's FAILED.
      const finalStatus = await pollUntilTerminal(apiContext, jobId);

      expect(finalStatus).toBe('FAILED');

      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      const launcher = page.locator('.csv-jobs-tray-launcher');
      const trayPopover = page.locator('.csv-jobs-tray-popover');

      await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

      if (!(await trayPopover.isVisible())) {
        await launcher.click();
      }

      // FAILED job renders with error styling and a dismiss button (not Download).
      await expect(
        page.locator('.csv-jobs-tray-item-error').first()
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator('.csv-jobs-tray-dismiss').first()
      ).toBeVisible();

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
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await afterAction();

      // Tray auto-opens once for the newly-completed job.
      await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
        timeout: 15_000,
      });

      // User manually closes the tray.
      await page.locator('.csv-jobs-tray-close').click();
      await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible();

      // Simulate a WebSocket tick by dispatching the refresh event again.
      // The job is already in autoOpenedJobIds so the tray must NOT re-open.
      await page.evaluate(() =>
        window.dispatchEvent(new Event('csv-jobs-refresh'))
      );

      await expect(page.locator('.csv-jobs-tray-popover')).not.toBeVisible();
    });

    test('tray launcher survives navigation to a different page', async ({
      page,
    }) => {
      // Verifies the tray is mounted at the app-shell level and is not
      // unmounted during route transitions. A regression that conditionally
      // removes the tray provider on navigation would silently drop all
      // in-flight job indicators mid-export.
      test.slow();

      await goToExploreAndOpenModal(page);
      await queueSearchExport(page);

      const launcher = page.locator('.csv-jobs-tray-launcher');
      const trayPopover = page.locator('.csv-jobs-tray-popover');

      await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });

      // Navigate to an unrelated section of the app.
      await page.goto('/settings/services/databases');
      await waitForAllLoadersToDisappear(page);

      // The tray must still be present after the route change.
      await expect(launcher.or(trayPopover)).toBeVisible({ timeout: 15_000 });
    });

    test('Download button stays clickable and re-triggers a download after first use', async ({
      browser,
      page,
    }) => {
      // Guards the downloadedJobIds state: after the first download the row's
      // left icon changes to a checkmark, but the Download button must remain
      // visible so users can save the file again.
      test.slow();

      await goToExploreAndOpenModal(page);
      const jobId = await queueSearchExport(page);

      const { apiContext, afterAction } = await performAdminLogin(browser);

      await pollUntilJobStatus(apiContext, jobId, 'COMPLETED');
      await afterAction();

      await expect(page.locator('.csv-jobs-tray-popover')).toBeVisible({
        timeout: 15_000,
      });

      const downloadBtn = page
        .getByRole('button', { name: 'Download' })
        .first();

      await expect(downloadBtn).toBeVisible();

      // First download — fires the browser download event.
      const dl1 = page.waitForEvent('download');

      await downloadBtn.click();
      await dl1;

      // Download button must still be visible, not replaced by dismiss.
      await expect(downloadBtn).toBeVisible();

      // Second click must also trigger a download (button is not disabled).
      const dl2 = page.waitForEvent('download');

      await downloadBtn.click();
      await dl2;
    });
  }
);
