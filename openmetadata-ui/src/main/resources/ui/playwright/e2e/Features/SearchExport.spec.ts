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

import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  clickOutside,
  getApiContext,
  redirectToExplorePage,
} from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  clickUpdateButtonIfVisible,
  countCsvResponseRows,
  getExportCountFromModal,
  getExportModalContent,
  openExportScopeModal,
} from '../../utils/explore';

// Dedicated admin user so that completed search-export background jobs
// accumulate in this user's tray instead of the shared admin session,
// preventing the tray from blocking other admin tests in the same worker.
let searchExportUser: UserClass;

const startAsyncExport = async (page: Page) => {
  const exportAsyncPromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/export/async') &&
      response.status() === 202
  );

  await getExportModalContent(page)
    .getByRole('button', { name: 'Export' })
    .click();

  const { jobId } = (await (await exportAsyncPromise).json()) as {
    jobId: string;
  };

  await expect(page.getByText('Export started')).toBeVisible();
  await expect(getExportModalContent(page)).not.toBeVisible();

  return jobId;
};

const waitForExportJobCompleted = async (
  apiContext: APIRequestContext,
  jobId: string
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const response = await apiContext.get('/api/v1/csvAsyncJobs?limit=50');
        const jobs = (await response.json()) as Array<{
          jobId: string;
          status: string;
        }>;

        // An unauthenticated or errored call returns an object, not a list, and
        // `jobs.find` then fails with a TypeError that says nothing about why.
        if (!Array.isArray(jobs)) {
          throw new Error(
            `csvAsyncJobs returned ${response.status()}: ${JSON.stringify(
              jobs
            ).slice(0, 200)}`
          );
        }

        return jobs.find((job) => job.jobId === jobId)?.status;
      },
      { timeout: 90_000 }
    )
    .toBe('COMPLETED');
};

const fetchCompletedExportCsv = async (
  apiContext: APIRequestContext,
  jobId: string
): Promise<string> => {
  await waitForExportJobCompleted(apiContext, jobId);

  const resultResponse = await apiContext.get(
    `/api/v1/csvAsyncJobs/${jobId}/result`
  );

  expect(resultResponse.status()).toBe(200);

  return resultResponse.text();
};

