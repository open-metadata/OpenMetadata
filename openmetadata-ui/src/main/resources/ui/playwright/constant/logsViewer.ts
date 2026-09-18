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
 * Budget for one triggered run to report its first `running` status row.
 *
 * Deliberately shorter than the whole hook: a run still `queued` at this point
 * usually means the trigger raced the scheduler serializing a freshly deployed
 * DAG, and a re-trigger unsticks it faster than waiting longer ever did (60s ->
 * 120s still stalled, run 34023457610). Callers retry with
 * LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS.
 */
export const LOGS_VIEWER_RUNNING_STATUS_MAX_WAIT_MS = 45_000;

/** Triggers to spend waiting for a run to start before giving up. */
export const LOGS_VIEWER_RUNNING_STATUS_ATTEMPTS = 3;

/** Delay between two reads while waiting for that first `running` row. */
export const LOGS_VIEWER_RUNNING_STATUS_INTERVAL_MS = 2_000;

/** Pipeline states that mean the run is over and can no longer be tailed. */
export const TERMINAL_PIPELINE_STATES = [
  'success',
  'failed',
  'partialSuccess',
  'stopped',
];
