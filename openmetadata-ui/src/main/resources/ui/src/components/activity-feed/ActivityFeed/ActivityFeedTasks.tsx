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
  FilterSelect,
  Input,
  SearchInputIcon,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  FilterLines,
  LayersTwo01,
} from '@openmetadata/ui-core-components/icons';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ActivityToolbarMenu from '../../discovery/personal-space/InboxPage/components/ActivityToolbarMenu';
import {
  InboxTaskGrouping,
  useTaskTypeOptions,
} from '../../discovery/personal-space/InboxPage/components/InboxTaskListToolbar';
import TaskQueueBody, {
  TaskQueueEmptyState,
} from '../../discovery/personal-space/InboxPage/components/TaskQueueBody';
import {
  STATUS_FILTERS,
  TaskListScope,
  TaskStatusFilter,
  useTaskQueue,
} from '../../discovery/personal-space/InboxPage/useTaskQueue';

const GROUPING_LABEL_KEY: Record<InboxTaskGrouping, string> = {
  type: 'label.type',
  none: 'label.none',
};

export interface ActivityFeedTasksProps {
  scope: TaskListScope;
  // The host's control for the bar's left side (the Activity / Tasks switch).
  leading?: ReactNode;
  onTaskChange?: () => void;
}

/**
 * One entity's (or user's) task queue: the status, type and grouping in the
 * bar beside the host's control, search over the list, the selected task's
 * detail beside it.
 */
const ActivityFeedTasks: React.FC<ActivityFeedTasksProps> = ({
  scope,
  leading,
  onTaskChange,
}) => {
  const { t } = useTranslation();
  const queue = useTaskQueue({ scope, onTaskChange });
  const typeOptions = useTaskTypeOptions(queue.tasks, queue.typeFilter);

  const statusOptions = useMemo(
    () =>
      STATUS_FILTERS.map(({ id, labelKey }) => ({
        value: id,
        label: t(labelKey),
        count: String(queue.statusCounts[id]),
      })),
    [queue.statusCounts, t]
  );
  const groupingOptions = useMemo(
    () =>
      (Object.keys(GROUPING_LABEL_KEY) as InboxTaskGrouping[]).map((value) => ({
        value,
        label: t(GROUPING_LABEL_KEY[value]),
      })),
    [t]
  );

  return (
    <Box className="tw:flex tw:h-full tw:min-h-0 tw:flex-col" direction="col">
      <Box
        align="center"
        className="tw:shrink-0 tw:flex-wrap tw:justify-between tw:border-b tw:border-secondary tw:py-3"
        data-testid="activity-feed-tasks-toolbar"
        gap={2}>
        {leading}
        <Box align="center" gap={2}>
          <ActivityToolbarMenu
            data-testid="activity-feed-task-status"
            options={statusOptions}
            title={t('label.status')}
            triggerIcon={CheckCircle}
            triggerLabel={t('label.value-with-count', {
              value: t(
                STATUS_FILTERS.find(({ id }) => id === queue.status)
                  ?.labelKey ?? 'label.open'
              ),
              count: queue.statusCounts[queue.status],
            })}
            value={queue.status}
            onChange={(value) =>
              queue.handleStatusChange(value as TaskStatusFilter)
            }
          />
          <FilterSelect
            bordered
            data-testid="activity-feed-task-type"
            label={t('label.type')}
            options={typeOptions}
            selectedValues={queue.typeFilter}
            selectionMode="multiple"
            triggerIcon={FilterLines}
            triggerVariant="button"
            onChange={queue.setTypeFilter}
          />
          <ActivityToolbarMenu
            data-testid="activity-feed-task-group"
            options={groupingOptions}
            title={t('label.group-by')}
            triggerIcon={LayersTwo01}
            triggerLabel={t('label.group-with-value', {
              value: t(GROUPING_LABEL_KEY[queue.grouping]),
            })}
            value={queue.grouping}
            onChange={(value) => queue.setGrouping(value as InboxTaskGrouping)}
          />
        </Box>
      </Box>
      <TaskQueueBody
        emptyState={
          queue.showEmptyState ? (
            <TaskQueueEmptyState
              isNarrowed={queue.isNarrowed}
              isPersonal={false}
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
          <Box className="tw:px-4 tw:pt-4 tw:pb-3">
            <Input
              className="tw:w-full"
              icon={SearchInputIcon}
              inputDataTestId="activity-feed-task-search"
              placeholder={t('label.search-entity', {
                entity: t('label.task-plural'),
              })}
              size="sm"
              value={queue.search}
              onChange={queue.handleSearchChange}
            />
          </Box>
        }
      />
    </Box>
  );
};

export default ActivityFeedTasks;
