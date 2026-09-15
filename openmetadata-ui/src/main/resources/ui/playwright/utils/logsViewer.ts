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

import { APIRequestContext, expect, type Page } from '@playwright/test';
import {
  LOGS_VIEWER_PIPELINE_STATUS_MAX_WAIT_MS,
  LOGS_VIEWER_PIPELINE_STATUS_RETRY_INTERVAL_MS,
  LOGS_VIEWER_RUNNING_STATUS_INTERVAL_MS,
  LOGS_VIEWER_RUNNING_STATUS_MAX_WAIT_MS,
  TERMINAL_PIPELINE_STATES,
} from '../constant/logsViewer';
import { waitForAllLoadersToDisappear } from './entity';

/**
 * Distinctive marker injected into mocked log payloads. Tests assert the
 * LogViewerModal body renders this string, proving logs are shown at a call
 * site without depending on a real backend job.
 */
export const LOG_VIEWER_MARKER = 'PLAYWRIGHT_LOG_MARKER';

/**
 * Deterministic multi-line log text that embeds the marker on every line.
 *
 * `lineLength` pads each line out to that many characters. Lines wider than the
 * viewer are what make the wrap toggle re-measure rows, so a test that exercises
 * wrapping has to ask for them — the default short lines wrap to nothing.
 */
export const buildMarkerLogText = (
  marker = LOG_VIEWER_MARKER,
  lineCount = 20,
  lineLength = 0
): string =>
  Array.from({ length: lineCount }, (_, index) => {
    const line = `${marker} log line ${index + 1}`;

    return line.length >= lineLength ? line : line.padEnd(lineLength, ' .');
  }).join('\n');

/**
 * Mirrors `SCROLL_BOTTOM_THRESHOLD_PX` in LogViewerModal.component.tsx — the
 * slack the viewer allows before it considers the view parked off the tail.
 */
const LOG_VIEWER_TAIL_THRESHOLD_PX = 40;

interface LogViewerScrollState {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * Reads the scroll geometry of the virtualised log list.
 *
 * The scroller is created by the log viewer library, so it carries no testid —
 * it is found by being the one overflowing scrollable box inside the body.
 * Returns null while the body has nothing to scroll.
 */
export const getLogViewerScrollState = async (
  page: Page
): Promise<LogViewerScrollState | null> =>
  page.getByTestId('log-viewer-body').evaluate((body) => {
    const scroller = Array.from(body.querySelectorAll<HTMLElement>('*')).find(
      (element) => {
        const { overflowY } = window.getComputedStyle(element);

        return (
          element.scrollHeight > element.clientHeight + 1 &&
          (overflowY === 'auto' || overflowY === 'scroll')
        );
      }
    );

    return scroller
      ? {
          scrollTop: scroller.scrollTop,
          scrollHeight: scroller.scrollHeight,
          clientHeight: scroller.clientHeight,
        }
      : null;
  });

/**
 * Focuses the element that actually scrolls the log and reports whether it took
 * focus. The viewer gives that element a tab stop at runtime, so this is also the
 * assertion that the keyboard can reach the log at all.
 */
export const focusLogViewerScroller = async (page: Page): Promise<boolean> =>
  page.getByTestId('log-viewer-body').evaluate((body) => {
    const scroller = Array.from(body.querySelectorAll<HTMLElement>('*')).find(
      (element) => {
        const { overflowY } = window.getComputedStyle(element);

        return (
          element.scrollHeight > element.clientHeight + 1 &&
          (overflowY === 'auto' || overflowY === 'scroll')
        );
      }
    );

    scroller?.focus();

    return Boolean(scroller) && document.activeElement === scroller;
  });

/**
 * Drags the log away from the tail without any pointer, wheel or key event —
 * setting `scrollTop` directly is the closest stand-in for a native scrollbar
 * drag in a browser that does not dispatch `pointerdown` for its scrollbar.
 */
export const dragLogViewerUpWithoutGesture = async (
  page: Page,
  steps = 4,
  stepPx = 400
): Promise<void> => {
  // Each step yields two frames before the next one. Written back to back the
  // browser coalesces them into a single scroll event, which is one report — a
  // drag is a sequence of them, and the sequence is the whole point here.
  await page.getByTestId('log-viewer-body').evaluate(
    async (body, { totalSteps, delta }) => {
      const nextFrame = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );

      for (let step = 0; step < totalSteps; step++) {
        const scroller = Array.from(
          body.querySelectorAll<HTMLElement>('*')
        ).find((element) => {
          const { overflowY } = window.getComputedStyle(element);

          return (
            element.scrollHeight > element.clientHeight + 1 &&
            (overflowY === 'auto' || overflowY === 'scroll')
          );
        });

        if (!scroller) {
          return;
        }

        scroller.scrollTop = Math.max(0, scroller.scrollTop - delta);
        await nextFrame();
      }
    },
    { totalSteps: steps, delta: stepPx }
  );
};

