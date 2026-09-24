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
import { debounce } from 'lodash';
import { DateRangeObject } from 'Models';
import React, {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../../components/common/Loader/Loader';
import { TaskType } from '../../../../../generated/entity/tasks/task';
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
import InboxTaskListToolbar, {
  InboxTaskGrouping,
} from '../components/InboxTaskListToolbar';
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskDetailSkeleton from '../components/TaskDetailSkeleton';
import { TASK_TYPE_DOT_CLASS } from '../components/TaskTypeIcon';
import { InboxDateRange, isTaskOpen } from '../inbox.utils';
import { getTaskTypeBadge } from '../taskDetail.utils';
import { filterTasksByTypes, groupTasksByType } from '../taskList.utils';
import { INBOX_COUNTS_QUERY_KEY } from '../useInboxCounts';
import { useInboxInfiniteList } from '../useInboxInfiniteList';

const TASK_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;
// `resolution` so the panel's outcome rows render from the list row instead of
// flashing empty until its own fetch lands.
const TASK_FIELDS = 'assignees,createdBy,about,comments,payload,resolution';

// React Query cache key for the All/Open/Closed badge totals. Shared so a task
// mutation can invalidate them (see handleResolved / handleTaskUpdated).
export const TASK_STATUS_COUNTS_QUERY_KEY = 'inbox-task-status-counts';
const TASK_COUNTS_STALE_TIME = 30_000;

type TaskStatusFilter = 'all' | 'open' | 'closed';

// Pulls the three per-status totals out of the useQueries results array.
const getStatusCounts = (
  countQueries: { data?: number }[]
): Record<TaskStatusFilter, number> => ({
  all: countQueries[0].data ?? 0,
  open: countQueries[1].data ?? 0,
  closed: countQueries[2].data ?? 0,
});

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

interface TasksTabBodyProps {
  isLoading: boolean;
  isLoadingMore: boolean;
  tasks: Task[];
  grouping: InboxTaskGrouping;
  selectedTaskId?: string;
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
  setSelectedTaskId: (id: string) => void;
  handleCommentsChanged: (updated: Task) => void;
  handleResolved: (resolved: Task) => void;
  handleTaskUpdated: () => void;
}

// The two-pane task list + detail panel, rendered once tasks have loaded (or
// while the initial/subsequent pages are loading).
const TasksTabBody: React.FC<TasksTabBodyProps> = ({
  isLoading,
  isLoadingMore,
  tasks,
  grouping,
  selectedTaskId,
  scrollRef,
  sentinelRef,
  setSelectedTaskId,
  handleCommentsChanged,
  handleResolved,
  handleTaskUpdated,
}) => {
  const { t } = useTranslation();

  const detailContent = selectedTaskId ? (
    <TaskDetailPanel
      fallbackTask={tasks.find((task) => task.id === selectedTaskId)}
      key={selectedTaskId}
      taskId={selectedTaskId}
      onCommentsChanged={handleCommentsChanged}
      onResolved={handleResolved}
      onTaskUpdated={handleTaskUpdated}
    />
  ) : (
    <Box align="center" className="tw:w-full tw:justify-center tw:py-16">
      <Typography className="tw:text-secondary">
        {t('label.no-tasks-right-now')}
      </Typography>
    </Box>
  );

  const renderRow = (task: Task) => (
    <InboxTaskListItem
      isActive={selectedTaskId === task.id}
      key={task.id}
      task={task}
      onClick={(selected) => setSelectedTaskId(selected.id)}
    />
  );

  // Grouping covers the pages loaded so far: the server paginates by cursor,
  // not by type, so a later page can reopen a group that already appeared.
  const groupedList = groupTasksByType(tasks).map((group) => {
    const badge = getTaskTypeBadge({ type: group.type } as Task, t);

    return (
      <Box direction="col" gap={1} key={group.type}>
        <Box
          align="center"
          className="tw:gap-2 tw:px-1 tw:py-2"
          data-testid="inbox-task-group">
          <span
            aria-hidden
            className={classNames(
              'tw:size-1.5 tw:shrink-0 tw:rounded-full',
              TASK_TYPE_DOT_CLASS[badge.color] ?? TASK_TYPE_DOT_CLASS.gray
            )}
          />
          <Typography
            className="tw:uppercase tw:text-tertiary tw:tracking-wide"
            size="text-xs"
            weight="semibold">
            {badge.label}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-xs">
            {group.count}
          </Typography>
          <span className="tw:h-px tw:flex-1 tw:bg-border-secondary" />
        </Box>
        {group.items.map(renderRow)}
      </Box>
    );
  });

  return (
    <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[2fr_3fr]">
      <div
        className="tw:h-full tw:overflow-y-auto tw:border-r tw:border-utility-gray-blue-100"
        data-testid="inbox-tasks-scroll"
        ref={scrollRef}>
        {isLoading ? (
          <InboxTaskListSkeleton />
        ) : (
          <div className="tw:flex tw:flex-col tw:gap-3 tw:p-3">
            {grouping === 'type' ? groupedList : tasks.map(renderRow)}
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
        {isLoading ? <TaskDetailSkeleton /> : detailContent}
      </Box>
    </Box>
  );
};

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
  const [search, setSearch] = useState('');
  // The query the server is filtering on. Kept apart from `search` so typing
  // stays responsive while the request trails it.
  const [searchQuery, setSearchQuery] = useState('');
  const [grouping, setGrouping] = useState<InboxTaskGrouping>('type');
  const [typeFilter, setTypeFilter] = useState<TaskType[]>([]);

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
  const statusCounts = getStatusCounts(countQueries);

  // One trailing commit per pause, so a typed word costs one request, not one
  // per keystroke. Recreated only if the component remounts.
  const commitSearch = useMemo(
    () =>
      debounce((value: string) => setSearchQuery(value), SEARCH_DEBOUNCE_MS),
    []
  );

  useEffect(() => () => commitSearch.cancel(), [commitSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      commitSearch(value);
    },
    [commitSearch]
  );

  const fetchPage = useCallback(
    (after?: string) => {
      const params = {
        statusGroup: STATUS_GROUP[status],
        fields: TASK_FIELDS,
        limit: TASK_LIMIT,
        after,
        startTs: dateRange?.startTs,
        endTs: dateRange?.endTs,
        q: searchQuery || undefined,
      };

      // aboutEntity = entity-page mode (all tasks about that entity); otherwise
      // the personal inbox is scoped to the current user's visible tasks.
      return aboutEntity
        ? listTasks({ ...params, aboutEntity })
        : listMyVisibleTasks(params);
    },
    [status, aboutEntity, dateRange?.startTs, dateRange?.endTs, searchQuery]
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

  // The server has no `type` filter on the scoped lists, so the chosen types
  // narrow the loaded pages here; search and status stay server-side.
  const visibleTasks = useMemo(
    () => filterTasksByTypes(tasks, typeFilter),
    [tasks, typeFilter]
  );

  // Keep a valid selection: default to the first task and recover if the
  // selected one drops out of the list (e.g. after resolution or filtering).
  useEffect(() => {
    setSelectedTaskId((prev) =>
      prev && visibleTasks.some((task) => task.id === prev)
        ? prev
        : visibleTasks[0]?.id
    );
  }, [visibleTasks]);

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
      const matchesOpenFilter =
        status === 'open' ? isTaskOpen(resolved) : !isTaskOpen(resolved);
      const stillVisible = status === 'all' ? true : matchesOpenFilter;

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
            ? 'tw:border tw:border-blue-200 tw:bg-white tw:text-blue-700 tw:dark:bg-brand-950 tw:dark:border-brand-800'
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

      <Box className="tw:border-b tw:border-secondary tw:px-3 tw:py-2">
        <InboxTaskListToolbar
          grouping={grouping}
          search={search}
          tasks={tasks}
          typeFilter={typeFilter}
          onGroupingChange={setGrouping}
          onSearchChange={handleSearchChange}
          onTypeFilterChange={setTypeFilter}
        />
      </Box>

      {!isLoading && visibleTasks.length === 0 ? (
        <Box className="tw:relative tw:min-h-0 tw:flex-1">{emptyState}</Box>
      ) : (
        <TasksTabBody
          grouping={grouping}
          handleCommentsChanged={handleCommentsChanged}
          handleResolved={handleResolved}
          handleTaskUpdated={handleTaskUpdated}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          scrollRef={scrollRef}
          selectedTaskId={selectedTaskId}
          sentinelRef={sentinelRef}
          setSelectedTaskId={setSelectedTaskId}
          tasks={visibleTasks}
        />
      )}
    </Box>
  );
};

export default TasksTab;
