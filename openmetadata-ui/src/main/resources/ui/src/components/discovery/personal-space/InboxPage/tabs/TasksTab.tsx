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
  Box,
  EmptyPlaceholder,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  FilterFunnel01,
  Inbox01,
} from '@openmetadata/ui-core-components/icons';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { debounce } from 'lodash';
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
import {
  listMyVisibleTasks,
  listTasks,
  Task,
  TaskStatusGroup,
} from '../../../../../rest/tasksAPI';
import { INBOX_OPEN_TASK_COUNT_QUERY_KEY } from '../../inbox.constants';
import InboxTaskListItem from '../components/InboxTaskListItem';
import InboxTaskListSkeleton from '../components/InboxTaskListSkeleton';
import InboxTaskListToolbar, {
  InboxTaskGrouping,
} from '../components/InboxTaskListToolbar';
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskDetailSkeleton from '../components/TaskDetailSkeleton';
import { TASK_TYPE_DOT_CLASS } from '../components/TaskTypeIcon';
import { isTaskOpen } from '../inbox.utils';
import { getTaskTypeBadge } from '../taskDetail.utils';
import {
  filterTasksByStatus,
  filterTasksByTypes,
  groupTasksByType,
  TaskStatusBucket,
  TaskTypeGroup,
} from '../taskList.utils';
import {
  filterTasksByTitleSearch,
  splitTaskTitleSearch,
} from '../taskTitle.utils';
import { useCurrentUserIds } from '../useCurrentUserIds';
import { INBOX_COUNTS_QUERY_KEY } from '../useInboxCounts';
import { useInboxInfiniteList } from '../useInboxInfiniteList';
import { useIsScrolled } from '../useIsScrolled';

const TASK_LIMIT = 25;
// ponytail: Type and Status narrow the loaded pages client-side, so a narrowed
// list scans at most this many tasks; a server-side type/status filter lifts it.
const MAX_NARROWED_SCAN = 200;
const SEARCH_DEBOUNCE_MS = 300;
// `resolution` so the panel's outcome rows render from the list row instead of
// flashing empty until its own fetch lands.
const TASK_FIELDS = 'assignees,createdBy,about,comments,payload,resolution';

// React Query cache key for the All/Open/Closed badge totals. Shared so a task
// mutation can invalidate them (see handleResolved / handleTaskUpdated).
export const TASK_STATUS_COUNTS_QUERY_KEY = 'inbox-task-status-counts';
const TASK_COUNTS_STALE_TIME = 30_000;
// React Query cache key prefix for the task lists, one entry per scope, status
// and search, so switching back to a list reads it from the cache.
const TASK_LIST_QUERY_KEY = 'inbox-task-list';

type TaskStatusFilter = 'all' | 'open' | 'closed';

const STATUS_FILTERS: { id: TaskStatusFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'label.all' },
  { id: 'open', labelKey: 'label.open' },
  { id: 'closed', labelKey: 'label.closed' },
];

// Pulls the three per-status totals out of the useQueries results array.
const getStatusCounts = (
  countQueries: { data?: number }[]
): Record<TaskStatusFilter, number> => ({
  all: countQueries[0].data ?? 0,
  open: countQueries[1].data ?? 0,
  closed: countQueries[2].data ?? 0,
});

// The Status options each tab can hold: Open splits into whose move it is,
// Closed into the outcome. "Open" itself is the tab, so it is never an option.
const STATUS_OPTIONS_BY_TAB: Record<TaskStatusFilter, TaskStatusBucket[]> = {
  all: [
    TaskStatusBucket.PendingApproval,
    TaskStatusBucket.InReview,
    TaskStatusBucket.Approved,
    TaskStatusBucket.Rejected,
  ],
  open: [TaskStatusBucket.PendingApproval, TaskStatusBucket.InReview],
  closed: [TaskStatusBucket.Approved, TaskStatusBucket.Rejected],
};

// "all" loads every status (no statusGroup param); Open/Closed map to the API.
const STATUS_GROUP: Record<TaskStatusFilter, TaskStatusGroup | undefined> = {
  all: undefined,
  open: TaskStatusGroup.Open,
  closed: TaskStatusGroup.Closed,
};

// Nothing more is coming: matching rows may still sit in pages being scanned.
const isListSettled = ({
  isLoading,
  isLoadingMore,
  hasMore,
  canLoadMore,
  tasks,
}: {
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  canLoadMore: (loaded: Task[]) => boolean;
  tasks: Task[];
}) => !isLoading && !isLoadingMore && (!hasMore || !canLoadMore(tasks));

interface TasksEmptyStateProps {
  status: TaskStatusFilter;
  isNarrowed: boolean;
  // Set when a narrowed scan stopped at its cap with pages still unread, so
  // "no match" covers only the tasks scanned so far.
  scannedCount?: number;
  onClearFilters: () => void;
  onLoadMore: () => void;
}

