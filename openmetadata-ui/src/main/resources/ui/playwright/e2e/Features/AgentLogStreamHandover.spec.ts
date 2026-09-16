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

import { Page } from '@playwright/test';
import { randomUUID } from 'crypto';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { expect, test } from '../../support/fixtures/base';
import { createNewPage, uuid } from '../../utils/common';
import { getEncodedFqn } from '../../utils/entity';
import {
  assertLogViewerShowsLogs,
  buildLogStreamFrames,
  buildMarkerLogText,
  dragLogViewerUpWithoutGesture,
  focusLogViewerScroller,
  getLogViewerLineCount,
  getLogViewerScrollState,
  LogStreamFrame,
  LOG_STREAM_RESPONSE_HEADERS,
  LOG_VIEWER_MARKER,
  scrollLogViewerAwayFromTail,
  scrollLogViewerToTail,
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

/**
 * Enough lines to overflow the log body at any viewport the suite runs at, so
 * the scroll-driven follow behaviour has something to scroll. Kept well below
 * the virtualiser's overscan (100 rows each side of the viewport): past that,
 * a wrap toggle re-measures enough mounted rows in one go that the resulting
 * burst of offset corrections can itself look like a manual scrollbar drag —
 * the very thing `dragLogViewerUpWithoutGesture` deliberately provokes later
 * in this test.
 */
const SCROLLABLE_LOG_LINE_COUNT = 60;

/**
 * Wide enough that every line still wraps to more than one visual row in the
 * viewer — which is what makes the wrap toggle re-measure rows and move the
 * scroll position — without making each row's height correction so large that
 * settling the relayout takes an unrealistic number of frames.
 */
const WRAPPABLE_LOG_LINE_LENGTH = 120;

/**
 * What each reconnect appends after the first. Small on purpose: a run that adds
 * hundreds of lines every couple of seconds moves the tail further per push than a
 * user can travel, so returning to it by hand would be impossible to test.
 */
const TRICKLE_LOG_LINE_COUNT = 3;

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
  {
    terminal,
    lineCount,
    lineLength,
    followUpLineCount,
  }: {
    terminal: boolean;
    lineCount?: number;
    lineLength?: number;
    /**
     * Lines served on every connection after the first. Defaults to `lineCount`;
     * a small value models a real run — a history to read, then a trickle — and
     * keeps the tail reachable by hand.
     */
    followUpLineCount?: number;
  }
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
      const isFirstConnection = streamRequests.length === 0;
      streamRequests.push(route.request().url());

      const frames: LogStreamFrame[] = [
        {
          eventType: 'logs',
          runId: RUN_ID,
          logs: `${buildMarkerLogText(
            LOG_VIEWER_MARKER,
            isFirstConnection ? lineCount : followUpLineCount ?? lineCount,
            lineLength
          )}\n`,
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
    options: {
      terminal: boolean;
      lineCount?: number;
      lineLength?: number;
      followUpLineCount?: number;
    }
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

  test('Scrolling a live log pauses auto-follow and the toolbar toggle resumes it', async ({
    page,
  }) => {
    // Every step below waits for the stream to append again, and a reconnect can
    // take seconds on a loaded runner. The default budget is one such wait, not
    // the four this test needs, so it timed out on retry rather than failing.
    test.slow();

    await openAgentLogs(page, {
      terminal: false,
      lineCount: SCROLLABLE_LOG_LINE_COUNT,
      lineLength: WRAPPABLE_LOG_LINE_LENGTH,
      followUpLineCount: TRICKLE_LOG_LINE_COUNT,
    });

    const followToggle = page.getByTestId('log-viewer-follow');

    await test.step('A live run opens pinned to the tail', async () => {
      await assertLogViewerShowsLogs(page);
      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('Toggling wrap does not pause a followed log', async () => {
      // Re-wrapping re-measures every row and parks the virtualised list at the
      // top; the viewer must treat that as its own relayout, not as the user
      // taking over. Waiting for the next append is what proves it still follows.
      const beforeWrap = await getLogViewerScrollState(page);

      await page.getByTestId('log-viewer-wrap').click();

      await expect
        .poll(
          async () => (await getLogViewerScrollState(page))?.scrollHeight ?? 0,
          { timeout: 60_000 }
        )
        .toBeGreaterThan(beforeWrap?.scrollHeight ?? 0);

      // Following survived the relayout: the toggle still says so, and the line
      // count above proves lines kept arriving while it did. Not asserted through
      // scroll geometry — wrapping keeps the virtualised height estimate moving,
      // so "is it at the tail" is not a dependable ruler here.
      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');

      await page.getByTestId('log-viewer-wrap').click();
      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('A drag with no pointer event still takes the log back', async () => {
      // Stands in for a native scrollbar drag in a browser that does not dispatch
      // pointerdown for its scrollbar: no wheel, no key, no pointer — only the
      // scroll offsets pulling away from the tail, which the catch-up never does.
      await page.getByTestId('log-viewer-wrap').click();

      // Two steps at a time until control changes hands. A fixed number of steps
      // is not enough on a slow machine: consecutive scroll writes coalesce into
      // one report when frames are long, and it is the sequence that counts.
      await expect
        .poll(
          async () => {
            await dragLogViewerUpWithoutGesture(page, 2);

            return followToggle.getAttribute('aria-pressed');
          },
          {
            message: 'a drag with no pointer event must take the log back',
            timeout: 30_000,
          }
        )
        .toBe('false');

      await followToggle.click();
      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');

      // Leave wrapping off for the steps that follow: wrapped 400-character lines
      // make the content several times taller, so travelling back to the tail by
      // wheel stops being a realistic distance.
      await page.getByTestId('log-viewer-wrap').click();
      await expect(page.getByTestId('log-viewer-wrap')).toHaveAttribute(
        'aria-pressed',
        'false'
      );
    });

    await test.step('Scrolling up hands control back to the user', async () => {
      // Deliberately immediately after the wrap toggle above: a scroll performed
      // while the relayout is still settling is still the user's, and must not be
      // reversed on the grounds that a layout change just happened.
      await scrollLogViewerAwayFromTail(page);

      await expect(followToggle).toHaveAttribute('aria-pressed', 'false');
    });

    await test.step('Frames that keep arriving no longer yank the view to the tail', async () => {
      // The mock closes every connection, so the client reconnects and appends
      // more lines. Waiting for the content to actually grow is what makes this
      // a real assertion — a paused viewer must sit still through it.
      const pausedAtLines = await getLogViewerLineCount(page);

      await expect
        .poll(() => getLogViewerLineCount(page), {
          message: 'the stream should append more lines after a reconnect',
          timeout: 60_000,
        })
        .toBeGreaterThan(pausedAtLines);

      // Still the user's log: newly streamed lines must not take it back.
      await expect(followToggle).toHaveAttribute('aria-pressed', 'false');
    });

    await test.step('Scrolling back down to the tail resumes following on its own', async () => {
      // The toolbar toggle is not the only way back: reaching the tail by hand is
      // what a terminal does, and it has to work while the log keeps growing.
      await scrollLogViewerToTail(page);

      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');

      // And it stays followed as more lines arrive, rather than resuming for a
      // moment and dropping out again. Line count rather than scroll height: the
      // virtualised list re-estimates its height as rows are measured, so at a few
      // lines per push the height is not monotonic.
      const resumedAtLines = await getLogViewerLineCount(page);

      await expect
        .poll(() => getLogViewerLineCount(page), { timeout: 60_000 })
        .toBeGreaterThan(resumedAtLines);

      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('The keyboard can pause a followed log too', async () => {
      // The step above left the log following again, by hand — no need to resume.
      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');

      // Real focus and a real key press, not a synthetic event: the scrolling
      // element has to carry a tab stop for the keyboard to reach the log at all.
      expect(
        await focusLogViewerScroller(page),
        'the scrolling element must be focusable for the keyboard to reach it'
      ).toBe(true);

      await page.keyboard.press('PageUp');

      await expect(followToggle).toHaveAttribute('aria-pressed', 'false');
    });

    await test.step('The toggle resumes following and jumps back to the tail', async () => {
      await followToggle.click();

      await expect(followToggle).toHaveAttribute('aria-pressed', 'true');
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
