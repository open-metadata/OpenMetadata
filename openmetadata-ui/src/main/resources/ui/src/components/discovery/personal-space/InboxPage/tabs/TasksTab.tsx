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

import {
  Badge,
  Box,
  EmptyPlaceholder,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Inbox01 } from '@untitledui/icons';
import classNames from 'classnames';
import { DateRangeObject } from 'Models';
import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../../components/common/Loader/Loader';
import {
  listMyVisibleTasks,
  listTasks,
  Task,
  TaskStatusGroup,
} from '../../../../../rest/tasksAPI';
import { INBOX_OPEN_TASK_COUNT_QUERY_KEY } from '../../inbox.constants';
import InboxFilterBar from '../components/InboxFilterBar';
import InboxTaskListItem from '../components/InboxTaskListItem';
import InboxTaskListSkeleton from '../components/InboxTaskListSkeleton';
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskDetailSkeleton from '../components/TaskDetailSkeleton';
import { InboxDateRange, isTaskOpen } from '../inbox.utils';
import { INBOX_COUNTS_QUERY_KEY } from '../useInboxCounts';
import { useInboxInfiniteList } from '../useInboxInfiniteList';

const TASK_LIMIT = 25;
// `resolution` so the panel's outcome rows render from the list row instead of
// flashing empty until its own fetch lands.
const TASK_FIELDS = 'assignees,createdBy,about,comments,payload,resolution';

// React Query cache key for the All/Open/Closed badge totals. Shared so a task
// mutation can invalidate them (see handleResolved / handleTaskUpdated).
export const TASK_STATUS_COUNTS_QUERY_KEY = 'inbox-task-status-counts';
const TASK_COUNTS_STALE_TIME = 30_000;

type TaskStatusFilter = 'all' | 'open' | 'closed';

// "all" loads every status (no statusGroup param); Open/Closed map to the API.
const STATUS_GROUP: Record<TaskStatusFilter, TaskStatusGroup | undefined> = {
  all: undefined,
  open: TaskStatusGroup.Open,
  closed: TaskStatusGroup.Closed,
};

export interface TasksTabProps {
  // Server-side time window applied to the loaded tasks.
  dateRange?: InboxDateRange;
  defaultDateRange: DateRangeObject;
  onDateRangeChange: (value: DateRangeObject) => void;
  // When set, lists all tasks about this entity FQN (entity-page usage). Without
  // it the tab shows the current user's *visible* tasks (assigned to me/my teams
  // or about entities I own) — never every task in the system.
  aboutEntity?: string;
  className?: string;
  onCountChange?: (count: number) => void;
}

