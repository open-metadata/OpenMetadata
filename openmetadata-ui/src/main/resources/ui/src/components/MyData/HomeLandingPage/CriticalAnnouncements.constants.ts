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

// Admins write critical system announcements rarely; this bounds the fetch
// without any chance of hiding a live one.
export const CRITICAL_ANNOUNCEMENTS_FETCH_LIMIT = 25;

// The same 28px circle as the announcements rail's pager, so the two read as
// one control family; the glyph is sized down for the core chevrons' tight
// 20-unit viewBox.
export const CRITICAL_PAGER_BUTTON_CLASSES =
  'tw:size-7 tw:shrink-0 tw:rounded-full tw:p-0 tw:*:data-icon:size-2.5';