test.describe(
  'Search Export',
  { tag: ['@Features', '@Discovery', '@import-export'] },
  () => {
    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      const serviceRes = await apiContext.get(
        '/api/v1/services/databaseServices/name/sample_data'
      );
      const service = await serviceRes.json();
      if (service.displayName) {
        await apiContext.patch(
          `/api/v1/services/databaseServices/${service.id}`,
          {
            data: [
              { op: 'replace', path: '/displayName', value: 'sample_data' },
            ],
            headers: { 'Content-Type': 'application/json-patch+json' },
          }
        );
      }

      searchExportUser = new UserClass(undefined, true);
      await searchExportUser.create(apiContext);

      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      if (searchExportUser) {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        await searchExportUser.delete(apiContext);
        await afterAction();
      }
    });

    test.beforeEach(async ({ page }) => {
      await searchExportUser.login(page);
      await redirectToExplorePage(page);
    });

    test('Export button opens scope modal with correct options', async ({
      page,
    }) => {
      await test.step('Export button is visible', async () => {
        await page.getByRole('button', { name: 'Tools' }).click();
        const exportButton = page.getByRole('menuitemradio', {
          name: 'Export',
        });

        await expect(exportButton).toBeVisible();
        await expect(exportButton).toContainText('Export');
        await clickOutside(page); // Close the dropdown after assertion
      });

      await test.step('Clicking Export opens scope modal with title and scope label', async () => {
        await openExportScopeModal(page);

        const modalContent = getExportModalContent(page);

        await expect(modalContent.locator('.ant-modal-title')).toContainText(
          'Export'
        );
        await expect(modalContent.getByText('Export Scope')).toBeVisible();
      });

      await test.step('Modal shows tab-specific scope and All matching assets options', async () => {
        const modalContent = getExportModalContent(page);

        await expect(
          modalContent.getByTestId('export-scope-visible-card')
        ).toBeVisible();
        await expect(
          modalContent.getByTestId('export-scope-all-card')
        ).toBeVisible();
      });

      await test.step('All matching assets is selected by default', async () => {
        await expect(
          getExportModalContent(page).locator('input[value="all"]')
        ).toBeChecked();
      });

      await test.step('Selecting the tab-scope card checks the visible radio', async () => {
        const modalContent = getExportModalContent(page);

        await modalContent.locator('input[value="visible"]').click();
        await expect(
          modalContent.locator('input[value="visible"]')
        ).toBeChecked();
      });

      await test.step('Cancel button closes the modal', async () => {
        await getExportModalContent(page)
          .getByRole('button', { name: 'Cancel' })
          .click();

        await expect(getExportModalContent(page)).not.toBeVisible();
      });
    });

    test('Search mode visible export downloads CSV with tab-specific row count', async ({
      page,
    }) => {
      test.slow();

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();

      const countApiPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.status() === 200
      );

      await openExportScopeModal(page);
      await countApiPromise;

      const modalContent = getExportModalContent(page);

      await modalContent.locator('input[value="visible"]').click();

      const expectedCount =
        await test.step('Read displayed count from Visible Results card', () =>
          getExportCountFromModal(modalContent, 'export-scope-visible-count'));

      const jobId = await startAsyncExport(page);

      await test.step('CSV row count matches the displayed tab count', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        const csvText = await fetchCompletedExportCsv(apiContext, jobId);

        expect(countCsvResponseRows(csvText)).toBe(expectedCount);

        await afterAction();
      });
    });

    test('Search mode visible export count matches the first result tab count', async ({
      page,
    }) => {
      const countApiPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.status() === 200
      );

      await page.goto(
        '/explore/tables?search=sample_data.ecommerce_db.shopify.dim_customer'
      );
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await countApiPromise;

      const firstTabCount =
        await test.step('Read the count from the first left panel result tab', async () => {
          const firstTabCountText = await page
            .getByTestId('explore-left-panel')
            .locator('[role="menuitem"]')
            .first()
            .getByTestId('filter-count')
            .textContent();

          return parseInt(firstTabCountText?.trim() ?? '0', 10);
        });

      await openExportScopeModal(page);

      const visibleExportCount =
        await test.step('Read the visible results count from the export modal', () =>
          getExportCountFromModal(
            getExportModalContent(page),
            'export-scope-visible-count'
          ));

      await test.step('Visible export count matches the first result tab count', async () => {
        expect(visibleExportCount).toBe(firstTabCount);
      });
    });

    test('Filtered search visible export downloads CSV with the filtered record count', async ({
      page,
    }) => {
      test.slow();

      const searchResultsPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.status() === 200
      );

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await searchResultsPromise;
      await waitForAllLoadersToDisappear(page);

      await test.step('Apply Service filter from the Explore page', async () => {
        await page.getByTestId('search-dropdown-Service').click();

        const serviceAggregatePromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/aggregate') &&
            response.url().includes('sample_data') &&
            response.status() === 200
        );

        await page.getByTestId('search-input').fill('sample_data');
        await serviceAggregatePromise;
        const filteredQueryPromise = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.status() === 200
        );

        await page.getByTestId('sample_data').click();
        await expect(page.getByTestId('sample_data-checkbox')).toBeChecked();

        await clickUpdateButtonIfVisible(page);
        await filteredQueryPromise;
        await waitForAllLoadersToDisappear(page);
      });

      const filteredCount =
        await test.step('Read filtered count from the first left panel tab', async () => {
          const filteredCountText = await page
            .getByTestId('explore-left-panel')
            .locator('[role="menuitem"]')
            .first()
            .getByTestId('filter-count')
            .textContent();

          return parseInt(filteredCountText?.trim() ?? '0', 10);
        });

      await openExportScopeModal(page);

      const modalContent = getExportModalContent(page);
      await modalContent.locator('input[value="visible"]').click();

      const visibleExportCount =
        await test.step('Read filtered visible count from the export modal', () =>
          getExportCountFromModal(modalContent, 'export-scope-visible-count'));

      await test.step('Filtered page count matches the export modal count', async () => {
        expect(visibleExportCount).toBe(filteredCount);
      });

      const jobId = await startAsyncExport(page);

      await test.step('CSV row count matches the filtered record count', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        const csvText = await fetchCompletedExportCsv(apiContext, jobId);

        expect(countCsvResponseRows(csvText)).toBe(filteredCount);

        await afterAction();
      });
    });

    test('Browse mode visible export downloads CSV with current page row count', async ({
      page,
    }) => {
      test.slow();

      // Browse mode (no search term) queries the unified `dataAsset` index
      // regardless of the tab in the URL, so wait for that rather than a
      // per-entity `index=topic` request (which only fires for a tab search).
      const browseQueryPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.url().includes('index=dataAsset') &&
          response.status() === 200
      );

      await page.goto('/explore/topics');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await browseQueryPromise;
      await waitForAllLoadersToDisappear(page);
      await expect(
        page.locator('[data-testid^="table-data-card_"]').first()
      ).toBeVisible();

      await openExportScopeModal(page);

      const modalContent = getExportModalContent(page);

      await modalContent.locator('input[value="visible"]').click();
      await expect(
        modalContent.locator('input[value="visible"]')
      ).toBeChecked();

      const expectedCount =
        await test.step('Read displayed count from Visible Results card', () =>
          getExportCountFromModal(modalContent, 'export-scope-visible-count'));

      const jobId = await startAsyncExport(page);

      await test.step('CSV row count matches the displayed page count', async () => {
        const { apiContext, afterAction } = await getApiContext(page);
        const csvText = await fetchCompletedExportCsv(apiContext, jobId);

        expect(countCsvResponseRows(csvText)).toBe(expectedCount);

        await afterAction();
      });
    });

    test('Export is disabled when all matching assets exceed 200k', async ({
      page,
    }) => {
      await page.route('**/api/v1/search/query?*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            took: 1,
            hits: {
              total: {
                value: 200001,
                relation: 'eq',
              },
              hits: [],
            },
            aggregations: {},
          }),
        });
      });

      await openExportScopeModal(page);

      const modalContent = getExportModalContent(page);
      const exportButton = modalContent.getByRole('button', { name: 'Export' });

      await test.step('Limit alert is shown in modal', async () => {
        await expect(
          modalContent.getByText(
            'Export is limited to 200000 assets. Please refine your filters or choose visible results.'
          )
        ).toBeVisible();
      });

      await test.step('Export button remains disabled', async () => {
        await expect(exportButton).toBeDisabled();
      });
    });

    test('Export queues a background job and downloads from the jobs tray', async ({
      page,
    }) => {
      test.slow();

      const countApiPromise = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/search/query') &&
          response.status() === 200
      );

      await page.goto('/explore/tables?search=sample_data');
      await expect(page.getByTestId('explore-page')).toBeVisible();
      await countApiPromise;

      await openExportScopeModal(page);

      const jobId = await startAsyncExport(page);

      await test.step('Jobs tray surfaces the export job', async () => {
        // PR #30615 added a useEffect that calls setOpen(true) when a job
        // reaches a terminal state, auto-opening the tray and hiding the
        // launcher button ({!open && !isEmpty(visibleJobs) && ...} renders
        // nothing once open=true).
        //
        // Race: right after startAsyncExport, visibleJobs may still be
        // empty (socket event not yet received), so neither the launcher
        // nor the tray has rendered yet. A bare click() on the launcher
        // fails during this window.
        //
        // Fix: wait for whichever surface appears first, then open the tray
        // only if it has not already been auto-opened.
        const launcherButton = page.getByRole('button', {
          name: /Background jobs|jobs running/,
        });
        const trayPopover = page.locator('.csv-jobs-tray-popover');

        // Block until the launcher (job in progress) or the tray (job
        // completed and auto-opened by the useEffect) is in the DOM.
        await expect(launcherButton.or(trayPopover)).toBeVisible();

        // Open the tray only if it has not already been auto-opened.
        // When the job finished fast, the tray is already visible and the
        // launcher is gone from the DOM — clicking it would throw.
        if (!(await trayPopover.isVisible())) {
          await launcherButton.click();
        }

        await expect(
          page.getByText(/Exporting|Exported/).first()
        ).toBeVisible();
      });

      await test.step('Download from the tray serves the job result CSV', async () => {
        // The Download button only renders once the async job finishes, so waiting
        // blind on it spent up to 90s of the test budget before the download waits
        // even started -- the remainder then ran out mid-wait and surfaced as
        // "Target page, context or browser has been closed". Poll the job over the
        // API first (the same way fetchCompletedExportCsv does), so a stalled job is
        // named as such and the UI waits that follow are short.
        //
        // getApiContext(page), not page.request: page.request carries cookies but
        // not the bearer token the csvAsyncJobs endpoint requires. getApiContext
        // extracts the token from the page's storage so the request is authenticated
        // as searchExportUser — the same user who created the job.
        const { apiContext, afterAction } = await getApiContext(page);
        await waitForExportJobCompleted(apiContext, jobId);
        await afterAction();

        // Scope to the specific job's tray row so we don't accidentally click
        // an already-visible Download button from a different completed job
        // (e.g. "Exported Lineage") whose result URL won't match jobId.
        const jobRow = page.locator(`[data-testid="csv-job-${jobId}"]`);
        await expect(jobRow).toBeVisible();

        const downloadButton = jobRow.getByRole('button', { name: 'Download' });
        await expect(downloadButton).toBeVisible();

        const resultResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes(`/api/v1/csvAsyncJobs/${jobId}/result`) &&
            response.status() === 200
        );
        const downloadPromise = page.waitForEvent('download');

        await downloadButton.click();
        await resultResponsePromise;

        const download = await downloadPromise;

        expect(download.suggestedFilename()).toContain(jobId);
        expect(download.suggestedFilename()).toContain('.csv');
      });
    });
  }
);