const TasksTab: React.FC<TasksTabProps> = ({
  dateRange,
  defaultDateRange,
  onDateRangeChange,
  aboutEntity,
  className,
  onCountChange,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  // Land on Open by default: it's the actionable set, and its total feeds the
  // Tasks tab count so the badge matches the sidebar's open-task red bubble.
  const [status, setStatus] = useState<TaskStatusFilter>('open');

  // Per-status totals for the All / Open / Closed badges, fetched cheaply
  // (limit=1, server paging.total) and cached by React Query keyed on the active
  // scope + date window. The keyed cache dedupes the fetch across tab-switch
  // remounts and StrictMode's dev double-invoke; mutations invalidate the key.
  const scope = aboutEntity ?? 'me';
  const countQueries = useQueries({
    queries: [undefined, TaskStatusGroup.Open, TaskStatusGroup.Closed].map(
      (statusGroup) => ({
        queryKey: [
          TASK_STATUS_COUNTS_QUERY_KEY,
          scope,
          dateRange?.startTs,
          dateRange?.endTs,
          statusGroup ?? 'all',
        ],
        queryFn: () =>
          (aboutEntity ? listTasks : listMyVisibleTasks)({
            statusGroup,
            limit: 1,
            startTs: dateRange?.startTs,
            endTs: dateRange?.endTs,
            ...(aboutEntity ? { aboutEntity } : {}),
          }).then((res) => res.paging?.total ?? 0),
        staleTime: TASK_COUNTS_STALE_TIME,
      })
    ),
  });
  const statusCounts: Record<TaskStatusFilter, number> = {
    all: countQueries[0].data ?? 0,
    open: countQueries[1].data ?? 0,
    closed: countQueries[2].data ?? 0,
  };

  const fetchPage = useCallback(
    (after?: string) => {
      const params = {
        statusGroup: STATUS_GROUP[status],
        fields: TASK_FIELDS,
        limit: TASK_LIMIT,
        after,
        startTs: dateRange?.startTs,
        endTs: dateRange?.endTs,
      };

      // aboutEntity = entity-page mode (all tasks about that entity); otherwise
      // the personal inbox is scoped to the current user's visible tasks.
      return aboutEntity
        ? listTasks({ ...params, aboutEntity })
        : listMyVisibleTasks(params);
    },
    [status, aboutEntity, dateRange?.startTs, dateRange?.endTs]
  );

  const {
    items: tasks,
    isLoading,
    isLoadingMore,
    total,
    scrollRef,
    sentinelRef,
    reload,
    setItems,
    setTotal,
  } = useInboxInfiniteList<Task>(fetchPage);

  // The server now filters by the date window and returns an accurate total.
  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  // Invalidate the cached badge totals so a task action re-fetches them.
  const refreshStatusCounts = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [TASK_STATUS_COUNTS_QUERY_KEY],
    });
  }, [queryClient]);

  // Keep a valid selection: default to the first task and recover if the
  // selected one drops out of the list (e.g. after resolution or filtering).
  useEffect(() => {
    setSelectedTaskId((prev) =>
      prev && tasks.some((task) => task.id === prev) ? prev : tasks[0]?.id
    );
  }, [tasks]);

  // The Activity/Tasks tab badges and the sidebar inbox bubble are separate
  // react-query fetches under their own keys, so a mutation here would otherwise
  // sit behind their stale windows — and the sidebar never unmounts, so it would
  // not refetch at all until a navigation or a tab refocus.
  const syncInboxCountBadge = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [INBOX_COUNTS_QUERY_KEY] });
    queryClient.invalidateQueries({
      queryKey: INBOX_OPEN_TASK_COUNT_QUERY_KEY,
    });
  }, [queryClient]);

  const handleResolved = useCallback(
    (resolved: Task) => {
      // A resolved task only leaves the list if it no longer matches the active
      // filter. A Data Access Request that was just Approved stays Open (it is
      // awaiting grant), so removing it optimistically would make it vanish and
      // then reappear on refresh — update it in place instead.
      let stillVisible: boolean;
      if (status === 'all') {
        stillVisible = true;
      } else if (status === 'open') {
        stillVisible = isTaskOpen(resolved);
      } else {
        stillVisible = !isTaskOpen(resolved);
      }

      if (stillVisible) {
        setItems((prev) =>
          prev.map((task) => (task.id === resolved.id ? resolved : task))
        );
      } else {
        setItems((prev) => prev.filter((task) => task.id !== resolved.id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
      // The transition may shift the task across buckets, so re-sync the counts.
      refreshStatusCounts();
      syncInboxCountBadge();
    },
    [status, setItems, setTotal, refreshStatusCounts, syncInboxCountBadge]
  );

  // Assignee changes can move the task out of the current user's visible set
  // (server-side rule), so refetch instead of patching the list client-side —
  // otherwise the rows and the count badges drift apart.
  const handleTaskUpdated = useCallback(() => {
    reload();
    refreshStatusCounts();
    syncInboxCountBadge();
  }, [reload, refreshStatusCounts, syncInboxCountBadge]);

  // A comment change doesn't affect the task's bucket or visibility, so patch the
  // row in place instead of refetching the list.
  const handleCommentsChanged = useCallback(
    (updated: Task) => {
      setItems((prev) =>
        prev.map((task) => (task.id === updated.id ? updated : task))
      );
    },
    [setItems]
  );

  // Render the count as a pill next to the tab label; the selected tab's badge
  // gets a white bg + blue border/text (mirrors the AI Analytics scope tabs),
  // while unselected tabs keep the default gray pill.
  const renderCountBadge = (id: TaskStatusFilter, count: number) =>
    count ? (
      <Badge
        className={
          status === id
            ? 'tw:border tw:border-blue-200 tw:bg-white tw:text-blue-700'
            : ''
        }
        color="gray"
        size="sm"
        type="pill-color">
        {count}
      </Badge>
    ) : null;

  const statusFilter = (
    <Tabs
      className="tw:w-fit"
      selectedKey={status}
      onSelectionChange={(key) => setStatus(key as TaskStatusFilter)}>
      <Tabs.List size="sm" type="button-brand">
        <Tabs.Item id="all">
          {t('label.all')}
          {renderCountBadge('all', statusCounts.all)}
        </Tabs.Item>
        <Tabs.Item id="open">
          {t('label.open')}
          {renderCountBadge('open', statusCounts.open)}
        </Tabs.Item>
        <Tabs.Item id="closed">
          {t('label.closed')}
          {renderCountBadge('closed', statusCounts.closed)}
        </Tabs.Item>
      </Tabs.List>
    </Tabs>
  );

  // A dedicated empty state per status: All = generic "nothing to do", Open =
  // "no open tasks", Closed = archival. All render the same blank placeholder.
  const emptyStateByStatus: Record<TaskStatusFilter, ReactNode> = {
    all: (
      <EmptyPlaceholder
        data-testid="inbox-tasks-empty"
        description={t('message.tasks-empty-description')}
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-tasks-right-now')}
        variant="blank"
      />
    ),
    open: (
      <EmptyPlaceholder
        data-testid="inbox-tasks-open-empty"
        description={t('message.tasks-open-empty-description')}
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-open-tasks-yet')}
        variant="blank"
      />
    ),
    closed: (
      <EmptyPlaceholder
        data-testid="inbox-tasks-closed-empty"
        description={t('message.tasks-closed-empty-description')}
        icon={<Inbox01 className="tw:size-7 tw:text-utility-gray-blue-600" />}
        title={t('label.no-closed-tasks-yet')}
        variant="blank"
      />
    ),
  };
  const emptyState = emptyStateByStatus[status];

  let taskDetailContent: ReactNode;
  if (isLoading) {
    taskDetailContent = <TaskDetailSkeleton />;
  } else if (selectedTaskId) {
    taskDetailContent = (
      <TaskDetailPanel
        fallbackTask={tasks.find((task) => task.id === selectedTaskId)}
        key={selectedTaskId}
        taskId={selectedTaskId}
        onCommentsChanged={handleCommentsChanged}
        onResolved={handleResolved}
        onTaskUpdated={handleTaskUpdated}
      />
    );
  } else {
    taskDetailContent = (
      <Box align="center" className="tw:w-full tw:justify-center tw:py-16">
        <Typography className="tw:text-secondary">
          {t('label.no-tasks-right-now')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className={classNames(
        'tw:mt-4 tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary',
        className
      )}
      data-testid="inbox-tasks-tab"
      direction="col">
      <InboxFilterBar
        bordered
        dateRange={dateRange}
        defaultDateRange={defaultDateRange}
        left={statusFilter}
        onDateRangeChange={onDateRangeChange}
      />

      {!isLoading && tasks.length === 0 ? (
        <Box className="tw:relative tw:min-h-0 tw:flex-1">{emptyState}</Box>
      ) : (
        <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[2fr_3fr]">
          <div
            className="tw:h-full tw:overflow-y-auto tw:border-r tw:border-utility-gray-blue-100"
            data-testid="inbox-tasks-scroll"
            ref={scrollRef}>
            {isLoading ? (
              <InboxTaskListSkeleton />
            ) : (
              <div className="tw:flex tw:flex-col tw:gap-3 tw:p-3">
                {tasks.map((task) => (
                  <InboxTaskListItem
                    isActive={selectedTaskId === task.id}
                    key={task.id}
                    task={task}
                    onClick={(selected) => setSelectedTaskId(selected.id)}
                  />
                ))}
              </div>
            )}

            <div ref={sentinelRef} />
            {isLoadingMore && (
              <div className="tw:flex tw:justify-center tw:py-4">
                <Loader />
              </div>
            )}
          </div>

          <Box
            className="tw:h-full tw:w-full tw:overflow-y-auto tw:p-5"
            direction="col">
            {taskDetailContent}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TasksTab;
