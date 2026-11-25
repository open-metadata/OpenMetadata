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
  Button,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  FilterFunnel01,
  Inbox01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../../components/common/Loader/Loader';
import { ClientErrors } from '../../../../../enums/Axios.enum';
import { Task } from '../../../../../rest/tasksAPI';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import PermissionPlaceholder from '../../../../common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import { getTaskTypeBadge } from '../taskDetail.utils';
import { TaskTypeGroup } from '../taskList.utils';
import { getTaskStatusLabel } from '../taskResolution.utils';
import { TaskStatusFilter } from '../taskScope.utils';
import { useIsScrolled } from '../useIsScrolled';
import InboxTaskListItem from './InboxTaskListItem';
import InboxTaskListSkeleton from './InboxTaskListSkeleton';
import TaskDetailPanel from './TaskDetailPanel';
import TaskDetailSkeleton from './TaskDetailSkeleton';
import { TASK_TYPE_DOT_CLASS } from './TaskTypeIcon';

export interface TaskQueueEmptyStateProps {
  // The list failed to load; shown in place of any empty state.
  error?: unknown;
  status: TaskStatusFilter;
  isNarrowed: boolean;
  // Set when a narrowed scan stopped at its cap with pages still unread, so
  // "no match" covers only the tasks scanned so far.
  scannedCount?: number;
  onClearFilters: () => void;
  onLoadMore: () => void;
  // The descriptions speak to the viewer about their own queue; an entity's
  // queue shows the title alone.
  isPersonal?: boolean;
  // Set when the list is another user's, so the copy names them, not "you".
  userFirstName?: string;
  onRetry?: () => void;
}

// Another user's tab names them and keeps the status: their Closed tab must not
// say they have no tasks at all while Open has some. The viewer's own copy
// ("assigned to you") would misread here.
const USER_EMPTY_STATE: Record<
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

