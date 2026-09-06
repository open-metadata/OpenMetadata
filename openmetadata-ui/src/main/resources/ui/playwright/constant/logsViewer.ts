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

/** Delay between retries for `expect().toPass()` while waiting on pipeline status. */
export const LOGS_VIEWER_PIPELINE_STATUS_RETRY_INTERVAL_MS = 30_000;

export const LOGS_VIEWER_PIPELINE_STATUS_MAX_WAIT_MS = 5 * 60_000;

/**
 * Budget for a freshly triggered run to report its first `running` status row.
 *
 * Bounded so a scheduler that never starts the DAG is reported rather than
 * waited on indefinitely — but the previous 60s was tighter than the budget it
 * sits inside. The `beforeAll` that calls this declares `setTimeout(180_000)`
 * and spends roughly 6s reaching the wait, so 60s left ~114s of the hook's
 * budget unused and gave up while the pipeline was still `queued`: the
 * scheduler was working, just slow under merge-queue load (run 33970886957).
 *
 * 120s keeps a real ceiling, still lands ~54s inside the hook's 180s, and only
 * spends headroom that already existed. A `queued` pipeline at this point means
 * the run was accepted; only a terminal state or this ceiling is a real failure.
 */
export const LOGS_VIEWER_RUNNING_STATUS_MAX_WAIT_MS = 120_000;

/** Delay between two reads while waiting for that first `running` row. */
export const LOGS_VIEWER_RUNNING_STATUS_INTERVAL_MS = 2_000;

/** Pipeline states that mean the run is over and can no longer be tailed. */
export const TERMINAL_PIPELINE_STATES = [
  'success',
  'failed',
  'partialSuccess',
  'stopped',
];