// A dedicated empty state per status: All = generic "nothing to do", Open =
// "no open tasks", Closed = archival. A search or filter that matches nothing
// says so instead, with a way back to the whole queue.
const TasksEmptyState = ({
  status,
  isNarrowed,
  scannedCount,
  onClearFilters,
  onLoadMore,
}: TasksEmptyStateProps) => {
  const { t } = useTranslation();
  const isScanCapped = scannedCount !== undefined;
  const clearAction = {
    key: 'clear-filters',
    label: t('label.clear-all'),
    onPress: onClearFilters,
  };

  const noMatch = (
    <EmptyPlaceholder
      actions={
        isScanCapped
          ? [
              {
                key: 'load-more',
                label: t('label.load-more'),
                onPress: onLoadMore,
              },
              clearAction,
            ]
          : [clearAction]
      }
      data-testid={
        isScanCapped ? 'inbox-tasks-no-match-scanned' : 'inbox-tasks-no-match'
      }
      description={
        isScanCapped
          ? t('message.no-match-in-first-tasks', { count: scannedCount })
          : t('message.no-results-for-filters-description')
      }
      icon={
        <FilterFunnel01 className="tw:size-7 tw:text-utility-gray-blue-600" />
      }
      title={t('message.no-match-found')}
      variant="blank"
    />
  );

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

  return <>{isNarrowed ? noMatch : emptyStateByStatus[status]}</>;
};

export interface TasksTabProps {
  // When set, lists all tasks about this entity FQN (entity-page usage). Without
  // it the tab shows the current user's *visible* tasks (assigned to me/my teams
  // or about entities I own) — never every task in the system.
  aboutEntity?: string;
  className?: string;
  onCountChange?: (count: number) => void;
}

interface TasksTabBodyProps {
  // Status, search and filter controls, heading the list column.
  toolbar: ReactNode;
  // Shown in place of the detail when no task matches.
  emptyState?: ReactNode;
  isLoading: boolean;
  isLoadingMore: boolean;
  tasks: Task[];
  // Set when grouped by type; the list renders these instead of `tasks`.
  groups?: TaskTypeGroup[];
  selectedTaskId?: string;
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
  setSelectedTaskId: (id: string) => void;
  handleCommentsChanged: (updated: Task) => void;
  handleResolved: (resolved: Task) => void;
  handleTaskUpdated: () => void;
}

