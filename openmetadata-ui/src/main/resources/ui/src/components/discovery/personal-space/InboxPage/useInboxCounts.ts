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

import { useQuery } from '@tanstack/react-query';
import { listMyVisibleTasks, TaskStatusGroup } from '../../../../rest/tasksAPI';
import { useInboxActivity } from './useInboxActivity';
import {
  InboxDateRange,
  InboxScope,
} from './inbox.utils';

export interface InboxCounts {
  activityCount: number;
  taskCount: number;
  isLoading: boolean;
}

export const INBOX_COUNTS_QUERY_KEY = 'inbox-counts';

const INBOX_COUNTS_STALE_TIME = 30 * 1000;

/**
 * Activity + task badge totals. The activity count reuses the shared
 * `useInboxActivity` query (deduped with the tab's list, so the badge equals the
 * list); tasks are the user's visible-open total, keyed on
 * `INBOX_COUNTS_QUERY_KEY` so a mutation elsewhere can invalidate it.
 */
export const useInboxCounts = (
  scope: InboxScope,
  dateRange?: InboxDateRange
): InboxCounts => {
  const startTs = dateRange?.startTs;
  const endTs = dateRange?.endTs;

  const { total: activityCount, isLoading: isActivityLoading } =
    useInboxActivity(scope, dateRange);

  const { data: taskCount = 0, isFetching: isTaskFetching } = useQuery({
    queryKey: [INBOX_COUNTS_QUERY_KEY, scope, startTs, endTs],
    // Only Open tasks, so the badge matches the sidebar red bubble.
    queryFn: () =>
      listMyVisibleTasks({
        limit: 1,
        startTs,
        endTs,
        statusGroup: TaskStatusGroup.Open,
      })
        .then((res) => res.paging?.total ?? 0)
        .catch(() => 0),
    staleTime: INBOX_COUNTS_STALE_TIME,
  });

  return {
    activityCount,
    taskCount,
    isLoading: isActivityLoading || isTaskFetching,
  };
};
