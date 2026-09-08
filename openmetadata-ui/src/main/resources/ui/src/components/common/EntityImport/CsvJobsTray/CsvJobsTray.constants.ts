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

// Window event that entity pages dispatch after starting a CSV export/import so
// the (lazily mounted) jobs tray refreshes. Kept in its own module so importing
// it does not pull the heavy CsvJobsTray component into the caller's bundle.
export const CSV_JOBS_REFRESH_EVENT = 'csv-jobs-refresh';

// One extra refresh a short while after an action fires the event above, to
// catch a job that only registers slightly afterwards. The import path in
// particular dispatches before its job exists, so a socket-less client that
// misses it on the immediate fetch would otherwise never start polling for it.
export const CSV_JOBS_POST_ACTION_REFRESH_MS = 2000;

// Job IDs the current user started in this browser-tab session via an export or
// import action. The tray must always surface these — even a fast job that
// finishes before the tray's first jobs fetch — so the stale-job guard (which
// hides jobs already terminal on first load, e.g. leftovers shown after a page
// refresh) never suppresses a job the user just triggered. Kept module-level so
// dispatch sites can record ownership without threading state into the lazily
// mounted tray.
const ownedCsvJobIds = new Set<string>();

export const markCsvJobOwned = (jobId?: string): void => {
  if (jobId) {
    ownedCsvJobIds.add(jobId);
  }
};

export const isCsvJobOwned = (jobId: string): boolean =>
  ownedCsvJobIds.has(jobId);
