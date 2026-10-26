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
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { useViewedUserFirstName } from '../../../../../hooks/discovery/personal-space/useViewedUserFirstName';
import InboxTaskListToolbar from '../components/InboxTaskListToolbar';
import TaskQueueBody, {
  TaskQueueEmptyState,
} from '../components/TaskQueueBody';
import {
  STATUS_FILTERS,
  TaskListScope,
  TaskStatusFilter,
  VISIBLE_TASKS,
} from '../taskScope.utils';
import { STATUS_OPTIONS_BY_TAB, useTaskQueue } from '../useTaskQueue';

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

/**
 * A task queue with All / Open / Closed, search and the Status / Type filters
 * heading the list column: the Inbox's Triage, an entity's tasks, or a user's.
 */
const TasksTab: React.FC<TasksTabProps> = ({
  aboutEntity,
  user,
  onOpenTask,
  className,
  onCountChange,
}) => {
  const { t } = useTranslation();
  const scope = useMemo((): TaskListScope => {
    if (aboutEntity) {
      return { type: 'entity', aboutEntity };
    }

    return user ? { type: 'user', user } : VISIBLE_TASKS;
  }, [aboutEntity, user]);
  const queue = useTaskQueue({ scope, onCountChange });
  const userFirstName = useViewedUserFirstName(user);

  const statusTabs = (
    <Tabs
      className="tw:w-fit"
      selectedKey={queue.status}
      onSelectionChange={(key) =>
        queue.handleStatusChange(key as TaskStatusFilter)
      }>
      <Tabs.List size="sm" type="button-border">
        {STATUS_FILTERS.map(({ id, labelKey }) => (
          <Tabs.Item badge={queue.statusCounts[id]} id={id} key={id}>
            {t(labelKey)}
          </Tabs.Item>
        ))}
      </Tabs.List>
    </Tabs>
  );

  return (
    <Box
      className={classNames(
        'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
        className
      )}
      data-testid="inbox-tasks-tab"
      direction="col">
      <TaskQueueBody
        emptyState={
          queue.showEmptyState ? (
            <TaskQueueEmptyState
              error={queue.error}
              isNarrowed={queue.isNarrowed}
              scannedCount={queue.hasMore ? queue.tasks.length : undefined}
              status={queue.status}
              userFirstName={userFirstName}
              onClearFilters={queue.handleClearFilters}
              onLoadMore={queue.handleScanFurther}
              onRetry={queue.handleRetry}
            />
          ) : undefined
        }
        groups={queue.taskGroups}
        handleCommentsChanged={queue.handleCommentsChanged}
        handleResolved={queue.handleResolved}
        handleTaskUpdated={queue.handleTaskUpdated}
        isLoadFailed={queue.isLoadFailed}
        isLoading={queue.isLoading}
        isLoadingMore={queue.isLoadingMore}
        scrollRef={queue.scrollRef}
        selectedTaskId={queue.selectedTaskId}
        sentinelRef={queue.sentinelRef}
        setSelectedTaskId={queue.setSelectedTaskId}
        statusUserIds={queue.currentUserIds}
        tasks={queue.visibleTasks}
        toolbar={
          <InboxTaskListToolbar
            grouping={queue.grouping}
            inline={Boolean(onOpenTask)}
            search={queue.search}
            statusFilter={queue.statusFilter}
            statusOptions={STATUS_OPTIONS_BY_TAB[queue.status]}
            statusTabs={statusTabs}
            tasks={queue.tasks}
            typeFilter={queue.typeFilter}
            onGroupingChange={queue.setGrouping}
            onSearchChange={queue.handleSearchChange}
            onStatusFilterChange={queue.setStatusFilter}
            onTypeFilterChange={queue.setTypeFilter}
          />
        }
        onOpenTask={onOpenTask}
      />
    </Box>
  );
};

export default TasksTab;
