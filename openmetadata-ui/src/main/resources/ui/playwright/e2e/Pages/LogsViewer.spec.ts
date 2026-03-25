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

import { expect } from '@playwright/test';
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_INGESTION_TAG_OBJ,
} from '../../constant/config';
import { BundleTestSuiteClass } from '../../support/entity/BundleTestSuiteClass';
import { TableClass } from '../../support/entity/TableClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForFirstPipelineStatusNotQueued } from '../../utils/logsViewer';
import { test } from '../fixtures/pages';

const table = new TableClass();
const bundleTestSuite = new BundleTestSuiteClass();

test.describe(
  'Logs viewer page',
  {
    tag: [
      `${DOMAIN_TAGS.OBSERVABILITY}:Logs_Viewer`,
      PLAYWRIGHT_INGESTION_TAG_OBJ.tag,
    ],
  },
  () => {
    test.beforeAll(
      'Create table, bundle test suite, pipeline, and run pipeline for logs viewer',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        await table.create(apiContext);
        await bundleTestSuite.createBundleTestSuite(apiContext);
        const { pipeline } =
          await bundleTestSuite.createBundleTestSuitePipeline(apiContext);
        await bundleTestSuite.runIngestionPipeline(apiContext, pipeline.id);

        await afterAction();
      }
    );

    test('Logs page shows breadcrumb, summary, and log viewer or empty state after opening from bundle suite pipeline tab', async ({
      page,
    }) => {
      test.slow();
      test.setTimeout(6 * 60 * 1000);

      await test.step('Open Data Quality → Bundle Suites and click on the newly created bundle', async () => {
        await redirectToHomePage(page);

        const listResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/dataQuality/testSuites/search/list') &&
            r.status() === 200
        );
        await page.goto('/data-quality/test-suites/bundle-suites');
        await listResponse;
        await waitForAllLoadersToDisappear(page);

        const bundleSuiteFqn =
          bundleTestSuite.bundleTestSuiteResponseData?.fullyQualifiedName ??
          bundleTestSuite.bundleTestSuiteResponseData?.name;
        expect(
          bundleSuiteFqn,
          'bundle suite created in beforeAll'
        ).toBeTruthy();
        const bundleSuiteLink = page
          .getByTestId('test-suite-table')
          .locator(`a[href*="${encodeURIComponent(bundleSuiteFqn)}"]`);
        await expect(bundleSuiteLink).toBeVisible({ timeout: 10000 });
        await bundleSuiteLink.click();
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Open Pipeline tab and click Logs for first pipeline', async () => {
        await waitForFirstPipelineStatusNotQueued(page);

        const pipelinesResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/services/ingestionPipelines') &&
            r.status() === 200
        );
        const logsLastResponse = page.waitForResponse((r) => {
          const url = r.url();
          return (
            url.includes('/api/v1/services/ingestionPipelines/logs/') &&
            url.includes('/last') &&
            r.status() === 200
          );
        });
        await expect(page.getByTestId('logs-button').first()).toBeVisible();
        await page.getByTestId('logs-button').first().click();
        await pipelinesResponse;
        await logsLastResponse;
      });

      await test.step('Wait for logs page to load and verify all key elements', async () => {
        await page.waitForURL(/\/testSuite\/.*\/logs/);

        await waitForAllLoadersToDisappear(page);

        await expect(page.getByTestId('skeleton-container')).not.toBeVisible();

        await expect(page.getByTestId('breadcrumb')).toBeVisible();
        await expect(page.getByTestId('summary-card')).toBeVisible();

        const hasLogContent = await page.getByTestId('lazy-log').isVisible();
        const hasNoLogsEmptyState = await page
          .getByTestId('no-data-placeholder')
          .filter({
            has: page.getByText(/no .* log|logs.*available/i),
          })
          .isVisible();

        expect(hasLogContent || hasNoLogsEmptyState).toBeTruthy();
      });

      await test.step('Verify action buttons work when log content is present', async () => {
        const jumpToEnd = page.getByTestId('jump-to-end-button');
        const downloadBtn = page.getByTestId('download');
        const copyToClipboardBtn = page.getByTestId('copy-secret');

        await expect(jumpToEnd).toBeEnabled();
        await expect(downloadBtn).toBeVisible();
        await expect(copyToClipboardBtn).toBeVisible();
      });
    });
  }
);
