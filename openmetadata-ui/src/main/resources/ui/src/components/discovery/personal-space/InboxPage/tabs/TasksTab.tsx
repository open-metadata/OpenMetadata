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

import { Box, Tabs, Typography } from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  FilterFunnel01,
  Inbox01,
} from '@openmetadata/ui-core-components/icons';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce, uniqBy } from 'lodash';
import React, {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import PermissionPlaceholder from '../../../../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import Loader from '../../../../../components/common/Loader/Loader';
import { ClientErrors } from '../../../../../enums/Axios.enum';
import { User } from '../../../../../generated/entity/teams/user';
import { useViewedUserFirstName } from '../../../../../hooks/discovery/personal-space/useViewedUserFirstName';
import { MY_TASKS_QUERY_KEY } from '../../../../../hooks/useMyTasks';
import {
  listMyVisibleTasks,
  listTasks,
  Task,
  TaskStatusGroup,
} from '../../../../../rest/tasksAPI';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import {
  INBOX_OPEN_TASK_COUNT_QUERY_KEY,
  TASK_LIST_QUERY_KEY,
  TASK_STATUS_COUNTS_QUERY_KEY,
} from '../../inbox.constants';
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
  hasNothingToShow,
  isWholeTabLoadFailed,
  TaskStatusBucket,
  TaskTypeGroup,
} from '../taskList.utils';
import { getTaskStatusLabel } from '../taskResolution.utils';
import {
  filterTasksByTitleSearch,
  splitTaskTitleSearch,
} from '../taskTitle.utils';
import { useCurrentUserIds } from '../useCurrentUserIds';
import { useInboxInfiniteList } from '../useInboxInfiniteList';
import { useIsScrolled } from '../useIsScrolled';
import { useLinkedTaskId } from '../useLinkedTaskId';
import {
  fetchUserTasksPage,
  getUserTaskScope,
  userTaskCountQuery,
} from '../useUserTasks';

const TASK_LIMIT = 25;
// ponytail: Type and Status narrow the loaded pages client-side, so a narrowed
// list scans at most this many tasks; a server-side type/status filter lifts it.
const MAX_NARROWED_SCAN = 200;
const SEARCH_DEBOUNCE_MS = 300;
// `resolution` so the panel's outcome rows render from the list row instead of
// flashing empty until its own fetch lands.
const TASK_FIELDS = 'assignees,createdBy,about,comments,payload,resolution';
const TASK_COUNTS_STALE_TIME = 30_000;

type TaskStatusFilter = 'all' | 'open' | 'closed';

const STATUS_FILTERS: { id: TaskStatusFilter; labelKey: string }[] = [
  { id: 'all', labelKey: 'label.all' },
  { id: 'open', labelKey: 'label.open' },
  { id: 'closed', labelKey: 'label.closed' },
];

// Pulls the three per-status totals out of the useQueries results array. A
// failed count shows no badge rather than a misleading 0.
const getStatusCounts = (
  countQueries: { data?: number; isError: boolean }[]
): Record<TaskStatusFilter, number | undefined> => {
  const [all, open, closed] = countQueries.map(({ data, isError }) =>
    isError ? undefined : data ?? 0
  );

  return { all, open, closed };
};

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

interface TasksEmptyStateProps {
  // The list failed to load; shown in place of any empty state.
  error?: unknown;
  status: TaskStatusFilter;
  isNarrowed: boolean;
  // Set when a narrowed scan stopped at its cap with pages still unread, so
  // "no match" covers only the tasks scanned so far.
  scannedCount?: number;
  // Set when the list is another user's, so the copy names them, not "you".
  userFirstName?: string;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
}

