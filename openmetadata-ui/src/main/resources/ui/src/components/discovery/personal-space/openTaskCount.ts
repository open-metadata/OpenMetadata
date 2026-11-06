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
import { listMyVisibleTasks, TaskStatusGroup } from '../../../rest/tasksAPI';
import { INBOX_OPEN_TASK_COUNT_QUERY_KEY } from './inbox.constants';

const OPEN_TASK_COUNT_STALE_TIME = 30 * 1000;

/**
 * The viewer's open-task total, undated: the Triage tab badge and the sidebar
 * bubble read this one query, so they agree and it is fetched once. Invalidate
 * `INBOX_OPEN_TASK_COUNT_QUERY_KEY` after a task action.
 */
export const openTaskCountQuery = (userId?: string) => ({
  queryKey: [...INBOX_OPEN_TASK_COUNT_QUERY_KEY, userId],
  queryFn: () =>
    listMyVisibleTasks({ limit: 1, statusGroup: TaskStatusGroup.Open })
      .then((res) => res.paging?.total ?? 0)
      .catch(() => 0),
  enabled: Boolean(userId),
  staleTime: OPEN_TASK_COUNT_STALE_TIME,
});