/**
 * The state of the live auto-follow toggle, as the user sees it.
 */
export const isLogViewerFollowing = async (page: Page): Promise<boolean> =>
  (await page.getByTestId('log-viewer-follow').getAttribute('aria-pressed')) ===
  'true';

/**
 * Whether the log viewer is parked at the tail of the log.
 */
export const isLogViewerAtTail = async (page: Page): Promise<boolean> => {
  const state = await getLogViewerScrollState(page);

  if (!state) {
    return true;
  }

  const { scrollTop, scrollHeight, clientHeight } = state;

  return (
    Math.abs(clientHeight + scrollTop - scrollHeight) <
    LOG_VIEWER_TAIL_THRESHOLD_PX
  );
};

/**
 * Wheels back down until the viewer resumes following on its own.
 *
 * Judged by the toggle for the same reason as `scrollLogViewerAwayFromTail`: the
 * height estimate of a virtualised list is not a dependable ruler. The fixture
 * serving this has to trickle rather than append hundreds of lines per push, or the
 * tail moves further per push than any wheel can cover.
 */
export const scrollLogViewerToTail = async (
  page: Page,
  deltaY = 2000,
  maxWheels = 60
): Promise<void> => {
  await page.getByTestId('log-viewer-body').hover();

  for (let wheel = 0; wheel < maxWheels; wheel++) {
    if (await isLogViewerFollowing(page)) {
      return;
    }

    await page.mouse.wheel(0, deltaY);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- pacing synthetic input, not waiting for state: back-to-back wheel events coalesce in the browser, so without a gap the loop travels far less than its budget suggests
    await page.waitForTimeout(60);
  }

  throw new Error(
    `Following did not resume after ${maxWheels} wheel events towards the tail`
  );
};

/**
 * Scrolls up with real wheel events until the viewer hands control to the user.
 *
 * Deliberately asserted through the toggle rather than through scroll geometry: a
 * virtualised list estimates its own height, and with wrapping on that estimate
 * moves as rows are measured, so "is the view at the tail" is not a stable
 * predicate. Whether following is paused is the guarantee the user actually has.
 */
export const scrollLogViewerAwayFromTail = async (
  page: Page,
  deltaY = -2000,
  maxWheels = 15
): Promise<void> => {
  await expect
    .poll(() => getLogViewerScrollState(page), {
      message:
        'the log body needs scrollable content before it can be scrolled',
    })
    .not.toBeNull();

  await page.getByTestId('log-viewer-body').hover();

  for (let wheel = 0; wheel < maxWheels; wheel++) {
    await page.mouse.wheel(0, deltaY);

    if (!(await isLogViewerFollowing(page))) {
      return;
    }
  }

  throw new Error(
    `Following was still on after ${maxWheels} wheel events away from the tail`
  );
};

/**
 * Assert the LogViewerModal is open and its body shows the injected marker.
 */
export const assertLogViewerShowsLogs = async (
  page: Page,
  marker = LOG_VIEWER_MARKER
): Promise<void> => {
  await expect(page.getByTestId('log-viewer-title')).toBeVisible();
  await expect(page.getByTestId('log-viewer-body')).toContainText(marker);
};

/**
 * One frame on the ingestion log SSE stream, mirroring the generated
 * `LogStreamEvent` schema. Only the fields a test needs to set are listed.
 */
export interface LogStreamFrame {
  eventType: 'logs' | 'complete' | 'error';
  runId?: string;
  logs?: string;
  after?: string;
  reason?: 'runFinished' | 'idleTimeout' | 'maxDuration' | 'maxBytes';
  message?: string;
  truncated?: boolean;
}

/** Headers a fulfilled route must carry for the client to treat it as SSE. */
export const LOG_STREAM_RESPONSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
};

/**
 * Serialises frames into an SSE body. Each frame is one `data:` line — the
 * embedded newlines in `logs` are escaped by `JSON.stringify`, so a frame never
 * spans lines and the blank line after it terminates the event.
 */
export const buildLogStreamFrames = (...frames: LogStreamFrame[]): string =>
  frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('');

interface PipelineStatusRow {
  runId?: string;
  pipelineState?: string;
}

