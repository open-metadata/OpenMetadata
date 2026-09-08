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
import { settingClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table1 = new TableClass();
const table2 = new TableClass();

test.describe('Bulk Re-Deploy pipelines ', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    await table1.create(apiContext);
    await table2.create(apiContext);

    await table1.createTestSuiteAndPipelines(apiContext);
    await table2.createTestSuiteAndPipelines(apiContext);

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

    await expect(
      page.getByRole('button', { name: 'Re Deploy' })
    ).not.toBeEnabled();
    await expect(page.locator('.ant-table-container')).toBeVisible();

    // beforeAll creates one test-suite pipeline per table, and there are two
    // tables -- so this is the fixture's count, not an arbitrary number. One
    // source for it, so the deploy assertion below cannot drift from the
    // selection here.
    const selectedPipelineCount = 2;
    const rowCheckboxes = page.locator(`td [type="checkbox"]`);

    // The listing is global and can lag behind the pipelines this spec just
    // created. Wait for enough rows first: nth() on a shorter list auto-waits
    // and would spend the whole budget instead of saying what was missing.
    await expect
      .poll(() => rowCheckboxes.count(), {
        message: `Wait for at least ${selectedPipelineCount} test-suite pipelines to be listed`,
        timeout: 30_000,
      })
      .toBeGreaterThanOrEqual(selectedPipelineCount);

    for (let index = 0; index < selectedPipelineCount; index++) {
      await rowCheckboxes.nth(index).click();
    }

    await expect(page.getByRole('button', { name: 'Re Deploy' })).toBeEnabled();

    // The component awaits Promise.all over every selected pipeline, so the
    // success toast needs all of them to deploy. Waiting on a single 200 only
    // proves the first did: when a later deploy fails the UI shows the error
    // toast instead, and the test then waits out its whole budget for a success
    // toast that can never arrive. Collect every deploy and report the real
    // status, so a genuine deploy failure fails fast and says why.
    const deployStatuses: number[] = [];
    const collectDeploy = (response: Response) => {
      if (
        response.request().method() === 'POST' &&
        response.url().includes('/api/v1/services/ingestionPipelines/deploy')
      ) {
        deployStatuses.push(response.status());
      }
    };
    page.on('response', collectDeploy);

    try {
      await page.getByRole('button', { name: 'Re Deploy' }).click();

      await expect
        .poll(() => deployStatuses.length, {
          message: 'Wait for every selected pipeline to report a deploy result',
          timeout: 30_000,
        })
        .toBe(selectedPipelineCount);

      expect(
        deployStatuses,
        'every selected pipeline must deploy for the success toast to appear'
      ).toEqual(Array(selectedPipelineCount).fill(200));
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
