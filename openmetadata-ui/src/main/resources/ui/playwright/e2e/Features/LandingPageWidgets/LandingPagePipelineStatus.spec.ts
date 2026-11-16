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
import { Page, Response } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../../constant/config';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import {
  expect,
  test as landingPageTest,
} from '../../../support/fixtures/landingPageUser';
import { okJson } from '../../../utils/apiResponse';
import {
  getWorkerAdminAPIContext,
  redirectToHomePage,
  uuid,
} from '../../../utils/common';
import { waitForLandingPageWidget } from '../../../utils/customizeLandingPage';
import { getEncodedFqn } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

const PIPELINE_STATUS_KEY = 'KnowledgePanel.PipelineStatus';
const SUMMARY_PATH = '/api/v1/pipelines/summary';
const ALL = 'all';
/** The card's chips, in the order it draws them after "All". */
const STATUS_BUCKETS = ['Failed', 'Skipped', 'Pending', 'Successful'];
const FAILURE_MESSAGE = 'Task load_dim_user failed: permission denied';

type SummaryBody = {
  data: { pipelineId: string; pipelineName: string }[];
  paging?: { total?: number };
};

/**
 * A pipeline whose latest run failed, named to sort first: the summary
 * endpoint orders by name and the card lists one page per bucket, so a name
 * that sorts late could fall off the Failed page on a busy server.
 */
const test = landingPageTest.extend<{ failedPipeline: PipelineClass }>({
  // eslint-disable-next-line no-empty-pattern -- Seeded through the worker's admin API context, not a browser.
  failedPipeline: async ({}, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const pipeline = new PipelineClass({ name: `0-pw-landing-${uuid()}` });

    await pipeline.create(apiContext);
    await okJson(
      await apiContext.put(
        `/api/v1/pipelines/${getEncodedFqn(
          pipeline.entityResponseData.fullyQualifiedName ?? ''
        )}/status`,
        {
          data: {
            error: { errorMessage: FAILURE_MESSAGE },
            executionStatus: 'Failed',
            timestamp: Date.now(),
          },
        }
      ),
      'Failed pipeline run'
    );

    await use(pipeline);
    await pipeline.delete(apiContext);
  },
});

const statusOf = (response: Response) =>
  new URL(response.url()).searchParams.get('status') ?? ALL;

/** One summary answer per bucket; their totals are what the chips owe. */
const waitForSummaries = (page: Page) =>
  Promise.all(
    [ALL, ...STATUS_BUCKETS].map((bucket) =>
      waitForResponseWithStatus(
        page,
        (response) =>
          response.request().method() === 'GET' &&
          new URL(response.url()).pathname === SUMMARY_PATH &&
          statusOf(response) === bucket,
        200
      )
    )
  );

const openPipelineStatus = async (page: Page) => {
  const summaries = waitForSummaries(page);

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, PIPELINE_STATUS_KEY);
  const totals = Object.fromEntries(
    await Promise.all(
      (
        await summaries
      ).map(async (response) => {
        const body = await okJson<SummaryBody>(response, 'Pipeline summary');

        return [statusOf(response), body.paging?.total ?? body.data.length];
      })
    )
  );

  return { totals, widget };
};

test.describe(
  'Landing page pipeline status',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test('counts each status chip from the server', async ({
      page,
      failedPipeline,
    }) => {
      // Depended on so at least one failure exists to count.
      void failedPipeline;
      const { totals, widget } = await openPipelineStatus(page);

      expect(totals.Failed).toBeGreaterThan(0);

      for (const bucket of [ALL, ...STATUS_BUCKETS]) {
        await expect(
          widget.getByTestId(`pipeline-status-filter-${bucket}-count`)
        ).toHaveText(String(totals[bucket]));
      }

      await expect(
        widget.getByTestId('topic-status-pipelineStatus')
      ).toContainText(String(totals.Failed));
    });

    test('lists a failed pipeline with why its last run failed', async ({
      page,
      failedPipeline,
    }) => {
      const { widget } = await openPipelineStatus(page);

      await widget.getByTestId('pipeline-status-filter-Failed').click();

      const row = widget.getByTestId(
        `pipeline-status-row-${failedPipeline.entityResponseData.id}`
      );

      await expect(row).toBeVisible();
      await expect(row.getByTestId('pipeline-status-label')).toHaveText(
        'Failed'
      );
      await expect(row.getByTestId('pipeline-status-error')).toHaveText(
        FAILURE_MESSAGE
      );
      // The strip reads the run history, which holds the one failed run.
      await expect(
        row
          .getByTestId('pipeline-run-history')
          .locator('[data-status="failed"]')
      ).toHaveCount(1);
    });

    test('opens the pipelines view from the footer', async ({
      page,
      failedPipeline,
    }) => {
      // Depended on so the card is not empty: an empty card shows no footer.
      void failedPipeline;
      const { widget } = await openPipelineStatus(page);

      await widget.getByTestId('topic-action-pipelineStatus').click();

      // OSS opens Explore on the pipelines tab; Collate overrides the target
      // with its pipeline observability page.
      await expect
        .poll(() => new URL(page.url()).pathname)
        .toMatch(/\/(explore\/pipelines|observability\/pipeline)$/);
    });
  }
);
