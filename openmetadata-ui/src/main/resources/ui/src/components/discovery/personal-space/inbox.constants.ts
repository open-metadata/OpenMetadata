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
 * Root key for the sidebar inbox badge's open-task count. Shared so task
 * resolution paths can invalidate the badge alongside the open-tasks list,
 * keeping the two in sync after an approve/close.
 */
export const INBOX_OPEN_TASK_COUNT_QUERY_KEY = [
  'inbox-open-task-count',
] as const;

export { INBOX_UNREAD_ACTIVITY_COUNT_QUERY_KEY } from '../../../constants/Inbox.constants';

/**
 * Cache key for the Tasks tab's All/Open/Closed badge totals. Shared so any
 * task mutation — the tab's own, or the landing page's bulk resolve — can
 * invalidate them.
 */
export const TASK_STATUS_COUNTS_QUERY_KEY = 'inbox-task-status-counts';

/**
 * Cache key prefix for the Tasks tab's lists, one entry per scope, status and
 * search, so switching back to a list reads it from the cache.
 */
export const TASK_LIST_QUERY_KEY = 'inbox-task-list';

/**
 * Evaluated `feed` resource permission for the current user (Inbox comment
 * delete gating). Session-stable, so consumers cache it with
 * `staleTime: Infinity`.
 */
export const FEED_DELETE_ACCESS_QUERY_KEY = [
  'feed-resource-delete-access',
] as const;
