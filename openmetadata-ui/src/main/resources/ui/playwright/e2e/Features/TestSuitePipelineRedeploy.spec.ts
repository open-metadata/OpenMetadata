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
import test, { expect, Response } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { TableClass } from '../../support/entity/TableClass';
import {
  createNewPage,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { getRowByName } from '../../utils/scopedLocators';
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();

// The grid lists every test-suite pipeline in the deployment, not just this spec's, and the
// default page holds 15. Widen it so both pipelines below are always on the page the test
// reads -- the listing is name-ordered and pipelines named with a bare UUID (how
// DataContractRepository names a contract's DQ pipeline) sort ahead of every `pw-*` one.
const PIPELINE_PAGE_SIZE = 100;

test.describe('Bulk Re-Deploy pipelines ', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.create(apiContext);
    await table2.create(apiContext);

    await table1.createTestSuiteAndPipelines(apiContext);
    await table2.createTestSuiteAndPipelines(apiContext);

    await afterAction();
  });

  // Without this the two services -- and the test-suite pipelines under them -- outlive the
  // spec and stay in the shared Data Observability listing for every later test in the shard.
  test.afterAll('Cleanup', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.delete(apiContext);
    await table2.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Visit home page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  /**
   * Re-deploy all TestSuite ingestion pipelines
   * @description Navigates to Data Observability settings, selects multiple pipelines, triggers bulk redeploy,
   * and verifies success confirmation.
   */
  test('Re-deploy all test-suite ingestion pipelines', async ({ page }) => {
    await settingClick(page, GlobalSettingOptions.DATA_OBSERVABILITY);

    // usePaging seeds pageSize from the URL on first render, so widening the page is a
    // navigation rather than a click through the (conditionally rendered) size selector.
    const listUrl = new URL(page.url());
    listUrl.searchParams.set('pageSize', String(PIPELINE_PAGE_SIZE));
    await page.goto(listUrl.toString());

    await expect(
      page.getByRole('button', { name: 'Re Deploy' })
    ).not.toBeEnabled();
    await expect(page.getByTestId('ingestion-list-table')).toBeVisible();

    // Select this spec's own pipelines by name. Selecting by row position instead meant the
    // test never touched them: the listing is global, so the top rows belong to whatever else
    // exists in the deployment, and the assertion below then tracked a foreign pipeline whose
    // deployability this spec does not control.
    const pipelines = [
      table1.testSuitePipelineResponseData[0],
      table2.testSuitePipelineResponseData[0],
    ];

    for (const pipeline of pipelines) {
      const row = getRowByName(page, pipeline.name);

      // hasText is a substring match, so pin it to exactly one row before selecting it --
      // otherwise a near-miss silently selects the wrong pipeline, or several.
      await expect(row).toHaveCount(1);
      // TableV2 selection: the sr-only checkbox input is pointer-intercepted, so
      // target the pressable label slot rather than the raw input.
      await row.locator('label[slot="selection"]').click();
      await expect(row.getByRole('checkbox')).toBeChecked();
    }

    await expect(page.getByRole('button', { name: 'Re Deploy' })).toBeEnabled();

    // The component awaits Promise.all over every selected pipeline, so the
    // success toast needs all of them to deploy. Waiting on a single 200 only
    // proves the first did: when a later deploy fails the UI shows the error
    // toast instead, and the test then waits out its whole budget for a success
    // toast that can never arrive. Collect every deploy and report the real
    // status, so a genuine deploy failure fails fast and says why.
    //
    // Keyed by pipeline id rather than pushed onto a list: an id says which pipeline failed
    // straight from the assertion diff, and a deploy this test did not ask for cannot pad the
    // count into passing.
    const deployStatuses: Record<string, number> = {};
    const collectDeploy = (response: Response) => {
      const deployedId = response
        .url()
        .match(
          /\/api\/v1\/services\/ingestionPipelines\/deploy\/([^/?]+)/
        )?.[1];

      if (response.request().method() === 'POST' && deployedId) {
        deployStatuses[deployedId] = response.status();
      }
    };
    page.on('response', collectDeploy);

    try {
      await page.getByRole('button', { name: 'Re Deploy' }).click();

      await expect
        .poll(() => Object.keys(deployStatuses).length, {
          message: 'Wait for every selected pipeline to report a deploy result',
          timeout: 30_000,
        })
        .toBe(pipelines.length);

      expect(
        deployStatuses,
        'every selected pipeline must deploy for the success toast to appear'
      ).toEqual(
        Object.fromEntries(pipelines.map((pipeline) => [pipeline.id, 200]))
      );
    } finally {
      // Scope the listener to the action it observes: left attached it would
      // keep collecting for the page's lifetime, and a second test in this
      // describe would then assert against another test's deploys too.
      page.off('response', collectDeploy);
    }

    await toastNotification(page, /Pipelines Re Deploy Successfully/i);
  });

  // TODO: Add test to verify the re-deployed pipelines for Database, Dashboard and other entities
});
