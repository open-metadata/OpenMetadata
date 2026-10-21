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
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { openTaskCountQuery } from '../openTaskCount';
import { ActivityFilter, InboxCount, InboxDateRange } from './inbox.utils';
import { useInboxActivity } from './useInboxActivity';

export interface InboxCounts {
  activityCount: InboxCount;
  taskCount: number;
  isLoading: boolean;
}

/**
 * Activity + task badge totals. The activity count reuses the shared
 * `useInboxActivity` query (deduped with the tab's list, so the badge equals the
 * list); tasks are the viewer's open total (`openTaskCountQuery`).
 */
export const useInboxCounts = (dateRange?: InboxDateRange): InboxCounts => {
  const { currentUser } = useApplicationStore();
  const {
    total,
    isCapped,
    isLoading: isActivityLoading,
  } = useInboxActivity(ActivityFilter.All, dateRange);

  const { data: taskCount = 0, isFetching: isTaskFetching } = useQuery(
    openTaskCountQuery(currentUser?.id)
  );

  return {
    activityCount: { total, isCapped },
    taskCount,
    isLoading: isActivityLoading || isTaskFetching,
  };
};
