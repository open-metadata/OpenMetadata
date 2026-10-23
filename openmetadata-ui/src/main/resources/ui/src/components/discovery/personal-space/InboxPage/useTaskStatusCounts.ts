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

import { useQueries } from '@tanstack/react-query';
import { TASK_STATUS_COUNTS_QUERY_KEY } from '../inbox.constants';
import {
  getStatusCounts,
  getTaskScopeKey,
  listScopedTasks,
  STATUS_COUNT_GROUPS,
  TaskListScope,
  TaskStatusFilter,
} from './taskScope.utils';

const TASK_COUNTS_STALE_TIME = 30_000;

/**
 * Per-status totals for the All / Open / Closed choice, fetched cheaply
 * (limit=1, server paging.total) and cached by React Query keyed on the scope.
 * A work queue has no date window: an open task never ages out. The keyed cache
 * dedupes the fetch across remounts and StrictMode's dev double-invoke, and
 * lets a host read the open count without mounting the queue; mutations
 * invalidate the key.
 */
export const useTaskStatusCounts = (
  scope: TaskListScope
): Record<TaskStatusFilter, number> => {
  const scopeKey = getTaskScopeKey(scope);
  const countQueries = useQueries({
    queries: STATUS_COUNT_GROUPS.map((statusGroup) => ({
      queryKey: [TASK_STATUS_COUNTS_QUERY_KEY, scopeKey, statusGroup ?? 'all'],
      queryFn: () =>
        listScopedTasks(scope, { statusGroup, limit: 1 }).then(
          (res) => res.paging?.total ?? 0
        ),
      staleTime: TASK_COUNTS_STALE_TIME,
    })),
  });

  return getStatusCounts(countQueries);
};
