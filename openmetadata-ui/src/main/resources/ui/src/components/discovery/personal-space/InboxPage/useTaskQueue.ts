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

import { useQueries, useQueryClient } from '@tanstack/react-query';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listMyVisibleTasks,
  listTasks,
  ListTasksParams,
  Task,
  TaskStatusGroup,
} from '../../../../rest/tasksAPI';
import { INBOX_OPEN_TASK_COUNT_QUERY_KEY } from '../inbox.constants';
import type { InboxTaskGrouping } from './components/InboxTaskListToolbar';
import { isTaskOpen } from './inbox.utils';
import {
  filterTasksByStatus,
  filterTasksByTypes,
  groupTasksByType,
  TaskStatusBucket,
} from './taskList.utils';
import {
  filterTasksByTitleSearch,
  splitTaskTitleSearch,
} from './taskTitle.utils';
import { useCurrentUserIds } from './useCurrentUserIds';
import { INBOX_COUNTS_QUERY_KEY } from './useInboxCounts';
import { useInboxInfiniteList } from './useInboxInfiniteList';

/**
 * Which tasks a queue holds: the viewer's visible ones (their Inbox), every
 * task about one entity, or the tasks assigned to one user.
 */
export type TaskListScope =
  | { type: 'visible' }
  | { type: 'entity'; aboutEntity: string }
  | { type: 'assignee'; assignee: string };

const VISIBLE_TASKS: TaskListScope = { type: 'visible' };

const getTaskScopeKey = (scope: TaskListScope): string => {
  switch (scope.type) {
    case 'entity':
      return `entity:${scope.aboutEntity}`;
    case 'assignee':
      return `assignee:${scope.assignee}`;
    default:
      return 'me';
  }
};

// The visible list is the viewer's own; the others filter every task.
const listScopedTasks = (scope: TaskListScope, params: ListTasksParams) => {
  switch (scope.type) {
    case 'entity':
      return listTasks({ ...params, aboutEntity: scope.aboutEntity });
    case 'assignee':
      return listTasks({ ...params, assignee: scope.assignee });
    default:
      return listMyVisibleTasks(params);
  }
};

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
const TASK_STATUS_COUNTS_QUERY_KEY = 'inbox-task-status-counts';
const TASK_COUNTS_STALE_TIME = 30_000;
// React Query cache key prefix for the task lists, one entry per scope, status
// and search, so switching back to a list reads it from the cache.
const TASK_LIST_QUERY_KEY = 'inbox-task-list';

export type TaskStatusFilter = 'all' | 'open' | 'closed';

export const STATUS_FILTERS: { id: TaskStatusFilter; labelKey: string }[] = [
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
export const STATUS_OPTIONS_BY_TAB: Record<
  TaskStatusFilter,
  TaskStatusBucket[]
> = {
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

/**
 * Per-status totals for the All / Open / Closed choice, fetched cheaply
 * (limit=1, server paging.total) and cached by React Query keyed on the scope.
 * A work queue has no date window: an open task never ages out. The keyed cache
 * dedupes the fetch across remounts and StrictMode's dev double-invoke, and
 * lets a host read the open count without mounting the queue; mutations
 * invalidate the key.
 */
export const useTaskStatusCounts = (
  scope: TaskListScope
): Record<TaskStatusFilter, number> => {
  const scopeKey = getTaskScopeKey(scope);
  const countQueries = useQueries({
    queries: [undefined, TaskStatusGroup.Open, TaskStatusGroup.Closed].map(
      (statusGroup) => ({
        queryKey: [
          TASK_STATUS_COUNTS_QUERY_KEY,
          scopeKey,
          statusGroup ?? 'all',
        ],
        queryFn: () =>
          listScopedTasks(scope, { statusGroup, limit: 1 }).then(
            (res) => res.paging?.total ?? 0
          ),
        staleTime: TASK_COUNTS_STALE_TIME,
      })
    ),
  });

  return getStatusCounts(countQueries);
};

export interface UseTaskQueueOptions {
  scope?: TaskListScope;
  onCountChange?: (count: number) => void;
  // The status to open on, and each choice after, for a host that shows it
  // (an entity's Tasks badge) or keeps it while the queue is unmounted.
  initialStatus?: TaskStatusFilter;
  onStatusChange?: (status: TaskStatusFilter) => void;
  // After an action changed a task: its entity may have changed with it (an
  // approved description, a new owner), so its page can re-read itself.
  onTaskChange?: () => void;
}

/**
 * A task queue's state and data: the status choice and its totals, search,
 * grouping and filters, the paged list, the selection and the handlers a task
 * action needs. Layouts (the Inbox's Triage, an entity's Tasks view) render it.
 */
export const useTaskQueue = ({
  scope = VISIBLE_TASKS,
  onCountChange,
  initialStatus = 'open',
  onStatusChange,
  onTaskChange,
}: UseTaskQueueOptions = {}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  // Land on Open by default: it's the actionable set, and its total feeds the
  // Tasks tab count so the badge matches the sidebar's open-task red bubble.
  const [status, setStatus] = useState<TaskStatusFilter>(initialStatus);
  // A host that keeps the status (an entity page's URL) may change it while
  // the queue is mounted, e.g. a link to another status.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);
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
  const handleStatusChange = useCallback(
    (next: TaskStatusFilter) => {
      setStatus(next);
      setStatusFilter([]);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  const scopeKey = getTaskScopeKey(scope);
  const statusCounts = useTaskStatusCounts(scope);

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

      return listScopedTasks(scope, params);
    },
    [status, scope, titleSearch.text]
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
    [TASK_LIST_QUERY_KEY, scopeKey, status, titleSearch.text],
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
  // Every scope's lists: a task resolved on an entity also moves in the
  // Inbox, and the Inbox must not show its old status from cache.
  const invalidateTaskLists = useCallback(
    (refetch = false) => {
      queryClient.invalidateQueries({
        queryKey: [TASK_LIST_QUERY_KEY],
        refetchType: refetch ? 'active' : 'none',
      });
    },
    [queryClient]
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
      onTaskChange?.();
    },
    [
      status,
      setItems,
      setTotal,
      invalidateTaskLists,
      refreshStatusCounts,
      syncInboxCountBadge,
      onTaskChange,
    ]
  );

  // Assignee changes can move the task out of the current user's visible set
  // (server-side rule), so refetch instead of patching the list client-side —
  // otherwise the rows and the count badges drift apart.
  const handleTaskUpdated = useCallback(() => {
    invalidateTaskLists(true);
    refreshStatusCounts();
    syncInboxCountBadge();
    onTaskChange?.();
  }, [
    invalidateTaskLists,
    refreshStatusCounts,
    syncInboxCountBadge,
    onTaskChange,
  ]);

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

  // A search or filter that matches nothing must not read as an empty queue.
  const isNarrowed = Boolean(searchQuery) || isClientNarrowed;
  const showEmptyState =
    visibleTasks.length === 0 &&
    isListSettled({ isLoading, isLoadingMore, hasMore, canLoadMore, tasks });

  return {
    status,
    statusCounts,
    handleStatusChange,
    search,
    searchQuery,
    handleSearchChange,
    handleClearFilters,
    grouping,
    setGrouping,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    tasks,
    visibleTasks,
    taskGroups,
    selectedTaskId,
    setSelectedTaskId,
    isLoading,
    isLoadingMore,
    hasMore,
    scrollRef,
    sentinelRef,
    handleScanFurther,
    handleResolved,
    handleTaskUpdated,
    handleCommentsChanged,
    isNarrowed,
    showEmptyState,
  };
};