// A dedicated empty state per status: All = generic "nothing to do", Open =
// "no open tasks", Closed = archival. A search or filter that matches nothing
// says so instead, with a way back to the whole queue.
const TasksEmptyState = ({
  error,
  status,
  isNarrowed,
  scannedCount,
  userFirstName,
  onClearFilters,
  onLoadMore,
  onRetry,
}: TasksEmptyStateProps) => {
  const { t } = useTranslation();

  if (error) {
    return (error as AxiosError)?.response?.status ===
      ClientErrors.FORBIDDEN ? (
      <PermissionPlaceholder
        permissionValue={t('label.view-entity', {
          entity: t('label.task-plural'),
        })}
      />
    ) : (
      <SomethingWentWrongPlaceholder
        description={t('server.entity-fetch-error', {
          entity: t('label.task-plural'),
        })}
        onReload={onRetry}
      />
    );
  }
  const isScanCapped = scannedCount !== undefined;
  const clearAction = {
    key: 'clear-filters',
    label: t('label.clear-all'),
    onPress: onClearFilters,
  };

  const noMatch = (
    <NoFilteredResultsPlaceholder
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
      icon={<FilterFunnel01 className="tw:size-7" />}
      title={t('message.no-match-found')}
    />
  );

  const emptyStateByStatus: Record<TaskStatusFilter, ReactNode> = {
    all: (
      <NoDataPlaceholder
        data-testid="inbox-tasks-empty"
        description={t('message.tasks-empty-description')}
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-tasks-right-now')}
      />
    ),
    open: (
      <NoDataPlaceholder
        data-testid="inbox-tasks-open-empty"
        description={t('message.tasks-open-empty-description')}
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-open-tasks-yet')}
      />
    ),
    closed: (
      <NoDataPlaceholder
        data-testid="inbox-tasks-closed-empty"
        description={t('message.tasks-closed-empty-description')}
        icon={<Inbox01 className="tw:size-7" />}
        title={t('label.no-closed-tasks-yet')}
      />
    ),
  };

  if (isNarrowed) {
    return noMatch;
  }

  if (!userFirstName) {
    return emptyStateByStatus[status];
  }

  // Another user's tab names them and keeps the status: their Closed tab must
  // not say they have no tasks at all while Open has some. The viewer's own
  // copy ("assigned to you") would misread here.
  const userEmptyState: Record<
    TaskStatusFilter,
    { titleKey: string; descriptionKey: string; testId: string }
  > = {
    all: {
      titleKey: 'label.no-tasks-yet',
      descriptionKey: 'message.user-tasks-empty-description',
      testId: 'inbox-tasks-user-empty',
    },
    open: {
      titleKey: 'label.no-open-tasks-yet',
      descriptionKey: 'message.user-open-tasks-empty-description',
      testId: 'inbox-tasks-user-open-empty',
    },
    closed: {
      titleKey: 'label.no-closed-tasks-yet',
      descriptionKey: 'message.user-closed-tasks-empty-description',
      testId: 'inbox-tasks-user-closed-empty',
    },
  };
  const { titleKey, descriptionKey, testId } = userEmptyState[status];

  return (
    <NoDataPlaceholder
      data-testid={testId}
      description={t(descriptionKey, { name: userFirstName })}
      icon={
        status === 'closed' ? (
          <Inbox01 className="tw:size-7" />
        ) : (
          <CheckCircle className="tw:size-7 tw:text-utility-success-600" />
        )
      }
      title={t(titleKey)}
    />
  );
};

// The cache scope of the lists and counts: an entity, a user, or the viewer.
const getTaskScope = (aboutEntity?: string, user?: User) =>
  aboutEntity ?? (user ? getUserTaskScope(user.id) : 'me');

const getTaskCountQuery = (
  scope: string,
  statusGroup: TaskStatusGroup | undefined,
  aboutEntity?: string,
  user?: User
) =>
  user && !aboutEntity
    ? userTaskCountQuery(user, statusGroup)
    : {
        queryKey: [TASK_STATUS_COUNTS_QUERY_KEY, scope, statusGroup ?? 'all'],
        queryFn: () =>
          (aboutEntity ? listTasks : listMyVisibleTasks)({
            statusGroup,
            limit: 1,
            ...(aboutEntity ? { aboutEntity } : {}),
          }).then((res) => res.paging?.total ?? 0),
        staleTime: TASK_COUNTS_STALE_TIME,
      };

export interface TasksTabProps {
  // When set, lists all tasks about this entity FQN (entity-page usage). Without
  // it the tab shows the current user's *visible* tasks (assigned to me/my teams
  // or about entities I own) — never every task in the system.
  aboutEntity?: string;
  // Scopes the tab to the tasks assigned to or created by this user, read from
  // their side (whose move "pending approval" means).
  user?: User;
  // Set for a list-only layout: no detail pane, and a row opens its task here.
  onOpenTask?: (taskId: string) => void;
  className?: string;
  onCountChange?: (count: number) => void;
}

interface TasksTabBodyProps {
  // Status, search and filter controls, heading the list column.
  toolbar: ReactNode;
  // Shown in place of the detail when no task matches.
  emptyState?: ReactNode;
  // A failed load with nothing listed leaves nothing to filter, so the
  // placeholder takes the whole tab.
  isLoadFailed?: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  tasks: Task[];
  // Set when grouped by type; the list renders these instead of `tasks`.
  groups?: TaskTypeGroup[];
  selectedTaskId?: string;
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
  setSelectedTaskId: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
  // Whose ids read an open task's status on its row (list-only layout).
  statusUserIds: ReadonlySet<string>;
  handleCommentsChanged: (updated: Task) => void;
  handleResolved: (resolved: Task) => void;
  handleTaskUpdated: () => void;
}

