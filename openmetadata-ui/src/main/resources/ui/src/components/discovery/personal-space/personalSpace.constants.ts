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

/**
 * Route constants for the personal-space Inbox: a routed full page (Activity /
 * Tasks feed) with two deep-linkable sub-tabs. My Data is modal-only.
 */
export const PERSONAL_SPACE_ROUTES = {
  INBOX: '/inbox',
  INBOX_ACTIVITY: '/inbox/activity',
  INBOX_TASKS: '/inbox/tasks',
} as const;

/**
 * Query parameter that opens the inbox's Tasks tab on one task:
 * `/inbox/tasks?taskId=<id>`. Links from outside the inbox (the landing page's
 * My Tasks card) use it, since the inbox has no per-task route.
 */
export const INBOX_TASK_ID_PARAM = 'taskId';

/**
 * Query parameter that opens the inbox's Activity tab on one of its sub-tabs:
 * `/inbox/activity?filter=my-assets`. The landing page's Team Activity card
 * uses it, since that card shows the My Assets feed.
 * ADR:2026-10-28-inbox-activity-opens-on-the-filter-a-link-names
 */
export const INBOX_ACTIVITY_FILTER_PARAM = 'filter';

/**
 * The inbox's Activity tab on My Assets (`ActivityFilter.MyAssets`). Spelled
 * here rather than built from the enum so landing-page links don't pull the
 * inbox utilities into their chunk.
 */
export const INBOX_MY_ASSETS_ACTIVITY_PATH = `${PERSONAL_SPACE_ROUTES.INBOX_ACTIVITY}?${INBOX_ACTIVITY_FILTER_PARAM}=my-assets`;
