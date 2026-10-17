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

export const CRITICAL_ANNOUNCEMENTS_QUERY_KEY = [
  'landingPage',
  'announcements',
  'critical',
] as const;

export const CRITICAL_ANNOUNCEMENTS_TTL_MS = 60_000;

export const CRITICAL_ANNOUNCEMENTS_GC_TIME_MS =
  CRITICAL_ANNOUNCEMENTS_TTL_MS + 5 * 60 * 1000;

// A page size, not a cap: the banner pages until the cursor runs out, so no
// live critical is ever left behind. Live criticals are a handful, so this is
// one request in practice.
export const CRITICAL_ANNOUNCEMENTS_PAGE_SIZE = 25;
