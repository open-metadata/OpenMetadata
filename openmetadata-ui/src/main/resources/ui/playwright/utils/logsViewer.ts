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
 */
export const buildMarkerLogText = (marker = LOG_VIEWER_MARKER): string =>
  Array.from(
    { length: 20 },
    (_, index) => `${marker} log line ${index + 1}`
  ).join('\n');

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

  throw new Error(
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