const readLatestPipelineStatus = async (
  apiContext: APIRequestContext,
  pipelineFqn: string
): Promise<PipelineStatusRow | undefined> => {
  const response = await apiContext.get(
    `/api/v1/services/ingestionPipelines/${encodeURIComponent(
      pipelineFqn
    )}/pipelineStatus?limit=1`
  );

  if (!response.ok()) {
    return undefined;
  }

  const body = await response.json();

  return body.data?.[0];
};

/**
 * Waits for a freshly triggered run to report `running` and returns its runId.
 *
 * The log viewer only opens an SSE stream when the pipeline's latest status row
 * carries both a runId and a live state, so a test that wants to watch live logs
 * has to wait for exactly this row before it navigates.
 *
 * A run that is already terminal fails immediately with its own message rather
 * than burning the remaining budget — that outcome means the source had too
 * little to ingest to leave a live window, which is a different problem from a
 * scheduler that never started.
 */
/**
 * The run was accepted but Airflow never moved it off `queued`.
 *
 * Distinct from every other failure this helper can raise, because it says
 * nothing about the code under test — the trigger succeeded and the scheduler
 * simply did not pick the DAG up. Callers treat it as an environment condition;
 * a pipeline that reaches a terminal state instead is a real failure and stays a
 * plain Error.
 */
export class SchedulerDidNotStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerDidNotStartError';
  }
}

export const waitForRunningPipelineStatus = async (
  apiContext: APIRequestContext,
  pipelineFqn: string,
  timeoutMs = LOGS_VIEWER_RUNNING_STATUS_MAX_WAIT_MS
): Promise<{ runId: string }> => {
  const deadline = Date.now() + timeoutMs;
  let lastSeenState = 'no status row';

  while (Date.now() < deadline) {
    const latest = await readLatestPipelineStatus(apiContext, pipelineFqn);
    const state = latest?.pipelineState;

    if (state) {
      lastSeenState = state;
    }

    if (state === 'running' && latest?.runId) {
      return { runId: latest.runId };
    }

    if (state && TERMINAL_PIPELINE_STATES.includes(state)) {
      throw new Error(
        `Pipeline ${pipelineFqn} already reached "${state}" before a live window could be observed. ` +
          `The source has too little to ingest for this test — widen the filter or pick a larger source.`
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, LOGS_VIEWER_RUNNING_STATUS_INTERVAL_MS)
    );
  }

  throw new SchedulerDidNotStartError(
    `Pipeline ${pipelineFqn} did not report a "running" status within ${timeoutMs}ms ` +
      `(last seen: ${lastSeenState}). The scheduler did not start the run in time.`
  );
};

/**
 * The line count the log viewer reports in its footer, as a number.
 */
export const getLogViewerLineCount = async (page: Page): Promise<number> => {
  const text =
    (await page.getByTestId('log-viewer-total-lines').textContent()) ?? '';
  const [count] = text.trim().split(' ');

  return Number(count);
};

export const navigateToBundleSuiteWithPagination = async (
  page: Page,
  bundleSuiteFqn: string,
  maxPages = 15
): Promise<void> => {
  const encodedBundleSuiteFqn = encodeURIComponent(bundleSuiteFqn);

  for (let currentPage = 0; currentPage < maxPages; currentPage++) {
    await waitForAllLoadersToDisappear(page);

    const bundleSuiteLink = page
      .getByTestId('test-suite-table')
      .locator(`a[href*="${encodedBundleSuiteFqn}"]`)
      .first();

    if (await bundleSuiteLink.isVisible()) {
      await bundleSuiteLink.click();
      await waitForAllLoadersToDisappear(page);

      return;
    }

    const nextBtn = page.locator('[data-testid="next"]');

    if (!(await nextBtn.isVisible()) || !(await nextBtn.isEnabled())) {
      break;
    }

    const listResponse = page.waitForResponse((r) =>
      r.url().includes('/api/v1/dataQuality/testSuites/search/list')
    );
    await nextBtn.click();
    await listResponse;
  }

  throw new Error(
    `Bundle suite ${bundleSuiteFqn} was not found after checking ${maxPages} page(s)`
  );
};

export async function waitForFirstPipelineStatusNotQueued(page: Page) {
  await expect(async () => {
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('pipeline').click();
    await waitForAllLoadersToDisappear(page);

    const row = page
      .getByRole('row')
      .filter({ has: page.getByTestId('logs-button') })
      .first();
    await expect(row).toBeVisible();
    const statusBadge = row.getByTestId('pipeline-status').last();
    const text = ((await statusBadge.textContent()) ?? '').trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/^queued$/i);
  }).toPass({
    timeout: LOGS_VIEWER_PIPELINE_STATUS_MAX_WAIT_MS,
    intervals: [LOGS_VIEWER_PIPELINE_STATUS_RETRY_INTERVAL_MS],
  });
}