// The two panes: the list column (its controls over the grouped rows) and the
// selected task's detail, each scrolling on its own.
const TasksTabBody: React.FC<TasksTabBodyProps> = ({
  toolbar,
  emptyState,
  isLoading,
  isLoadingMore,
  tasks,
  groups,
  selectedTaskId,
  scrollRef,
  sentinelRef,
  setSelectedTaskId,
  handleCommentsChanged,
  handleResolved,
  handleTaskUpdated,
}) => {
  const { t } = useTranslation();
  const { isScrolled: isListScrolled, onScroll: onListScroll } =
    useIsScrolled();

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
  const groupedList = groups?.map((group) => {
    // Every task in a group reads the same, so its first one names it.
    const badge = getTaskTypeBadge(group.items[0], t);

    return (
      <Box direction="col" gap={1} key={group.key}>
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
      <Box
        className="tw:min-h-0 tw:border-r tw:border-secondary"
        direction="col">
        {/* Lifts off the rows with a light shadow once they scroll under it. */}
        <div
          className={classNames(
            'tw:relative tw:z-10 tw:transition-shadow',
            isListScrolled && 'tw:shadow-sm'
          )}>
          {toolbar}
        </div>
        <div
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
          data-testid="inbox-tasks-scroll"
          ref={scrollRef}
          onScroll={onListScroll}>
          {isLoading ? (
            <InboxTaskListSkeleton />
          ) : (
            <div className="tw:flex tw:flex-col tw:gap-4 tw:px-3 tw:pb-3">
              {groupedList ?? tasks.map(renderRow)}
            </div>
          )}

          <div ref={sentinelRef} />
          {isLoadingMore && (
            <div className="tw:flex tw:justify-center tw:py-4">
              <Loader />
            </div>
          )}
        </div>
      </Box>

      <Box className="tw:relative tw:min-h-0 tw:w-full" direction="col">
        {isLoading ? <TaskDetailSkeleton /> : emptyState ?? detailContent}
      </Box>
    </Box>
  );
};

const TasksTab: React.FC<TasksTabProps> = ({
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
  // Kinds as getTaskTypeKey names them, so types sharing a label filter as one.
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  // Narrows the active tab; nothing chosen shows all of it.
  const [statusFilter, setStatusFilter] = useState<TaskStatusBucket[]>([]);
  const currentUserIds = useCurrentUserIds();

  // A new tab offers other statuses, so a choice made for the last one would
  // only hide rows; start the new tab unfiltered.
  const handleStatusChange = useCallback((next: TaskStatusFilter) => {
    setStatus(next);
    setStatusFilter([]);
  }, []);

  // Per-status totals for the All / Open / Closed badges, fetched cheaply
  // (limit=1, server paging.total) and cached by React Query keyed on the active
  // scope. A work queue has no date window: an open task never ages out. The
  // keyed cache dedupes the fetch across tab-switch remounts and StrictMode's
  // dev double-invoke; mutations invalidate the key.
  const scope = aboutEntity ?? 'me';
  const countQueries = useQueries({
    queries: [undefined, TaskStatusGroup.Open, TaskStatusGroup.Closed].map(
      (statusGroup) => ({
        queryKey: [TASK_STATUS_COUNTS_QUERY_KEY, scope, statusGroup ?? 'all'],
        queryFn: () =>
          (aboutEntity ? listTasks : listMyVisibleTasks)({
            statusGroup,
            limit: 1,
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

  const handleClearFilters = useCallback(() => {
    commitSearch.cancel();
    setSearch('');
    setSearchQuery('');
    setTypeFilter([]);
    setStatusFilter([]);
  }, [commitSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      commitSearch(value);
    },
    [commitSearch]
  );

  // A search that opens with a task type's title words ("Request TestCase") is
  // matched against the title shown here; only the rest goes to the server,
  // which never stores the composed title.
  const titleSearch = useMemo(
    () => splitTaskTitleSearch(searchQuery, t),
    [searchQuery, t]
  );

  const fetchPage = useCallback(
    (after?: string) => {
      const params = {
        statusGroup: STATUS_GROUP[status],
        fields: TASK_FIELDS,
        limit: TASK_LIMIT,
        after,
        q: titleSearch.text || undefined,
      };

      // aboutEntity = entity-page mode (all tasks about that entity); otherwise
      // the personal inbox is scoped to the current user's visible tasks.
      return aboutEntity
        ? listTasks({ ...params, aboutEntity })
        : listMyVisibleTasks(params);
    },
    [status, aboutEntity, titleSearch.text]
  );

  // A short narrowed list keeps the scroll sentinel in view, which would page
  // through the user's whole history; stop after a bounded scan.
  const isClientNarrowed =
    typeFilter.length > 0 ||
    statusFilter.length > 0 ||
    Boolean(titleSearch.titleWords);
  // "Load more" on a capped no-match raises the cap by another scan, for that
  // narrowing only: the raise is keyed to the inputs it was made under, so any
  // change of tab, search or filter falls back to the base cap.
  const scanKey = JSON.stringify([
    status,
    searchQuery,
    typeFilter,
    statusFilter,
  ]);
  const [scanRaise, setScanRaise] = useState({ key: scanKey, extra: 0 });
  const scanLimit =
    MAX_NARROWED_SCAN + (scanRaise.key === scanKey ? scanRaise.extra : 0);
  const canLoadMore = useCallback(
    (loaded: Task[]) => !isClientNarrowed || loaded.length < scanLimit,
    [isClientNarrowed, scanLimit]
  );
  const handleScanFurther = useCallback(
    () =>
      setScanRaise((raise) => ({
        key: scanKey,
        extra: (raise.key === scanKey ? raise.extra : 0) + MAX_NARROWED_SCAN,
      })),
    [scanKey]
  );

  const {
    items: tasks,
    isLoading,
    isLoadingMore,
    hasMore,
    total,
    scrollRef,
    sentinelRef,
    setItems,
    setTotal,
  } = useInboxInfiniteList<Task>(
    [TASK_LIST_QUERY_KEY, scope, status, titleSearch.text],
    fetchPage,
    canLoadMore
  );

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  // Invalidate the cached badge totals so a task action re-fetches them.
  const refreshStatusCounts = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [TASK_STATUS_COUNTS_QUERY_KEY],
    });
  }, [queryClient]);

  // A task action can move a task between the All/Open/Closed lists, so the
  // cached ones go stale. `refetch` re-reads the showing list now; without it
  // the showing list keeps its in-place edit and every list re-reads on its
  // next visit.
  const invalidateTaskLists = useCallback(
    (refetch = false) => {
      queryClient.invalidateQueries({
        queryKey: [TASK_LIST_QUERY_KEY, scope],
        refetchType: refetch ? 'active' : 'none',
      });
    },
    [queryClient, scope]
  );

  // The server has no `type` filter on the scoped lists, and statuses such as
  // "Pending approval" are the viewer's own reading, so both narrow the loaded
  // pages here; search and the tab's status group stay server-side.
  const visibleTasks = useMemo(
    () =>
      filterTasksByStatus(
        filterTasksByTitleSearch(
          filterTasksByTypes(tasks, typeFilter),
          titleSearch,
          t
        ),
        statusFilter,
        currentUserIds
      ),
    [tasks, typeFilter, titleSearch, t, statusFilter, currentUserIds]
  );

  // Grouped once here so the list and the default selection agree on order.
  const taskGroups = useMemo(
    () => (grouping === 'type' ? groupTasksByType(visibleTasks) : undefined),
    [grouping, visibleTasks]
  );
  // The top row as displayed; grouping reorders the server's newest-first
  // list, so its first task can sit anywhere in the grouped view.
  const firstTaskId = taskGroups
    ? taskGroups[0]?.items[0]?.id
    : visibleTasks[0]?.id;

  // Keep a valid selection: default to the top row and recover if the
  // selected one drops out of the list (e.g. after resolution or filtering).
  useEffect(() => {
    setSelectedTaskId((prev) =>
      prev && visibleTasks.some((task) => task.id === prev) ? prev : firstTaskId
    );
  }, [visibleTasks, firstTaskId]);

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
      invalidateTaskLists();
      refreshStatusCounts();
      syncInboxCountBadge();
    },
    [
      status,
      setItems,
      setTotal,
      invalidateTaskLists,
      refreshStatusCounts,
      syncInboxCountBadge,
    ]
  );

  // Assignee changes can move the task out of the current user's visible set
  // (server-side rule), so refetch instead of patching the list client-side —
  // otherwise the rows and the count badges drift apart.
  const handleTaskUpdated = useCallback(() => {
    invalidateTaskLists(true);
    refreshStatusCounts();
    syncInboxCountBadge();
  }, [invalidateTaskLists, refreshStatusCounts, syncInboxCountBadge]);

  // A comment change doesn't affect the task's bucket or visibility, so patch the
  // row in place instead of refetching the list.
  const handleCommentsChanged = useCallback(
    (updated: Task) => {
      setItems((prev) =>
        prev.map((task) => (task.id === updated.id ? updated : task))
      );
      invalidateTaskLists();
    },
    [setItems, invalidateTaskLists]
  );

  // A segmented control on a gray track: the selected option is a raised white
  // chip with no outline, and its total takes the brand colour.
  const statusTabs = (
    <Tabs
      className="tw:w-fit"
      selectedKey={status}
      onSelectionChange={(key) => handleStatusChange(key as TaskStatusFilter)}>
      <Tabs.List
        className="tw:rounded-lg tw:bg-tertiary tw:p-1 tw:outline-0"
        size="sm"
        type="button-border">
        {STATUS_FILTERS.map(({ id, labelKey }) => (
          <Tabs.Item
            className={({ isSelected }) =>
              classNames(
                'tw:gap-1.5 tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold',
                isSelected ? 'tw:text-primary' : 'tw:text-tertiary'
              )
            }
            id={id}
            key={id}>
            {({ isSelected }) => (
              <>
                {t(labelKey)}
                <span
                  className={
                    isSelected ? 'tw:text-brand-secondary' : 'tw:text-tertiary'
                  }>
                  {statusCounts[id]}
                </span>
              </>
            )}
          </Tabs.Item>
        ))}
      </Tabs.List>
    </Tabs>
  );

  // A search or filter that matches nothing must not read as an empty queue.
  const isNarrowed = Boolean(searchQuery) || isClientNarrowed;
  const showEmptyState =
    visibleTasks.length === 0 &&
    isListSettled({ isLoading, isLoadingMore, hasMore, canLoadMore, tasks });

  return (
    <Box
      className={classNames(
        'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
        className
      )}
      data-testid="inbox-tasks-tab"
      direction="col">
      <TasksTabBody
        emptyState={
          showEmptyState ? (
            <TasksEmptyState
              isNarrowed={isNarrowed}
              scannedCount={hasMore ? tasks.length : undefined}
              status={status}
              onClearFilters={handleClearFilters}
              onLoadMore={handleScanFurther}
            />
          ) : undefined
        }
        groups={taskGroups}
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
        toolbar={
          <InboxTaskListToolbar
            grouping={grouping}
            search={search}
            statusFilter={statusFilter}
            statusOptions={STATUS_OPTIONS_BY_TAB[status]}
            statusTabs={statusTabs}
            tasks={tasks}
            typeFilter={typeFilter}
            onGroupingChange={setGrouping}
            onSearchChange={handleSearchChange}
            onStatusFilterChange={setStatusFilter}
            onTypeFilterChange={setTypeFilter}
          />
        }
      />
    </Box>
  );
};

export default TasksTab;