// A failed load: a permission gap says so, anything else offers a retry.
const TaskQueueLoadError = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) => {
  const { t } = useTranslation();

  return (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN ? (
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
};

const UserTasksEmptyState = ({
  status,
  userFirstName,
}: {
  status: TaskStatusFilter;
  userFirstName: string;
}) => {
  const { t } = useTranslation();
  const { titleKey, descriptionKey, testId } = USER_EMPTY_STATE[status];

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

// A dedicated empty state per status: All = generic "nothing to do", Open =
// "no open tasks", Closed = archival. A search or filter that matches nothing
// says so instead, with a way back to the whole queue.
export const TaskQueueEmptyState = ({
  error,
  status,
  isNarrowed,
  scannedCount,
  onClearFilters,
  onLoadMore,
  isPersonal = true,
  userFirstName,
  onRetry,
}: TaskQueueEmptyStateProps) => {
  const { t } = useTranslation();

  if (error) {
    return <TaskQueueLoadError error={error} onRetry={onRetry} />;
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
        description={
          isPersonal ? t('message.tasks-empty-description') : undefined
        }
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-tasks-right-now')}
      />
    ),
    open: (
      <NoDataPlaceholder
        data-testid="inbox-tasks-open-empty"
        description={
          isPersonal ? t('message.tasks-open-empty-description') : undefined
        }
        icon={<CheckCircle className="tw:size-7 tw:text-utility-success-600" />}
        title={t('label.no-open-tasks-yet')}
      />
    ),
    closed: (
      <NoDataPlaceholder
        data-testid="inbox-tasks-closed-empty"
        description={
          isPersonal ? t('message.tasks-closed-empty-description') : undefined
        }
        icon={<Inbox01 className="tw:size-7" />}
        title={t('label.no-closed-tasks-yet')}
      />
    ),
  };

  if (isNarrowed) {
    return noMatch;
  }

  return userFirstName ? (
    <UserTasksEmptyState status={status} userFirstName={userFirstName} />
  ) : (
    <>{emptyStateByStatus[status]}</>
  );
};

export interface TaskQueueBodyProps {
  // Status, search and filter controls, heading the list column.
  toolbar: ReactNode;
  // Shown when no task matches: in place of the detail, or in the list while a
  // kept selection holds the detail pane.
  emptyState?: ReactNode;
  // The empty state is a search or filter matching nothing, so it belongs
  // beside the controls that cause it, in the list.
  isNoMatch?: boolean;
  // A failed load with nothing listed leaves nothing to filter, so the
  // placeholder takes the whole body.
  isLoadFailed?: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  tasks: Task[];
  // Set when grouped by type; the list renders these instead of `tasks`.
  groups?: TaskTypeGroup[];
  // Pages are still unread, so a group's count is only a floor.
  isPartial?: boolean;
  // The last page failed. Neither the read-ahead nor a list too short to
  // scroll would ask again, so the list offers its own retry.
  isLoadMoreError?: boolean;
  onRetryLoadMore: () => void;
  selectedTaskId?: string;
  scrollRef: RefObject<HTMLDivElement>;
  sentinelRef: RefObject<HTMLDivElement>;
  setSelectedTaskId: (id: string) => void;
  // Set for a list-only layout: no detail pane, and a row opens its task here.
  onOpenTask?: (taskId: string) => void;
  // Whose ids read an open task's status on its row (list-only layout).
  statusUserIds?: ReadonlySet<string>;
  handleCommentsChanged: (updated: Task) => void;
  handleResolved: (resolved: Task) => void;
  handleTaskUpdated: () => void;
  handleTaskLoaded: (loaded: Task) => void;
}

type TaskQueueDetailPaneProps = Pick<
  TaskQueueBodyProps,
  | 'emptyState'
  | 'isLoading'
  | 'tasks'
  | 'selectedTaskId'
  | 'handleCommentsChanged'
  | 'handleResolved'
  | 'handleTaskUpdated'
  | 'handleTaskLoaded'
>;

// The selected task beside the list, or why there is none.
const TaskQueueDetailPane = ({
  emptyState,
  isLoading,
  tasks,
  selectedTaskId,
  handleCommentsChanged,
  handleResolved,
  handleTaskUpdated,
  handleTaskLoaded,
}: TaskQueueDetailPaneProps) => {
  const { t } = useTranslation();

  const detailContent = selectedTaskId ? (
    <TaskDetailPanel
      fallbackTask={tasks.find((task) => task.id === selectedTaskId)}
      key={selectedTaskId}
      taskId={selectedTaskId}
      onCommentsChanged={handleCommentsChanged}
      onLoaded={handleTaskLoaded}
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

  // A kept selection (e.g. a deep-linked task held past the loaded page) owns
  // the detail pane, so the empty placeholder only shows here when no task is
  // selected — the list column carries it otherwise.
  let detailPane: ReactNode;
  if (isLoading) {
    detailPane = <TaskDetailSkeleton />;
  } else if (selectedTaskId) {
    detailPane = detailContent;
  } else {
    detailPane = emptyState;
  }

  return (
    <Box className="tw:relative tw:min-h-0 tw:w-full" direction="col">
      {detailPane}
    </Box>
  );
};

// Without a free detail pane — none in the list-only layout, or a kept
// selection holding it — the list is where "nothing here" shows, so its
// "Clear all", "Load more" and retry stay reachable. A no-match shows there
// too, under the search and filters it answers.
const getListEmptyState = (
  emptyState: ReactNode,
  onOpenTask: TaskQueueBodyProps['onOpenTask'],
  selectedTaskId: TaskQueueBodyProps['selectedTaskId'],
  isNoMatch: boolean
): ReactNode =>
  onOpenTask || selectedTaskId || isNoMatch ? emptyState : undefined;

// A failed later page, with a way to ask for it again.
const LoadMoreRetry = ({
  isLoadMoreError,
  isLoadingMore,
  onRetry,
}: {
  isLoadMoreError?: boolean;
  isLoadingMore: boolean;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();

  return isLoadMoreError && !isLoadingMore ? (
    <Box
      align="center"
      className="tw:justify-center tw:py-4"
      data-testid="inbox-tasks-load-more-error"
      gap={3}>
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('server.entity-fetch-error', { entity: t('label.task-plural') })}
      </Typography>
      <Button color="secondary" size="xs" onClick={onRetry}>
        {t('label.retry')}
      </Button>
    </Box>
  ) : null;
};

// The two panes: the list column (its controls over the grouped rows) and the
// selected task's detail, each scrolling on its own.
const TaskQueueBody: React.FC<TaskQueueBodyProps> = ({
  toolbar,
  emptyState,
  isNoMatch = false,
  isLoadFailed = false,
  isLoading,
  isLoadingMore,
  tasks,
  groups,
  isPartial = false,
  isLoadMoreError,
  onRetryLoadMore,
  selectedTaskId,
  scrollRef,
  sentinelRef,
  setSelectedTaskId,
  onOpenTask,
  statusUserIds,
  handleCommentsChanged,
  handleResolved,
  handleTaskUpdated,
  handleTaskLoaded,
}) => {
  const { t } = useTranslation();
  const { isScrolled: isListScrolled, onScroll: onListScroll } =
    useIsScrolled();

  const renderRow = (task: Task) =>
    onOpenTask ? (
      <InboxTaskListItem
        key={task.id}
        statusBadge={
          statusUserIds && getTaskStatusLabel(task, statusUserIds, t)
        }
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
  // not by type, so a grouped list reads on to its scan cap (see useTaskQueue).
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
            {isPartial ? `${group.count}+` : group.count}
          </Typography>
        </Box>
        {group.items.map(renderRow)}
      </Box>
    );
  });

  const listColumn = (
    <Box className="tw:min-h-0 tw:min-w-0 tw:flex-1" direction="col">
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
            {getListEmptyState(
              emptyState,
              onOpenTask,
              selectedTaskId,
              isNoMatch
            ) ||
              (groupedList ?? tasks.map(renderRow))}
          </div>
        )}

        <div ref={sentinelRef} />
        {isLoadingMore && (
          <div className="tw:flex tw:justify-center tw:py-4">
            <Loader />
          </div>
        )}
        <LoadMoreRetry
          isLoadMoreError={isLoadMoreError}
          isLoadingMore={isLoadingMore}
          onRetry={onRetryLoadMore}
        />
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

  return (
    // `minmax(0, …)`: a bare `fr` track never shrinks below its content, so one
    // long unbreakable title would widen the list and push the detail off-screen.
    <Box className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* The rule sits inside the list's column, so it takes none of the
          detail's width. */}
      <Box className="tw:min-h-0">
        {listColumn}
        <Divider orientation="vertical" />
      </Box>

      <TaskQueueDetailPane
        emptyState={isNoMatch ? undefined : emptyState}
        handleCommentsChanged={handleCommentsChanged}
        handleResolved={handleResolved}
        handleTaskLoaded={handleTaskLoaded}
        handleTaskUpdated={handleTaskUpdated}
        isLoading={isLoading}
        selectedTaskId={selectedTaskId}
        tasks={tasks}
      />
    </Box>
  );
};

export default TaskQueueBody;
