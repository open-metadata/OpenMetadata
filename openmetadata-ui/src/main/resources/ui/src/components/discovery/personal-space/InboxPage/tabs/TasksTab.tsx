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
import React from 'react';
import { useTranslation } from 'react-i18next';
import InboxTaskListToolbar from '../components/InboxTaskListToolbar';
import TaskQueueBody, {
  TaskQueueEmptyState,
} from '../components/TaskQueueBody';
import {
  STATUS_FILTERS,
  STATUS_OPTIONS_BY_TAB,
  TaskStatusFilter,
  useTaskQueue,
} from '../useTaskQueue';

export interface TasksTabProps {
  className?: string;
  onCountChange?: (count: number) => void;
}

/**
 * The Inbox's Triage: the viewer's visible tasks, with All / Open / Closed,
 * search and the Status / Type filters heading the list column.
 */
const TasksTab: React.FC<TasksTabProps> = ({ className, onCountChange }) => {
  const { t } = useTranslation();
  const queue = useTaskQueue({ onCountChange });

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
              isNarrowed={queue.isNarrowed}
              scannedCount={queue.hasMore ? queue.tasks.length : undefined}
              status={queue.status}
              onClearFilters={queue.handleClearFilters}
              onLoadMore={queue.handleScanFurther}
            />
          ) : undefined
        }
        groups={queue.taskGroups}
        handleCommentsChanged={queue.handleCommentsChanged}
        handleResolved={queue.handleResolved}
        handleTaskUpdated={queue.handleTaskUpdated}
        isLoading={queue.isLoading}
        isLoadingMore={queue.isLoadingMore}
        scrollRef={queue.scrollRef}
        selectedTaskId={queue.selectedTaskId}
        sentinelRef={queue.sentinelRef}
        setSelectedTaskId={queue.setSelectedTaskId}
        tasks={queue.visibleTasks}
        toolbar={
          <InboxTaskListToolbar
            grouping={queue.grouping}
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
      />
    </Box>
  );
};

export default TasksTab;
