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
import { TOPIC_FILTERED_BODY_CLASSES } from '../Common/TopicWidget/topicRowStyles';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import MyTaskRow from './MyTaskRow';
import MyTasksSelectionBar from './MyTasksSelectionBar';
import { MY_TASKS_TONE } from './MyTasksWidget.constants';
import { BulkDecision, useBulkResolveTasks } from './useBulkResolveTasks';
import { useMyTasksHeadline } from './useMyTasksHeadline';
import { useMyTaskPath, useMyTasksPath } from './useMyTasksPath';

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
  const getTaskPath = useMyTaskPath();
  const [bucket, setBucket] = useState<MyTaskBucket>(MyTaskBucket.ALL);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set()
  );
  const { tasks, total, counts, isLoading, isFetching, isError, refetch } =
    useMyTasks();
  const { resolveTasks, isResolving } = useBulkResolveTasks();
  const { summary, status } = useMyTasksHeadline(
    total,
    counts[MyTaskBucket.INCIDENTS]
  );

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

  const handleBucketChange = (next: string) => {
    setBucket(next as MyTaskBucket);
    setSelectedIds(new Set());
  };

  const handleResolve = async (decision: BulkDecision) => {
    try {
      const { unresolvedIds } = await resolveTasks({
        decision,
        tasks: selectedTasks,
      });
      // The hook has already said what failed; those stay selected for a retry.
      setSelectedIds(new Set(unresolvedIds));
    } catch {
      // A request that failed outright leaves the whole selection for a retry.
    }
  };

  // The chips and the incident headline are counted over the loaded page, so
  // past it the footer says how much of the total that page is.
  // ADR:2026-10-16-landing-task-and-pipeline-cards-read-one-page
  const isPartialPage = tasks.length < total;

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
      bodyClassName={TOPIC_FILTERED_BODY_CLASSES}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={
        isPartialPage ? (
          <span data-testid="my-tasks-page-limit">
            {t('label.loaded-x-of-y-entity', {
              entity: t('label.task-plural'),
              loaded: tasks.length,
              total,
            })}
          </span>
        ) : undefined
      }
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

          <ul
            className="tw:mt-1 tw:flex tw:flex-col tw:gap-1 tw:py-1"
            data-testid="my-task-rows">
            {visibleTasks.map((task) => (
              <MyTaskRow
                href={getTaskPath(task)}
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
