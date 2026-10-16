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
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageScrollPane } from '../../../hooks/usePageScrollPane';
import {
  DEFAULT_INBOX_DATE_PRESET,
  getDefaultInboxDateRange,
  getInboxDateRange,
  getInboxTabBadge,
  InboxDateRange,
  INBOX_DATE_RANGE_OPTIONS,
} from '../../discovery/personal-space/InboxPage/inbox.utils';
import ActivityTab from '../../discovery/personal-space/InboxPage/tabs/ActivityTab';
import { INBOX_ACTIVITY_QUERY_KEY } from '../../discovery/personal-space/InboxPage/useInboxActivity';
import type { TaskStatusFilter } from '../../discovery/personal-space/InboxPage/useTaskQueue';
import ActivityFeedTasks from './ActivityFeedTasks';
import { useActivityFeedCounts } from './useActivityFeedCounts';

export type ActivityFeedView = 'activity' | 'tasks';

// On an entity page, the page's tab bar: the Tabs' list, before the panel the
// feed renders in. It pins above the feed while the page scrolls.
const getEntityTabBar = (feed: HTMLElement) =>
  (feed.closest('[role="tabpanel"]')?.parentElement
    ?.firstElementChild as HTMLElement | null) ?? null;

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
  // The Tasks Status, which the Tasks badge counts; or control it with these.
  taskStatus?: TaskStatusFilter;
  onTaskStatusChange?: (status: TaskStatusFilter) => void;
  // The Activity window, which its badge counts; or control it with these.
  dateRange?: InboxDateRange;
  onDatePresetChange?: (preset: string) => void;
  // After a task action changed the task, and possibly its entity.
  onTaskChange?: () => void;
}

/**
 * The Inbox's Activity and Tasks for one entity or user:
 * `<ActivityFeed entityLink="<#E::table::red.dev.dbt_jaffle.customers>" />`.
 * Framed as a card, like the Inbox's content. It scrolls inside itself as part
 * of the page's scroll: the page scrolls until the entity page's tab bar pins
 * to its top, then the feed (see usePageScrollPane).
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entityLink,
  defaultView = 'activity',
  view: controlledView,
  onViewChange,
  taskStatus: controlledTaskStatus,
  onTaskStatusChange,
  dateRange: controlledDateRange,
  onDatePresetChange,
  onTaskChange,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);
  usePageScrollPane(rootRef, getEntityTabBar);
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
  const [ownTaskStatus, setOwnTaskStatus] = useState<TaskStatusFilter>('open');
  const taskStatus = controlledTaskStatus ?? ownTaskStatus;
  const handleTaskStatusChange = useCallback(
    (next: TaskStatusFilter) => {
      setOwnTaskStatus(next);
      onTaskStatusChange?.(next);
    },
    [onTaskStatusChange]
  );
  // Read when the feed mounts, so a page left open keeps a current window.
  const [ownDateRange, setOwnDateRange] = useState<InboxDateRange>(() => ({
    ...getDefaultInboxDateRange(),
    key: DEFAULT_INBOX_DATE_PRESET,
  }));
  const dateRange = controlledDateRange ?? ownDateRange;
  // Both counts read the queries their lists use, so neither is fetched twice.
  const { activityScope, taskScope, activityCount, taskCounts } =
    useActivityFeedCounts(entityLink, dateRange);

  const handleDatePresetChange = useCallback(
    (key: string) => {
      setOwnDateRange({
        ...getInboxDateRange(INBOX_DATE_RANGE_OPTIONS[key].days),
        key,
      });
      onDatePresetChange?.(key);
    },
    [onDatePresetChange]
  );

  // A task action can write activity (an approved description is a change),
  // so every cached Activity list, and the counts read from them, re-read.
  const handleTaskChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INBOX_ACTIVITY_QUERY_KEY] });
    onTaskChange?.();
  }, [queryClient, onTaskChange]);

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
      className="tw:flex tw:min-h-0 tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:px-3"
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
          onStatusChange={handleTaskStatusChange}
          onTaskChange={handleTaskChange}
        />
      )}
    </Box>
  );
};

export default ActivityFeed;
