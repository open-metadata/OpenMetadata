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
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFillAvailableHeight } from '../../../hooks/useFillAvailableHeight';
import {
  DEFAULT_INBOX_DATE_PRESET,
  getDefaultInboxDateRange,
  getInboxDateRange,
  getInboxTabBadge,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
} from '../../discovery/personal-space/InboxPage/inbox.utils';
import ActivityTab from '../../discovery/personal-space/InboxPage/tabs/ActivityTab';
import type { TaskStatusFilter } from '../../discovery/personal-space/InboxPage/useTaskQueue';
import ActivityFeedTasks from './ActivityFeedTasks';
import { useActivityFeedCounts } from './useActivityFeedCounts';

export type ActivityFeedView = 'activity' | 'tasks';

export interface ActivityFeedProps {
  /**
   * Whose feed: `<#E::table::fqn>` shows what happened to the table and the
   * tasks about it; `<#E::user::name>` shows what the user did and the tasks
   * assigned to them.
   */
  entityLink: string;
  // The view to open on; or control it with `view` and `onViewChange`.
  defaultView?: ActivityFeedView;
  view?: ActivityFeedView;
  onViewChange?: (view: ActivityFeedView) => void;
  // After a task action changed the task, and possibly its entity.
  onTaskChange?: () => void;
}

/**
 * The Inbox's Activity and Tasks for one entity or user:
 * `<ActivityFeed entityLink="<#E::table::red.dev.dbt_jaffle.customers>" />`.
 * It fills what is left of the page below it and scrolls inside itself.
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entityLink,
  defaultView = 'activity',
  view: controlledView,
  onViewChange,
  onTaskChange,
}) => {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  useFillAvailableHeight(rootRef);
  const [ownView, setOwnView] = useState<ActivityFeedView>(defaultView);
  const view = controlledView ?? ownView;
  const handleViewChange = useCallback(
    (next: ActivityFeedView) => {
      setOwnView(next);
      onViewChange?.(next);
    },
    [onViewChange]
  );
  // The Tasks badge counts the Status chosen in the Tasks view, which keeps it
  // when the view switches away and back.
  const [taskStatus, setTaskStatus] = useState<TaskStatusFilter>('open');
  // Read when the feed mounts, so a page left open keeps a current window.
  const [dateRange, setDateRange] = useState<InboxDateRange>(() => ({
    ...getDefaultInboxDateRange(),
    key: DEFAULT_INBOX_DATE_PRESET,
  }));
  // Both counts read the queries their lists use, so neither is fetched twice.
  const { activityScope, taskScope, activityCount, taskCounts } =
    useActivityFeedCounts(entityLink, dateRange);

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
      onSelectionChange={(key) => handleViewChange(key as ActivityFeedView)}>
      <Tabs.List size="sm" type="button-border">
        <Tabs.Item badge={getInboxTabBadge(activityCount)} id="activity">
          {t('label.activity')}
        </Tabs.Item>
        <Tabs.Item badge={taskCounts[taskStatus] || undefined} id="tasks">
          {t('label.task-plural')}
        </Tabs.Item>
      </Tabs.List>
    </Tabs>
  );

  return (
    <Box
      // Its panes scroll inside it; nothing spills out to grow the page.
      className="tw:flex tw:min-h-0 tw:flex-col tw:overflow-hidden tw:px-3"
      data-testid="activity-feed"
      direction="col"
      ref={rootRef}>
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
          status={taskStatus}
          onStatusChange={setTaskStatus}
          onTaskChange={onTaskChange}
        />
      )}
    </Box>
  );
};

export default ActivityFeed;
