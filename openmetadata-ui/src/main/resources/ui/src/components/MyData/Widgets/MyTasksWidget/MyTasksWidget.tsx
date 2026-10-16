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

import { Checkbox, Typography } from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMyTasks } from '../../../../hooks/useMyTasks';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import {
  filterMyTasks,
  getBulkTaskAction,
  MyTaskBucket,
} from '../../../../utils/myTaskBuckets';
import { getTaskTitle } from '../../../discovery/personal-space/InboxPage/taskTitle.utils';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import MyTaskRow from './MyTaskRow';
import MyTasksSelectionBar from './MyTasksSelectionBar';
import { MY_TASKS_TONE } from './MyTasksWidget.constants';
import { getMyTasksHeadline } from './MyTasksWidget.utils';
import { BulkDecision, useBulkResolveTasks } from './useBulkResolveTasks';
import { useMyTasksPath } from './useMyTasksPath';

export type MyTasksWidgetProps = WidgetCommonProps;

/** The viewer's open tasks, the incidents among them first in the summary. */
const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tasksPath = useMyTasksPath();
  const [bucket, setBucket] = useState<MyTaskBucket>(MyTaskBucket.ALL);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const { tasks, total, counts, isLoading, isFetching, isError, refetch } =
    useMyTasks();
  const { resolveTasks, isResolving } = useBulkResolveTasks();

  const visibleTasks = useMemo(
    () => filterMyTasks(tasks, bucket),
    [tasks, bucket]
  );
  const titles = useMemo(
    () => new Map(tasks.map((task) => [task.id, getTaskTitle(task, t)])),
    [tasks, t]
  );
  // Selection only ever covers rows on screen: a task resolved elsewhere, or
  // hidden by a chip, cannot be acted on from here.
  const selectedTasks = useMemo(
    () => visibleTasks.filter((task) => selectedIds.has(task.id)),
    [visibleTasks, selectedIds]
  );
  const isAllSelected =
    visibleTasks.length > 0 && selectedTasks.length === visibleTasks.length;

  const handleSelectedChange = useCallback(
    (taskId: string, isSelected: boolean) =>
      setSelectedIds((previous) => {
        const next = new Set(previous);
        if (isSelected) {
          next.add(taskId);
        } else {
          next.delete(taskId);
        }

        return next;
      }),
    []
  );

  const handleSelectAll = (isSelected: boolean) =>
    setSelectedIds(
      isSelected ? new Set(visibleTasks.map((task) => task.id)) : new Set()
    );

  const handleBucketChange = (next: string) => {
    setBucket(next as MyTaskBucket);
    setSelectedIds(new Set());
  };

  const handleResolve = async (decision: BulkDecision) => {
    try {
      await resolveTasks({ decision, tasks: selectedTasks });
      setSelectedIds(new Set());
    } catch {
      // The hook has already said what failed; the selection stays for a retry.
    }
  };

  const { summary, status } = getMyTasksHeadline(
    t,
    total,
    counts[MyTaskBucket.INCIDENTS]
  );

  // An empty list is good news, not a setup gap — nothing to configure.
  const emptyState: TopicEmptyStateConfig | undefined =
    total === 0
      ? {
          description: t('message.my-tasks-empty-description'),
          footer: {
            action: {
              label: t('label.open-task-plural'),
              onPress: () => navigate(tasksPath),
            },
            meta: t('label.count-open', { count: 0 }),
          },
          icon: MY_TASKS_TONE.icon,
          summary: t('message.no-open-tasks-assigned-to-you'),
          title: t('message.you-are-all-caught-up'),
        }
      : undefined;

  return (
    <TopicCard
      action={{
        label: t('label.open-task-plural'),
        onPress: () => navigate(tasksPath),
      }}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      status={status}
      summary={summary}
      title={t('label.my-task-plural')}
      tone={MY_TASKS_TONE}
      topicKey={TopicKey.MY_TASKS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!emptyState && (
        <>
          <TopicFilterChips
            chips={[
              {
                count: counts[MyTaskBucket.ALL],
                id: MyTaskBucket.ALL,
                label: t('label.all'),
                tone: 'brand',
              },
              {
                count: counts[MyTaskBucket.INCIDENTS],
                id: MyTaskBucket.INCIDENTS,
                label: t('label.incident-plural'),
                tone: 'error',
              },
              {
                count: counts[MyTaskBucket.ACCESS],
                id: MyTaskBucket.ACCESS,
                label: t('label.access'),
                tone: 'brand',
              },
              {
                count: counts[MyTaskBucket.APPROVALS],
                id: MyTaskBucket.APPROVALS,
                label: t('label.approval-plural'),
                tone: 'muted',
              },
            ]}
            label={t('label.my-task-plural')}
            testIdPrefix="my-tasks"
            value={bucket}
            onChange={handleBucketChange}
          />

          <div className="tw:mt-3 tw:flex tw:items-center tw:gap-3 tw:border-y tw:border-secondary tw:bg-secondary tw:px-2 tw:py-2">
            <Checkbox
              aria-label={t('label.select-all')}
              data-testid="my-tasks-select-all"
              isDisabled={visibleTasks.length === 0}
              isIndeterminate={selectedTasks.length > 0 && !isAllSelected}
              isSelected={isAllSelected}
              onChange={handleSelectAll}
            />
            <Typography
              className="tw:text-text-tertiary!"
              data-testid="my-tasks-showing"
              size="text-xs">
              {t('label.count-of-total-loaded', {
                count: visibleTasks.length,
                total: bucket === MyTaskBucket.ALL ? total : counts[bucket],
              })}
            </Typography>
          </div>

          <ul
            className="tw:flex tw:flex-col tw:gap-1 tw:py-1"
            data-testid="my-task-rows">
            {visibleTasks.map((task) => (
              <MyTaskRow
                isSelected={selectedIds.has(task.id)}
                key={task.id}
                task={task}
                title={titles.get(task.id) ?? ''}
                onSelectedChange={handleSelectedChange}
              />
            ))}
          </ul>

          {selectedTasks.length > 0 && (
            <MyTasksSelectionBar
              action={getBulkTaskAction(selectedTasks)}
              isResolving={isResolving}
              selectedCount={selectedTasks.length}
              onClear={() => setSelectedIds(new Set())}
              onOpenTasks={() => navigate(tasksPath)}
              onResolve={handleResolve}
            />
          )}
        </>
      )}
    </TopicCard>
  );
};

export default MyTasksWidget;
