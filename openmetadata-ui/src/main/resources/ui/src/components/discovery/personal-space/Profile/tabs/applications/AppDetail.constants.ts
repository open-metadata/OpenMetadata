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

export const TAB_SCHEDULE = 'schedule';
export const TAB_CONFIGURATION = 'configuration';
export const TAB_RUNS = 'recent-runs';
export const TAB_LIVE_INDEXING = 'live-indexing';

export const SUB_PAGE_RUN_CONFIG = 'run-config';
export const SUB_PAGE_EDIT_SCHEDULE = 'edit-schedule';

/** Label for each app detail tab shown in the modal header. */
export const TAB_LABEL_KEYS: Record<string, string> = {
  [TAB_SCHEDULE]: 'label.schedule',
  [TAB_CONFIGURATION]: 'label.configuration',
  [TAB_RUNS]: 'label.recent-run-plural',
  [TAB_LIVE_INDEXING]: 'label.live-indexing',
};
