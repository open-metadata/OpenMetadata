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

export const INBOX_UNREAD_ACTIVITY_COUNT_QUERY_KEY = [
  'inbox-unread-activity-count',
] as const;

/**
 * Evaluated `feed` resource permission for the current user (Inbox comment
 * delete gating). Session-stable, so consumers cache it with
 * `staleTime: Infinity`.
 */
export const FEED_DELETE_ACCESS_QUERY_KEY = [
  'feed-resource-delete-access',
] as const;
