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
import {
  navigateToBundleSuiteWithPagination,
  waitForFirstPipelineStatusNotQueued,
} from '../../utils/logsViewer';
import { test } from '../fixtures/pages';

let table: TableClass;
let bundleTestSuite: BundleTestSuiteClass;

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
        table = new TableClass();
        bundleTestSuite = new BundleTestSuiteClass();

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
      // 6 minutes
      test.setTimeout(6 * 60 * 1000);

      // The copy toolbar action writes to the clipboard; grant permission so
      // the "Copied" state can be asserted.
      await page.context().grantPermissions(['clipboard-write']);

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
        await navigateToBundleSuiteWithPagination(page, bundleSuiteFqn);
      });

      await test.step('Open Pipeline tab and click Logs for first pipeline', async () => {
        await waitForFirstPipelineStatusNotQueued(page);

        const pipelinesResponse = page.waitForResponse(
          (r) =>
            r.url().includes('/api/v1/services/ingestionPipelines') &&
            r.status() === 200
        );
        await expect(page.getByTestId('logs-button').first()).toBeVisible();
        await page.getByTestId('logs-button').first().click();
        await pipelinesResponse;
      });

      await test.step('The logs viewer modal opens in place with its toolbar', async () => {
        await expect(page.getByTestId('log-viewer-title')).toBeVisible();
        await expect(page.getByTestId('log-viewer-fullscreen')).toBeVisible();
        await expect(page.getByTestId('log-viewer-jump-to-end')).toBeVisible();
        await expect(page.getByTestId('log-viewer-close')).toBeVisible();

        // The URL must NOT change — the logs viewer is now an in-place modal.
        expect(page.url()).not.toContain('/logs');
      });

      await test.step('Toggling fullscreen expands and restores the modal', async () => {
        const fullScreen = page.getByTestId('log-viewer-fullscreen');

        await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');
        await fullScreen.click();
        await expect(fullScreen).toHaveAttribute('aria-pressed', 'true');
        await fullScreen.click();
        await expect(fullScreen).toHaveAttribute('aria-pressed', 'false');
      });

      await test.step('Hovering a toolbar button shows its tooltip', async () => {
        await page.getByTestId('log-viewer-wrap').hover();

        await expect(page.getByRole('tooltip')).toBeVisible();
      });

      await test.step('Toggling wrap flips its pressed state', async () => {
        const wrap = page.getByTestId('log-viewer-wrap');

        await expect(wrap).toHaveAttribute('aria-pressed', 'false');
        await wrap.click();
        await expect(wrap).toHaveAttribute('aria-pressed', 'true');
        await wrap.click();
        await expect(wrap).toHaveAttribute('aria-pressed', 'false');
      });

      await test.step('Copying the logs switches the button to the copied state', async () => {
        const copy = page.getByTestId('log-viewer-copy');

        await expect(copy).toContainText('Copy');
        await copy.click();
        await expect(copy).toContainText('Copied');
      });

      await test.step('Searching a non-matching term shows the empty state', async () => {
        const search = page.getByTestId('log-viewer-search');

        await search.fill('zzq-no-log-line-match-zzq');
        await expect(page.getByTestId('log-viewer-match-count')).toBeVisible();
        await expect(page.getByTestId('log-viewer-empty')).toBeVisible();

        await search.clear();
        await expect(page.getByTestId('log-viewer-empty')).not.toBeVisible();
      });

      await test.step('Jump-to-end keeps the log body visible', async () => {
        await page.getByTestId('log-viewer-jump-to-end').click();

        await expect(page.getByTestId('log-viewer-body')).toBeVisible();
      });

      await test.step('Closing the modal returns to the pipeline tab', async () => {
        await page.getByTestId('log-viewer-close').click();
        await expect(page.getByTestId('log-viewer-title')).not.toBeVisible();
      });
    });
  }
);
