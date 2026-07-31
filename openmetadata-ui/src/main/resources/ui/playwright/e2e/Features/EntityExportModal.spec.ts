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

/**
 * E2E regression tests for EntityExportModalProvider polling bugs.
 *
 * Entity lineage export is the only production path that opens the modal
 * (exportTypes = [CSV, PNG]) and triggers the async polling path (backend
 * returns a jobId). Both tests mock the API layer so they run without
 * requiring a large lineage graph.
 */

import { expect, Page } from '@playwright/test';
import { test } from '../fixtures/pages';

test.use({ storageState: 'playwright/.auth/admin.json' });

const LINEAGE_URL =
  '/table/sample_data.ecommerce_db.shopify.raw_customer/lineage?fullscreen=true';

const JOB_ID = 'pw-export-modal-job-001';

const COMPLETED_JOB = {
  jobId: JOB_ID,
  operation: 'EXPORT',
  entityType: 'table',
  createdBy: 'admin',
  status: 'COMPLETED',
};

const RUNNING_JOB = {
  ...COMPLETED_JOB,
  status: 'RUNNING',
};

const openExportModalWithCsv = async (page: Page) => {
  const lineageResponse = page.waitForResponse('**/api/v1/lineage/getLineage*');
  await page.goto(LINEAGE_URL);
  await lineageResponse;

  await expect(page.getByTestId('export-button')).toBeEnabled();
  await page.getByTestId('export-button').click();

  await expect(
    page.locator('[data-testid="export-entity-modal"]')
  ).toBeVisible();

  // Modal defaults to CSV for entity lineage — no type change needed.
};

test.describe(
  'EntityExportModal — polling regression',
  { tag: '@import-export' },
  () => {
    test('Cancel button stops async polling — no further status requests after dismiss', async ({
      page,
    }) => {
      await page.route('**/api/v1/lineage/exportAsync**', (route) =>
        route.fulfill({
          contentType: 'application/json',
          json: { jobId: JOB_ID, message: 'Export started' },
        })
      );

      await page.route(`**/api/v1/csvAsyncJobs/${JOB_ID}`, (route) =>
        route.fulfill({ contentType: 'application/json', json: RUNNING_JOB })
      );

      let statusCallCount = 0;
      page.on('request', (req) => {
        if (
          req.url().includes(`csvAsyncJobs/${JOB_ID}`) &&
          !req.url().includes('/result')
        ) {
          statusCallCount++;
        }
      });

      await openExportModalWithCsv(page);

      // Install fake browser clock after the page has loaded so timers in
      // the polling loop are controllable without affecting page navigation.
      await page.clock.install();

      await page.getByTestId('submit-button').click();

      // The first poll (attempt 0) fires without a timer — wait for it.
      await expect
        .poll(() => statusCallCount, { timeout: 15_000 })
        .toBeGreaterThan(0);

      const countBeforeCancel = statusCallCount;

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(
        page.locator('[data-testid="export-entity-modal"]')
      ).not.toBeVisible();

      // Advance 15 s of fake time — cancel already cleared the retry timer
      // via clearTimeout, so no new requests should fire.
      await page.clock.fastForward(15_000);

      expect(statusCallCount).toBe(countBeforeCancel);
    });

    test('Result-download failure shows an error Alert and keeps the modal open', async ({
      page,
    }) => {
      await page.route('**/api/v1/lineage/exportAsync**', (route) =>
        route.fulfill({
          contentType: 'application/json',
          json: { jobId: JOB_ID, message: 'Export started' },
        })
      );

      // Status poll returns COMPLETED; result download returns 500.
      await page.route(`**/api/v1/csvAsyncJobs/${JOB_ID}`, (route) =>
        route.fulfill({ contentType: 'application/json', json: COMPLETED_JOB })
      );

      await page.route(`**/api/v1/csvAsyncJobs/${JOB_ID}/result`, (route) =>
        route.fulfill({
          contentType: 'application/json',
          json: { message: 'Internal server error' },
          status: 500,
        })
      );

      let unexpectedDownload = false;
      page.on('download', () => {
        unexpectedDownload = true;
      });

      await openExportModalWithCsv(page);
      await page.getByTestId('submit-button').click();

      // Modal must remain open after the result-download failure.
      await expect(
        page.locator('[data-testid="export-entity-modal"]')
      ).toBeVisible({ timeout: 15_000 });

      // An error message must appear inside the modal.
      await expect(
        page.locator('[data-testid="export-entity-modal"]')
      ).toContainText(/unexpected/i, { timeout: 15_000 });

      expect(unexpectedDownload).toBe(false);
    });
  }
);
