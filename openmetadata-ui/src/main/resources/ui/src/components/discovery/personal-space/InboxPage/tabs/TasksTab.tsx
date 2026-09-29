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
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Inbox01 } from '@untitledui/icons';
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
  DEFAULT_TASK_STATUS_BUCKETS,
  filterTasksByStatus,
  filterTasksByTypes,
  getStatusGroupForBuckets,
  groupTasksByType,
  TaskStatusBucket,
  TaskTypeGroup,
} from '../taskList.utils';
import { useCurrentUserIds } from '../useCurrentUserIds';
import { INBOX_COUNTS_QUERY_KEY } from '../useInboxCounts';
import { useInboxInfiniteList } from '../useInboxInfiniteList';
import { useIsScrolled } from '../useIsScrolled';

const TASK_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;
// `resolution` so the panel's outcome rows render from the list row instead of
// flashing empty until its own fetch lands.
const TASK_FIELDS = 'assignees,createdBy,about,comments,payload,resolution';

// React Query cache key prefix for the task lists, one entry per scope, status
// group and search, so switching back to a list reads it from the cache.
const TASK_LIST_QUERY_KEY = 'inbox-task-list';

// The chosen statuses, compared order-free, e.g. to pick an empty state.
const isSameSelection = (a: TaskStatusBucket[], b: TaskStatusBucket[]) =>
  a.length === b.length && a.every((bucket) => b.includes(bucket));

const CLOSED_BUCKETS = new Set([
  TaskStatusBucket.Approved,
  TaskStatusBucket.Rejected,
]);

type EmptyStateKind = 'all' | 'open' | 'closed';

// The empty state follows the question being asked: work in flight reads
// "nothing open", outcomes only read archival, anything else is generic.
const getEmptyStateKind = (
  statusFilter: TaskStatusBucket[]
): EmptyStateKind => {
  if (isSameSelection(statusFilter, DEFAULT_TASK_STATUS_BUCKETS)) {
    return 'open';
  }
  const isClosedSelection =
    statusFilter.length > 0 &&
    statusFilter.every((bucket) => CLOSED_BUCKETS.has(bucket));

  return isClosedSelection ? 'closed' : 'all';
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
  // Land on work still in flight: it's the actionable set, and its total feeds
  // the Tasks tab count so the badge matches the sidebar's open-task bubble.
  const [statusFilter, setStatusFilter] = useState<TaskStatusBucket[]>(
    DEFAULT_TASK_STATUS_BUCKETS
  );
  const [search, setSearch] = useState('');
  // The query the server is filtering on. Kept apart from `search` so typing
  // stays responsive while the request trails it.
  const [searchQuery, setSearchQuery] = useState('');
  const [grouping, setGrouping] = useState<InboxTaskGrouping>('type');
  // Kinds as getTaskTypeKey names them, so types sharing a label filter as one.
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const scope = aboutEntity ?? 'me';
  const currentUserIds = useCurrentUserIds();
  // Fetch only the group the chosen statuses can come from; the options within
  // it are told apart on the client (see filterTasksByStatus).
  const statusGroup = getStatusGroupForBuckets(statusFilter);

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
        statusGroup,
        fields: TASK_FIELDS,
        limit: TASK_LIMIT,
        after,
        q: searchQuery || undefined,
      };

      // aboutEntity = entity-page mode (all tasks about that entity); otherwise
      // the personal inbox is scoped to the current user's visible tasks.
      return aboutEntity
        ? listTasks({ ...params, aboutEntity })
        : listMyVisibleTasks(params);
    },
    [statusGroup, aboutEntity, searchQuery]
  );

  const {
    items: tasks,
    isLoading,
    isLoadingMore,
    total,
    scrollRef,
    sentinelRef,
    setItems,
    setTotal,
  } = useInboxInfiniteList<Task>(
    [TASK_LIST_QUERY_KEY, scope, statusGroup ?? 'all', searchQuery],
    fetchPage
  );

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  // A task action can move a task between the status groups, so the cached
  // lists go stale. `refetch` re-reads the showing list now; without it
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
  // pages here; search and the status group stay server-side.
  const visibleTasks = useMemo(
    () =>
      filterTasksByStatus(
        filterTasksByTypes(tasks, typeFilter),
        statusFilter,
        currentUserIds
      ),
    [tasks, typeFilter, statusFilter, currentUserIds]
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
      // A resolved task leaves the fetched set only if it left the status group
      // being fetched; the status filter hides it otherwise. A Data Access
      // Request that was just Approved stays open (it is awaiting grant), so
      // removing it would make it vanish and reappear on refresh.
      const leftStatusGroup =
        (statusGroup === TaskStatusGroup.Open && !isTaskOpen(resolved)) ||
        (statusGroup === TaskStatusGroup.Closed && isTaskOpen(resolved));

      if (!leftStatusGroup) {
        setItems((prev) =>
          prev.map((task) => (task.id === resolved.id ? resolved : task))
        );
      } else {
        setItems((prev) => prev.filter((task) => task.id !== resolved.id));
        setTotal((prev) => Math.max(0, prev - 1));
      }
      // The transition may shift the task across buckets, so re-sync the counts.
      invalidateTaskLists();
      syncInboxCountBadge();
    },
    [statusGroup, setItems, setTotal, invalidateTaskLists, syncInboxCountBadge]
  );

  // Assignee changes can move the task out of the current user's visible set
  // (server-side rule), so refetch instead of patching the list client-side —
  // otherwise the rows and the count badges drift apart.
  const handleTaskUpdated = useCallback(() => {
    invalidateTaskLists(true);
    syncInboxCountBadge();
  }, [invalidateTaskLists, syncInboxCountBadge]);

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

  const emptyStates: Record<EmptyStateKind, ReactNode> = {
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
  const emptyState = emptyStates[getEmptyStateKind(statusFilter)];

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
          !isLoading && visibleTasks.length === 0 ? emptyState : undefined
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
