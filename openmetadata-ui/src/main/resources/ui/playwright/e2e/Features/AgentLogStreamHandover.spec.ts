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
  LogStreamFrame,
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
 * Each test picks what the stream serves up front rather than changing it
 * mid-flight. An earlier version held the second connection open and released it
 * from the test to deliver `runFinished`; that made the assertion depend on when
 * a reconnect landed relative to the release, and it failed in CI with the run
 * still marked live. Serving the terminal frame in the same response as the log
 * frames removes the timing entirely.
 */

const RUN_ID = randomUUID();
const STREAM_CURSOR = '20';

const pipelineName = `pw-log-handover-${uuid()}`;
let pipelineFqn = '';
let pipelineId = '';

interface StreamMocks {
  streamRequests: string[];
  paginatedLogCalls: () => number;
}

/**
 * Routes every endpoint the agents tab and the log viewer touch.
 *
 * `terminal` decides what the stream serves. `false` keeps the run streaming
 * forever: every connection delivers log frames and closes, so the client
 * reconnects from its cursor. `true` delivers the log frames and the
 * `runFinished` frame in the SAME response, so the handover happens on the
 * first connection with no reconnect and no cross-request timing to get wrong.
 */
const mockLogEndpoints = async (
  page: Page,
  { terminal }: { terminal: boolean }
): Promise<StreamMocks> => {
  const streamRequests: string[] = [];
  let paginatedLogCalls = 0;

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
  // stream, and the call count is what proves whether polling ran.
  await page.route(
    '**/api/v1/services/ingestionPipelines/logs/*/last*',
    (route) => {
      paginatedLogCalls++;

      return route.fulfill({ json: {} });
    }
  );

  await page.route(
    '**/api/v1/services/ingestionPipelines/logs/*/stream/*',
    (route) => {
      streamRequests.push(route.request().url());

      const frames: LogStreamFrame[] = [
        {
          eventType: 'logs',
          runId: RUN_ID,
          logs: `${buildMarkerLogText()}\n`,
          after: STREAM_CURSOR,
        },
      ];

      if (terminal) {
        frames.push({
          eventType: 'complete',
          runId: RUN_ID,
          reason: 'runFinished',
          after: STREAM_CURSOR,
        });
      }

      return route.fulfill({
        status: 200,
        headers: LOG_STREAM_RESPONSE_HEADERS,
        body: buildLogStreamFrames(...frames),
      });
    }
  );

  return {
    streamRequests,
    paginatedLogCalls: () => paginatedLogCalls,
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

  const openAgentLogs = async (
    page: Page,
    options: { terminal: boolean }
  ): Promise<StreamMocks> => {
    const mocks = await mockLogEndpoints(page, options);

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

    await expect
      .poll(() => mocks.streamRequests.length, {
        message: 'the viewer should open an SSE stream for a live run',
      })
      .toBeGreaterThan(0);

    expect(mocks.streamRequests[0]).toContain(encodeURIComponent(RUN_ID));

    return mocks;
  };

  test('A run that keeps streaming is never polled, and reconnects from its cursor', async ({
    page,
  }) => {
    const mocks = await openAgentLogs(page, { terminal: false });

    await test.step('Streamed frames are rendered', async () => {
      await assertLogViewerShowsLogs(page);
    });

    await test.step('The viewer never calls the paginated endpoint', async () => {
      // No assertion on the live dot here. Playwright cannot hold a response
      // open, so this mock closes every connection immediately and the client
      // spends most of its time in reconnect backoff, where the reconnecting
      // dot legitimately replaces the live one. A genuinely open connection is
      // asserted against a real run in e2e/Pages/IngestionLogStreamLive.spec.ts.
      await expect(page.getByTestId('log-viewer-stream-error')).toBeHidden();

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

      expect(
        mocks.paginatedLogCalls(),
        'reconnecting is not a reason to fall back to polling'
      ).toBe(0);
    });
  });

  test('A finished run clears the live state and refetches the log exactly once', async ({
    page,
  }) => {
    // The runFinished frame rides in the same response as the log frames, so the
    // handover happens on the first connection. Nothing here depends on when a
    // reconnect lands.
    const mocks = await openAgentLogs(page, { terminal: true });

    await test.step('The run is no longer reported as live', async () => {
      await expect(page.getByTestId('log-viewer-live-indicator')).toBeHidden();
      await expect(
        page.getByTestId('log-viewer-reconnecting-indicator')
      ).toBeHidden();

      // A stream that gave up for any other reason would surface here instead,
      // and would leave the run marked live — distinguishing the two is the
      // whole point of this test.
      await expect(page.getByTestId('log-viewer-stream-error')).toBeHidden();
    });

    await test.step('The streamed content survives the handover', async () => {
      await assertLogViewerShowsLogs(page);
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
