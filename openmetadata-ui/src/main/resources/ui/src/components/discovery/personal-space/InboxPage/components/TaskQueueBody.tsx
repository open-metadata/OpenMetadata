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
import {
  CheckCircle,
  FilterFunnel01,
  Inbox01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../../components/common/Loader/Loader';
import { Task } from '../../../../../rest/tasksAPI';
import { getTaskTypeBadge } from '../taskDetail.utils';
import { TaskTypeGroup } from '../taskList.utils';
import { useIsScrolled } from '../useIsScrolled';
import { TaskStatusFilter } from '../useTaskQueue';
import InboxTaskListItem from './InboxTaskListItem';
import InboxTaskListSkeleton from './InboxTaskListSkeleton';
import TaskDetailPanel from './TaskDetailPanel';
import TaskDetailSkeleton from './TaskDetailSkeleton';
import { TASK_TYPE_DOT_CLASS } from './TaskTypeIcon';

export interface TaskQueueEmptyStateProps {
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
export const TaskQueueEmptyState = ({
  status,
  isNarrowed,
  scannedCount,
  onClearFilters,
  onLoadMore,
}: TaskQueueEmptyStateProps) => {
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

export interface TaskQueueBodyProps {
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
const TaskQueueBody: React.FC<TaskQueueBodyProps> = ({
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

export default TaskQueueBody;
