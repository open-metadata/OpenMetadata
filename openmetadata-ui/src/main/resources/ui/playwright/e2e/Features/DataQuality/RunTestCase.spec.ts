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
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../../constant/config';
import { RUN_TEST_CASE_BUTTON_TEST_ID } from '../../../constant/dataQuality';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  createTableWithTestCase,
  createUnscheduledTestSuitePipeline,
  expectRunTestCaseDisabledWithReason,
  isPipelinePermissionResponse,
  isRunTestCaseResponse,
  openTestCaseDetailsPage,
  patchIngestionPipeline,
} from '../../../utils/testCases';
import { test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

const openDetailsPage = async (page: Page, table: TableClass) => {
  await enableAiAppMode(page);
  await openTestCaseDetailsPage(
    page,
    table.testCasesResponseData[0].fullyQualifiedName as string
  );
};

test.describe('Run Test Case', { tag: ['@Observability'] }, () => {
  test.describe('Without a pipeline', () => {
    let table: TableClass;

    test.beforeAll('Create a test case', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      table = await createTableWithTestCase(apiContext);
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('disables Run now and explains that no pipeline is linked', async ({
      page,
    }) => {
      await openDetailsPage(page, table);

      await expectRunTestCaseDisabledWithReason(page, 'No pipeline linked');
    });
  });

  test.describe('With an undeployed pipeline', () => {
    let table: TableClass;

    test.beforeAll(
      'Create a test case and an undeployed pipeline',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        table = await createTableWithTestCase(apiContext);
        await table.createTestSuitePipeline(apiContext);
        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('disables Run now and explains that the pipeline is not deployed', async ({
      page,
    }) => {
      await openDetailsPage(page, table);

      await expectRunTestCaseDisabledWithReason(
        page,
        'Pipeline is not deployed'
      );
    });
  });

  // Marked deployed rather than deployed: these tests only need the page to see
  // a runnable pipeline, and the common shards have no Airflow to deploy to.
  test.describe('With a runnable pipeline', () => {
    let table: TableClass;
    let pipeline: { id: string; name: string };

    test.beforeAll(
      'Create a test case and a pipeline marked deployed',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        table = await createTableWithTestCase(apiContext);
        pipeline = await createUnscheduledTestSuitePipeline(apiContext, table);
        await patchIngestionPipeline(
          apiContext,
          pipeline.id,
          '/deployed',
          true
        );
        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('hides Run now from a data consumer, who may not trigger pipelines', async ({
      dataConsumerPage: page,
    }) => {
      const pipelinePermissionResponse = page.waitForResponse(
        isPipelinePermissionResponse(pipeline.name)
      );

      await openDetailsPage(page, table);
      await pipelinePermissionResponse;

      await expect(page.getByTestId('entity-page-header')).toBeVisible();
      await expect(page.getByTestId(RUN_TEST_CASE_BUTTON_TEST_ID)).toBeHidden();
    });

    test('shows Run now to a data consumer who owns the pipeline, since owners may trigger it', async ({
      browser,
      ownerPage: page,
    }) => {
      await test.step('Make the data consumer the pipeline owner', async () => {
        await redirectToHomePage(page);
        const { apiContext: ownerContext, afterAction: disposeOwnerContext } =
          await getApiContext(page);
        const ownerResponse = await ownerContext.get(
          '/api/v1/users/loggedInUser'
        );
        expect(ownerResponse.status()).toBe(200);
        const owner = await ownerResponse.json();
        await disposeOwnerContext();

        const { apiContext, afterAction } = await performAdminLogin(browser);
        await patchIngestionPipeline(apiContext, pipeline.id, '/owners', [
          { id: owner.id, type: 'user' },
        ]);
        await afterAction();
      });

      await openDetailsPage(page, table);

      await expect(
        page.getByTestId(RUN_TEST_CASE_BUTTON_TEST_ID)
      ).toBeVisible();
    });
  });

  // Triggering a run needs Airflow, which only the @ingestion shards have.
  test.describe('Running a test case', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
    let table: TableClass;

    test.beforeAll(
      'Create a test case and deploy its pipeline',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        table = await createTableWithTestCase(apiContext);
        const pipeline = await createUnscheduledTestSuitePipeline(
          apiContext,
          table
        );
        const deployResponse = await apiContext.post(
          `/api/v1/services/ingestionPipelines/deploy/${pipeline.id}`
        );
        expect(deployResponse.status()).toBe(200);
        await afterAction();
      }
    );

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.delete(apiContext);
      await afterAction();
    });

    test('queues a run of the test case from Run now', async ({ page }) => {
      test.slow();

      await openDetailsPage(page, table);

      const runButton = page.getByTestId(RUN_TEST_CASE_BUTTON_TEST_ID);

      await expect(runButton).toBeEnabled();
      await expect(runButton).toHaveText('Run now');

      await test.step('Trigger the run', async () => {
        // Airflow can reject the first trigger of a DAG it has not finished
        // registering; the button stays enabled then, as it would for a user
        // who simply clicks again.
        await expect(async () => {
          const runResponse = page.waitForResponse(isRunTestCaseResponse);
          await runButton.click();

          expect((await runResponse).status()).toBe(200);
        }).toPass({ intervals: [2_000, 5_000], timeout: 60_000 });
      });

      await test.step('The button reports the run and blocks another', async () => {
        await expect(runButton).toHaveText(/Queued|Running/);
        await expect(runButton).toBeDisabled();
      });
    });
  });
});
