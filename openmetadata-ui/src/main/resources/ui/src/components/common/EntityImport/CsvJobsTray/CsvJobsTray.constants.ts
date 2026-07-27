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
