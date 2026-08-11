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

import { expect, Page, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import {
  assertLogViewerShowsLogs,
  buildLogStreamFrames,
  buildMarkerLogText,
  LOG_STREAM_RESPONSE_HEADERS,
} from '../../utils/logsViewer';
import { getAgentCard } from '../../utils/serviceIngestion';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

/**
 * Covers what happens AFTER a live log stream ends: the `complete` frame with
 * `reason: runFinished` must clear the live indicator and hand the log back to
 * the paginated endpoint exactly once, without resuming the 5s polling the
 * stream replaced.
 *
 * Everything here is mocked. Watching a real run reach its terminal state would
 * cost minutes of ingestion for behaviour that depends only on the frame the
 * server sends, and the live-tailing half is already proven against a real
 * stream in `e2e/Pages/IngestionLogStreamLive.spec.ts`.
 *
 * The stream route is served in two phases so the lifecycle is deterministic:
 * the first connection delivers log frames and closes without a terminal frame
 * (the client then reconnects from its cursor), and the second is held open
 * until the test releases it, at which point it delivers `runFinished`.
 */

const RUN_ID = randomUUID();
const STREAM_CURSOR = '20';

const pipelineName = `pw-log-handover-${uuid()}`;
let pipelineFqn = '';
let pipelineId = '';

interface StreamMocks {
  streamRequests: string[];
  paginatedLogCalls: () => number;
  finishRun: () => void;
}

const mockLogEndpoints = async (page: Page): Promise<StreamMocks> => {
  const streamRequests: string[] = [];
  let paginatedLogCalls = 0;
  let releaseFinalStream: () => void = () => undefined;
  const finalStreamGate = new Promise<void>((resolve) => {
    releaseFinalStream = resolve;
  });

  // The chromium lane has no Airflow container, so the real status endpoint
  // answers non-200 and the agents tab renders the error placeholder instead of
  // any cards. Stub it so `isAirflowAvailable` is true.
  await page.route('**/api/v1/services/ingestionPipelines/status', (route) =>
    route.fulfill({ json: { code: 200, platform: 'airflow' } })
  );

  // A live progress frame would overwrite the seeded runId and status.
  await page.route(
    '**/api/v1/services/ingestionPipelines/progress/service/**',
    (route) => route.fulfill({ status: 204, body: '' })
  );

  // Deliberately empty: anything the viewer renders can only have come from the
  // stream, and the call count is what proves polling did not resume.
  await page.route(
    '**/api/v1/services/ingestionPipelines/logs/*/last*',
    (route) => {
      paginatedLogCalls++;

      return route.fulfill({ json: {} });
    }
  );

  await page.route(
    '**/api/v1/services/ingestionPipelines/logs/*/stream/*',
    async (route) => {
      streamRequests.push(route.request().url());

      if (streamRequests.length === 1) {
        // Log frames only — no terminal frame, so the client stays in streaming
        // mode and reconnects from the cursor when this response ends.
        return route.fulfill({
          status: 200,
          headers: LOG_STREAM_RESPONSE_HEADERS,
          body: buildLogStreamFrames({
            eventType: 'logs',
            runId: RUN_ID,
            logs: `${buildMarkerLogText()}\n`,
            after: STREAM_CURSOR,
          }),
        });
      }

      await finalStreamGate;

      return route.fulfill({
        status: 200,
        headers: LOG_STREAM_RESPONSE_HEADERS,
        body: buildLogStreamFrames({
          eventType: 'complete',
          runId: RUN_ID,
          reason: 'runFinished',
          after: STREAM_CURSOR,
        }),
      });
    }
  );

  return {
    streamRequests,
    paginatedLogCalls: () => paginatedLogCalls,
    finishRun: () => releaseFinalStream(),
  };
};

test.describe('Agent log stream handover to the paginated endpoint', () => {
  const service = EntityDataClass.databaseService;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    const pipelineResponse = await apiContext.post(
      '/api/v1/services/ingestionPipelines',
      {
        data: {
          airflowConfig: { scheduleInterval: '0 0 * * *' },
          loggerLevel: 'INFO',
          name: pipelineName,
          pipelineType: 'metadata',
          service: {
            id: service.entityResponseData.id,
            type: 'databaseService',
          },
          sourceConfig: { config: { type: 'DatabaseMetadata' } },
        },
      }
    );

    expect(pipelineResponse.status()).toBe(201);

    const pipeline = await pipelineResponse.json();
    pipelineId = pipeline.id;
    pipelineFqn = pipeline.fullyQualifiedName;

    // A live status row is what makes the viewer open a stream at all: it needs
    // both a runId and a non-terminal state. Writing it directly needs no
    // Airflow.
    const now = Date.now();
    const statusResponse = await apiContext.put(
      `/api/v1/services/ingestionPipelines/${encodeURIComponent(
        pipelineFqn
      )}/pipelineStatus`,
      {
        data: {
          runId: RUN_ID,
          pipelineState: 'running',
          startDate: now,
          timestamp: now,
        },
      }
    );

    expect(statusResponse.ok()).toBeTruthy();

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    if (pipelineId) {
      await apiContext.delete(
        `/api/v1/services/ingestionPipelines/${pipelineId}?hardDelete=true`
      );
    }

    await afterAction();
  });

  test('A finished run clears the live state and refetches the log exactly once', async ({
    page,
  }) => {
    const mocks = await mockLogEndpoints(page);

    await page.goto(
      `/service/databaseServices/${getEncodedFqn(
        service.entityResponseData.fullyQualifiedName
      )}/agents/metadata`
    );
    await page.getByTestId('data-assets-header').waitFor();

    const agentCard = getAgentCard(page, pipelineName);

    await expect(agentCard).toBeVisible();
    await expect(agentCard.getByTestId('pipeline-status')).toContainText(
      'Running'
    );

    await agentCard.getByTestId('logs-button').click();

    await test.step('The stream is opened for the seeded run', async () => {
      await expect
        .poll(() => mocks.streamRequests.length, {
          message: 'the viewer should open an SSE stream for a live run',
        })
        .toBeGreaterThan(0);

      expect(mocks.streamRequests[0]).toContain(encodeURIComponent(RUN_ID));
    });

    await test.step('Streamed frames are rendered, and the paginated endpoint is untouched', async () => {
      await assertLogViewerShowsLogs(page);

      expect(
        mocks.paginatedLogCalls(),
        'the paginated log endpoint must not be called while streaming'
      ).toBe(0);
    });

    await test.step('A dropped stream resumes from the cursor', async () => {
      await expect
        .poll(() => mocks.streamRequests.length, {
          message: 'the client should reconnect after the server closes',
          timeout: 30_000,
        })
        .toBeGreaterThan(1);

      expect(mocks.streamRequests[1]).toContain(`after=${STREAM_CURSOR}`);
    });

    await test.step('A runFinished frame clears the live state', async () => {
      mocks.finishRun();

      await expect(page.getByTestId('log-viewer-live-indicator')).toBeHidden();
      await expect(
        page.getByTestId('log-viewer-reconnecting-indicator')
      ).toBeHidden();
    });

    await test.step('The finished run is refetched once, not polled', async () => {
      await expect
        .poll(() => mocks.paginatedLogCalls(), {
          message:
            'the terminal handover should refetch the finished log exactly once',
        })
        .toBe(1);

      // The stream replaced polling; a terminal frame must not bring it back.
      await expect
        .poll(() => mocks.paginatedLogCalls(), { timeout: 12_000 })
        .toBe(1);
    });
  });
});
