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
import { EntityType } from '../../../enums/entity.enum';
import type { FeedCounts } from '../../../interface/feed.interface';
import { getEntityActivityByFqn, getFeedCount } from '../../../rest/feedsAPI';
import { getTaskCounts } from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { createMetricFeedCounts } from './MetricActivity.utils';

export const getMetricFeedCounts = async (
  metricFqn: string
): Promise<FeedCounts> => {
  const [activityResponse, threadCounts, taskCounts] = await Promise.all([
    getEntityActivityByFqn(EntityType.METRIC, metricFqn, {
      days: 30,
      limit: 0,
    }),
    getFeedCount(getEntityFeedLink(EntityType.METRIC, metricFqn)),
    getTaskCounts({ aboutEntity: metricFqn }),
  ]);

  return createMetricFeedCounts({
    activityEventCount: activityResponse.paging?.total ?? 0,
    closedTaskCount: taskCounts.completed ?? 0,
    conversationThreadCount: threadCounts.reduce(
      (total, count) => total + (count.conversationCount ?? 0),
      0
    ),
    mentionCount: threadCounts.reduce(
      (total, count) => total + count.mentionCount,
      0
    ),
    openTaskCount: taskCounts.open ?? 0,
    totalTaskCount: taskCounts.total ?? 0,
  });
};