type TasksDetailPaneProps = Pick<
  TasksTabBodyProps,
  | 'emptyState'
  | 'isLoading'
  | 'tasks'
  | 'selectedTaskId'
  | 'handleCommentsChanged'
  | 'handleResolved'
  | 'handleTaskUpdated'
>;

// The selected task beside the list, or why there is none.
const TasksDetailPane: React.FC<TasksDetailPaneProps> = ({
  emptyState,
  isLoading,
  tasks,
  selectedTaskId,
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

  return (
    <Box className="tw:relative tw:min-h-0 tw:w-full" direction="col">
      {isLoading ? <TaskDetailSkeleton /> : emptyState ?? detailContent}
    </Box>
  );
};

// The two panes: the list column (its controls over the grouped rows) and the
// selected task's detail, each scrolling on its own.
const TasksTabBody: React.FC<TasksTabBodyProps> = ({
  toolbar,
  emptyState,
  isLoadFailed = false,
  isLoading,
  isLoadingMore,
  tasks,
  groups,
  selectedTaskId,
  scrollRef,
  sentinelRef,
  setSelectedTaskId,
  onOpenTask,
  statusUserIds,
  handleCommentsChanged,
  handleResolved,
  handleTaskUpdated,
}) => {
  const { t } = useTranslation();
  const { isScrolled: isListScrolled, onScroll: onListScroll } =
    useIsScrolled();

  const renderRow = (task: Task) =>
    onOpenTask ? (
      <InboxTaskListItem
        key={task.id}
        statusBadge={getTaskStatusLabel(task, statusUserIds, t)}
        task={task}
        onClick={(selected) => onOpenTask(selected.id)}
      />
    ) : (
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
        </Box>
        {group.items.map(renderRow)}
      </Box>
    );
  });

  const listColumn = (
    <Box
      className={classNames(
        'tw:min-h-0',
        onOpenTask ? 'tw:flex-1' : 'tw:border-r tw:border-secondary'
      )}
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
        className="tw:relative tw:min-h-0 tw:flex-1 tw:overflow-y-auto"
        data-testid="inbox-tasks-scroll"
        ref={scrollRef}
        onScroll={onListScroll}>
        {isLoading ? (
          <InboxTaskListSkeleton />
        ) : (
          <div className="tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:pb-3">
            {/* Without a detail pane, the list is where "nothing here" shows. */}
            {(onOpenTask && emptyState) ||
              (groupedList ?? tasks.map(renderRow))}
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
  );

  if (isLoadFailed) {
    return (
      <Box className="tw:relative tw:min-h-0 tw:w-full tw:flex-1">
        {emptyState}
      </Box>
    );
  }

  if (onOpenTask) {
    return listColumn;
  }

  // `minmax(0, …)`: a bare `fr` track never shrinks below its content, so one
  // long unbreakable title would widen the list and push the detail off-screen.
  return (
    <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {listColumn}

      <TasksDetailPane
        emptyState={emptyState}
        handleCommentsChanged={handleCommentsChanged}
        handleResolved={handleResolved}
        handleTaskUpdated={handleTaskUpdated}
        isLoading={isLoading}
        selectedTaskId={selectedTaskId}
        tasks={tasks}
      />
    </Box>
  );
};

const TasksTab: React.FC<TasksTabProps> = ({
  aboutEntity,
  user,
  onOpenTask,
  className,
  onCountChange,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // A link from outside the inbox opens on its task. The task may sit past the
  // loaded page, so the selection keeps it rather than falling back to the
  // top row; the detail panel fetches it by id.
  const linkedTaskId = useLinkedTaskId();
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(
    linkedTaskId
  );
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
  const currentUserIds = useCurrentUserIds(user);
  const userFirstName = useViewedUserFirstName(user);

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
  const scope = getTaskScope(aboutEntity, user);
  const countQueries = useQueries({
    queries: [undefined, TaskStatusGroup.Open, TaskStatusGroup.Closed].map(
      (statusGroup) => getTaskCountQuery(scope, statusGroup, aboutEntity, user)
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

      // aboutEntity = entity-page mode (all tasks about that entity); a user
      // scopes it to theirs; otherwise the personal inbox is scoped to the
      // current user's visible tasks.
      if (aboutEntity) {
        return listTasks({ ...params, aboutEntity });
      }

      return user
        ? fetchUserTasksPage(user, params, after)
        : listMyVisibleTasks(params);
    },
    [status, aboutEntity, user, titleSearch.text]
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
    items: loadedTasks,
    isLoading,
    isLoadingMore,
    hasMore,
    total,
    error,
    refetch,
    scrollRef,
    sentinelRef,
    setItems,
    setTotal,
  } = useInboxInfiniteList<Task>(
    [TASK_LIST_QUERY_KEY, scope, status, titleSearch.text],
    fetchPage,
    canLoadMore
  );

  // Pages are fetched at different times, so a task that changes in between
  // (say, assigned to the user after it loaded as one they created) can land
  // on two of them.
  const tasks = useMemo(() => uniqBy(loadedTasks, 'id'), [loadedTasks]);

  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  // Invalidate the cached badge totals so a task action re-fetches them.
  const refreshStatusCounts = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: [TASK_STATUS_COUNTS_QUERY_KEY],
    });
  }, [queryClient]);

  // A task action can move a task between the All/Open/Closed lists, so the
  // cached ones go stale. `refetch` re-reads the showing list now; without it
  // the showing list keeps its in-place edit and every list re-reads on its
  // next visit.
  const invalidateTaskLists = useCallback(
    (refetch = false) => {
      void queryClient.invalidateQueries({
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
      prev &&
      (prev === linkedTaskId || visibleTasks.some((task) => task.id === prev))
        ? prev
        : firstTaskId
    );
  }, [visibleTasks, firstTaskId, linkedTaskId]);

  // The Triage tab badge and the sidebar inbox bubble read one open-task query,
  // so a mutation here would otherwise sit behind its stale window — and the
  // sidebar never unmounts, so it would not refetch until a navigation or a tab
  // refocus. The home page's My Tasks card caches the same open tasks, so a
  // return home within its TTL would still offer actions on a resolved one.
  const syncOpenTaskReaders = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: INBOX_OPEN_TASK_COUNT_QUERY_KEY,
    });
    void queryClient.invalidateQueries({ queryKey: MY_TASKS_QUERY_KEY });
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
      syncOpenTaskReaders();
    },
    [
      status,
      setItems,
      setTotal,
      invalidateTaskLists,
      refreshStatusCounts,
      syncOpenTaskReaders,
    ]
  );

  // Assignee changes can move the task out of the current user's visible set
  // (server-side rule), so refetch instead of patching the list client-side —
  // otherwise the rows and the count badges drift apart.
  const handleTaskUpdated = useCallback(() => {
    invalidateTaskLists(true);
    refreshStatusCounts();
    syncOpenTaskReaders();
  }, [invalidateTaskLists, refreshStatusCounts, syncOpenTaskReaders]);

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

  const statusTabs = (
    <Tabs
      className="tw:w-fit"
      selectedKey={status}
      onSelectionChange={(key) => handleStatusChange(key as TaskStatusFilter)}>
      <Tabs.List size="sm" type="button-border">
        {STATUS_FILTERS.map(({ id, labelKey }) => (
          <Tabs.Item badge={statusCounts[id]} id={id} key={id}>
            {t(labelKey)}
          </Tabs.Item>
        ))}
      </Tabs.List>
    </Tabs>
  );

  // A search or filter that matches nothing must not read as an empty queue.
  const isNarrowed = Boolean(searchQuery) || isClientNarrowed;
  const showEmptyState = hasNothingToShow(error, visibleTasks, {
    isLoading,
    isLoadingMore,
    hasMore,
    canLoadMore,
    tasks,
  });

  const handleRetry = useCallback(() => {
    refetch();
    refreshStatusCounts();
  }, [refetch, refreshStatusCounts]);

  const emptyState = showEmptyState ? (
    <TasksEmptyState
      error={error}
      isNarrowed={isNarrowed}
      scannedCount={hasMore ? tasks.length : undefined}
      status={status}
      userFirstName={userFirstName}
      onClearFilters={handleClearFilters}
      onLoadMore={handleScanFurther}
      onRetry={handleRetry}
    />
  ) : undefined;

  return (
    <Box
      className={classNames(
        'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
        className
      )}
      data-testid="inbox-tasks-tab"
      direction="col">
      <TasksTabBody
        emptyState={emptyState}
        groups={taskGroups}
        handleCommentsChanged={handleCommentsChanged}
        handleResolved={handleResolved}
        handleTaskUpdated={handleTaskUpdated}
        isLoadFailed={isWholeTabLoadFailed(error, tasks, isNarrowed)}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        scrollRef={scrollRef}
        selectedTaskId={selectedTaskId}
        sentinelRef={sentinelRef}
        setSelectedTaskId={setSelectedTaskId}
        statusUserIds={currentUserIds}
        tasks={visibleTasks}
        toolbar={
          <InboxTaskListToolbar
            grouping={grouping}
            inline={Boolean(onOpenTask)}
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
        onOpenTask={onOpenTask}
      />
    </Box>
  );
};

export default TasksTab;
