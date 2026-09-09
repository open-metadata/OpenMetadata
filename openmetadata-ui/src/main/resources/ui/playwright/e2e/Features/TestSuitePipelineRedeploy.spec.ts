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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { GlobalSettingOptions } from '../../constant/settings';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
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

test.describe('Bulk Re-Deploy pipelines ', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);

    try {
      for (const table of [table1, table2]) {
        await table.create(apiContext);
        // A cron run at the hour boundary can race this deployment-only scenario.
        const { pipeline } = await table.createTestSuiteAndPipelines(
          apiContext,
          undefined,
          null
        );
        expect(pipeline.id, 'fixture pipeline must be created').toBeTruthy();
        expect(pipeline.name).toBeTruthy();
        expect(pipeline.airflowConfig.scheduleInterval ?? null).toBeNull();
      }
    } finally {
      await afterAction();
    }
  });

  test.afterAll(
    'Clean up fixture pipelines and tables',
    async ({ browser }) => {
      const { afterAction, apiContext } = await createNewPage(browser);
      try {
        const results = await Promise.allSettled(
          [table1, table2].map(async (table) => {
            try {
              if (table.testSuiteResponseData?.id) {
                const response = await apiContext.delete(
                  `/api/v1/dataQuality/testSuites/${table.testSuiteResponseData.id}?recursive=true&hardDelete=true`
                );
                expect([200, 404], 'fixture test suite cleanup').toContain(
                  response.status()
                );
              }
            } finally {
              if (table.serviceResponseData?.id) {
                const response = await apiContext.delete(
                  `/api/v1/services/databaseServices/${table.serviceResponseData.id}?recursive=true&hardDelete=true`
                );
                expect([200, 404], 'fixture table service cleanup').toContain(
                  response.status()
                );
              }
            }
          })
        );
        for (const result of results) {
          if (result.status === 'rejected') {
            throw result.reason;
          }
        }
      } finally {
        await afterAction();
      }
    }
  );

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
    await expect(page.getByTestId('ingestion-list-table')).toBeVisible();

    const pipelines = [table1, table2].flatMap(
      (table) => table.testSuitePipelineResponseData
    );
    expect(pipelines).toHaveLength(2);
    for (const pipeline of pipelines) {
      const row = getRowByName(page, pipeline.name);
      await expect(row).toBeVisible();
      await row.locator('label[slot="selection"]').click();
      await expect(row.getByRole('checkbox')).toBeChecked();
    }

    const redeployButton = page.getByRole('button', { name: 'Re Deploy' });
    await expect(redeployButton).toBeEnabled();
    const responses = pipelines.map((pipeline) =>
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname ===
            `/api/v1/services/ingestionPipelines/deploy/${pipeline.id}`
      )
    );
    const [deployResponses] = await Promise.all([
      Promise.all(responses),
      redeployButton.click(),
    ]);
    const results = await Promise.all(
      deployResponses.map(async (response, index) => ({
        pipelineId: pipelines[index].id,
        status: response.status(),
        ...(!response.ok()
          ? { error: (await response.text()).slice(0, 2000) }
          : {}),
      }))
    );
    expect(
      results,
      'each fixture pipeline must deploy; HTTP failures include the backend response'
    ).toEqual(
      pipelines.map((pipeline) => ({ pipelineId: pipeline.id, status: 200 }))
    );

    await toastNotification(page, /Pipelines Re Deploy Successfully/i);
  });

  // TODO: Add test to verify the re-deployed pipelines for Database, Dashboard and other entities
});
