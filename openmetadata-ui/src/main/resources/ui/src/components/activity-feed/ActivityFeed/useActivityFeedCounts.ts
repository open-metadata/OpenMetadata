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
import { useMemo } from 'react';
import {
  getActivityScope,
  getTaskListScope,
} from '../../discovery/personal-space/InboxPage/activityScope';
import {
  ActivityFilter,
  InboxDateRange,
} from '../../discovery/personal-space/InboxPage/inbox.utils';
import { useInboxActivityCounts } from '../../discovery/personal-space/InboxPage/useInboxActivity';
import { useTaskStatusCounts } from '../../discovery/personal-space/InboxPage/useTaskQueue';

/**
 * What an `<ActivityFeed>` counts: its Activity cards (paired changes as one,
 * conversations included) and its tasks. Both read the queries the feed's
 * lists use, so a host showing the counts (the entity page's tab) and the feed
 * share one fetch and always agree.
 */
export const useActivityFeedCounts = (
  entityLink: string,
  dateRange: InboxDateRange
) => {
  const activityScope = useMemo(
    () => getActivityScope(entityLink),
    [entityLink]
  );
  const taskScope = useMemo(() => getTaskListScope(entityLink), [entityLink]);

  return {
    activityScope,
    taskScope,
    activityCount: useInboxActivityCounts(dateRange, activityScope)[
      ActivityFilter.All
    ],
    taskCounts: useTaskStatusCounts(taskScope),
  };
};
