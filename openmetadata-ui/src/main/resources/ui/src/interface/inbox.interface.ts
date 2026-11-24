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

// The persisted Inbox window is held in the personal-space store, so the shape
// has to be reachable without importing the Inbox page.
export interface InboxDateRange {
  startTs?: number;
  endTs?: number;
  // Preset key of the selected range (e.g. 'last30days', 'customRange'). Kept so
  // the persisted range can be compared to the default by key rather than by
  // timestamps, which drift between mounts (now-based vs day-aligned millis).
  key?: string;
  // Label the picker shows for this range (e.g. "Custom Range"). Persisted so the
  // dropdown button re-seeds to the selected range after a tab-switch remount
  // instead of falling back to the default preset title.
  title?: string;
}
