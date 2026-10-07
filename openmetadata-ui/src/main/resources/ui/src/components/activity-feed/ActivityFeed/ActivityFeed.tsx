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
import { Box, Tabs } from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getActivityScope,
  getTaskListScope,
} from '../../discovery/personal-space/InboxPage/activityScope';
import {
  ActivityFilter,
  DEFAULT_INBOX_DATE_PRESET,
  getDefaultInboxDateRange,
  getInboxDateRange,
  getInboxTabBadge,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
} from '../../discovery/personal-space/InboxPage/inbox.utils';
import ActivityTab from '../../discovery/personal-space/InboxPage/tabs/ActivityTab';
import { useInboxActivityCounts } from '../../discovery/personal-space/InboxPage/useInboxActivity';
import { useTaskStatusCounts } from '../../discovery/personal-space/InboxPage/useTaskQueue';
import ActivityFeedTasks from './ActivityFeedTasks';

export type ActivityFeedView = 'activity' | 'tasks';

export interface ActivityFeedProps {
  /**
   * Whose feed: `<#E::table::fqn>` shows what happened to the table and the
   * tasks about it; `<#E::user::name>` shows what the user did and the tasks
   * assigned to them.
   */
  entityLink: string;
  defaultView?: ActivityFeedView;
  // After a task action changed the task, and possibly its entity.
  onTaskChange?: () => void;
}

/**
 * The Inbox's Activity and Tasks for one entity or user:
 * `<ActivityFeed entityLink="<#E::table::red.dev.dbt_jaffle.customers>" />`.
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entityLink,
  defaultView = 'activity',
  onTaskChange,
}) => {
  const { t } = useTranslation();
  const [view, setView] = useState<ActivityFeedView>(defaultView);
  // Read when the feed mounts, so a page left open keeps a current window.
  const [dateRange, setDateRange] = useState<InboxDateRange>(() => ({
    ...getDefaultInboxDateRange(),
    key: DEFAULT_INBOX_DATE_PRESET,
  }));
  const activityScope = useMemo(
    () => getActivityScope(entityLink),
    [entityLink]
  );
  const taskScope = useMemo(() => getTaskListScope(entityLink), [entityLink]);

  // Both counts read the queries their lists use, so neither is fetched twice.
  const activityCount = useInboxActivityCounts(dateRange, activityScope)[
    ActivityFilter.All
  ];
  const taskCounts = useTaskStatusCounts(taskScope);

  const handleDatePresetChange = useCallback((key: string) => {
    setDateRange({
      ...getInboxDateRange(INBOX_DATE_RANGE_OPTIONS[key].days),
      key,
    });
  }, []);

  const viewSwitch = (
    <Tabs
      className="tw:w-fit"
      selectedKey={view}
      onSelectionChange={(key) => setView(key as ActivityFeedView)}>
      <Tabs.List size="sm" type="button-border">
        <Tabs.Item badge={getInboxTabBadge(activityCount)} id="activity">
          {t('label.activity')}
        </Tabs.Item>
        <Tabs.Item badge={taskCounts.open || undefined} id="tasks">
          {t('label.task-plural')}
        </Tabs.Item>
      </Tabs.List>
    </Tabs>
  );

  return (
    <Box
      className="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:px-3"
      data-testid="activity-feed"
      direction="col">
      {view === 'activity' ? (
        <ActivityTab
          dateRange={dateRange}
          isFiltered={dateRange.key !== DEFAULT_INBOX_DATE_PRESET}
          leading={viewSwitch}
          scope={activityScope}
          onDatePresetChange={handleDatePresetChange}
        />
      ) : (
        <ActivityFeedTasks
          leading={viewSwitch}
          scope={taskScope}
          onTaskChange={onTaskChange}
        />
      )}
    </Box>
  );
};

export default ActivityFeed;
