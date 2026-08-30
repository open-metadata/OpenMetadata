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
  Alert,
  Box,
  Button,
  Card,
  EmptyPlaceholder,
  Select,
  Skeleton,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Metric } from '../../../generated/entity/data/metric';
import { User } from '../../../generated/entity/teams/user';
import { FeedCounts } from '../../../interface/feed.interface';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import {
  MetricActivitySelection,
  MetricActivityTabKey,
  MetricTaskStatusFilter,
} from './MetricActivity.types';
import MetricActivityDetail from './MetricActivityDetail';
import MetricActivityItem from './MetricActivityItem';
import MetricCommentComposer from './MetricCommentComposer';
import MetricTaskCreateDialog from './MetricTaskCreateDialog';
import MetricTaskItem from './MetricTaskItem';
import { useMetricActivity } from './useMetricActivity';
import { useMetricTaskResolutionPermission } from './useMetricTaskResolutionPermission';

export interface MetricActivityTabProps {
  canCreateThread?: boolean;
  canCreateTasks?: boolean;
  currentUser?: Pick<User, 'id' | 'name'>;
  feedCount?: FeedCounts;
  metric: Metric;
  metricPermissions?: Partial<OperationPermission>;
  onFeedUpdate?: () => void;
  onUpdateEntityDetails?: () => void;
  onUpdateFeedCount?: (counts: FeedCounts) => void;
}

const MetricActivityTab = ({
  canCreateThread = true,
  canCreateTasks = true,
  currentUser,
  feedCount,
  metric,
  metricPermissions = {},
  onFeedUpdate,
  onUpdateEntityDetails,
  onUpdateFeedCount,
}: MetricActivityTabProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const metricFqn = metric.fullyQualifiedName ?? '';
  const [tab, setTab] = useState<MetricActivityTabKey>('all');
  const [taskStatus, setTaskStatus] = useState<MetricTaskStatusFilter>('open');
  const [selection, setSelection] = useState<MetricActivitySelection>();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const selectedTask = selection?.kind === 'task' ? selection.value : undefined;
  const taskResolutionPermission = useMetricTaskResolutionPermission(
    selectedTask,
    metricPermissions
  );
  const state = useMetricActivity({
    currentUserId: currentUser?.id,
    metricFqn: metric.fullyQualifiedName ?? '',
    onUpdateFeedCount,
    status: taskStatus,
    tab,
  });
  const counts = state.counts ?? feedCount;

  const handleReviewApproval = useCallback(() => {
    if (!metricFqn) {
      return;
    }
    navigate(
      getEntityDetailsPath(EntityType.METRIC, metricFqn, EntityTabs.APPROVAL),
      { replace: true }
    );
  }, [metricFqn, navigate]);

  const afterMutation = async (request: Promise<unknown>) => {
    const result = await request;
    onFeedUpdate?.();

    return result;
  };

  const isLoading =
    tab === 'tasks' ? state.isTasksLoading : state.isActivityLoading;
  const error = tab === 'tasks' ? state.tasksError : state.activityError;
  const listLabel =
    tab === 'tasks' ? t('label.task-plural') : t('label.activity');

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4 tw:px-4 tw:py-6 tw:md:px-8"
      data-testid="metric-activity-tab">
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          setTab(String(key) as MetricActivityTabKey);
          setSelection(undefined);
        }}>
        <Tabs.List
          aria-label={t('label.activity')}
          size="sm"
          type="button-border">
          <Tabs.Item badge={counts?.conversationCount ?? 0} id="all">
            {t('label.all-activity')}
          </Tabs.Item>
          <Tabs.Item badge={counts?.openTaskCount ?? 0} id="tasks">
            {t('label.task-plural')}
          </Tabs.Item>
          <Tabs.Item badge={counts?.mentionCount ?? 0} id="mentions">
            {t('label.mention-plural')}
          </Tabs.Item>
        </Tabs.List>
      </Tabs>

      {state.mutationError && (
        <Alert
          data-testid="metric-activity-mutation-error"
          title={t('server.api-error')}
          variant="error"
        />
      )}

      {tab !== 'tasks' && canCreateThread && (
        <Card data-testid="metric-activity-new-comment">
          <Card.Content>
            <MetricCommentComposer
              isLoading={state.isCommenting}
              onSubmit={(message) =>
                afterMutation(state.createComment(undefined, message))
              }
            />
          </Card.Content>
        </Card>
      )}

      {tab === 'tasks' && (
        <Box align="center" gap={3} justify="between">
          <Typography size="text-sm" weight="semibold">
            {t('label.task-plural')}
          </Typography>
          <Box align="center" gap={2}>
            <Select
              aria-label={t('label.status')}
              className="tw:w-44"
              value={taskStatus}
              onChange={(value) => {
                setTaskStatus(value as MetricTaskStatusFilter);
                setSelection(undefined);
              }}>
              <Select.Item id="open" label={t('label.open')} />
              <Select.Item id="closed" label={t('label.closed')} />
            </Select>
            {canCreateTasks && (
              <Button
                color="primary"
                data-testid="metric-task-create"
                iconLeading={Plus}
                size="sm"
                onPress={() => setIsCreateTaskOpen(true)}>
                {t('label.create-entity', { entity: t('label.task') })}
              </Button>
            )}
          </Box>
        </Box>
      )}

      <Box className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1fr)_400px]">
        <section
          aria-busy={isLoading}
          aria-label={listLabel}
          className="tw:relative tw:min-h-80">
          <ul
            aria-label={listLabel}
            className="tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
            {isLoading ? (
              Array.from({ length: 5 }, (_, index) => (
                <li key={index}>
                  <Skeleton height={112} variant="rounded" />
                </li>
              ))
            ) : error ? (
              <li>
                <EmptyPlaceholder
                  actions={[
                    {
                      key: 'retry',
                      label: t('label.try-again'),
                      onClick: () =>
                        tab === 'tasks'
                          ? state.refetchTasks()
                          : state.refetchActivity(),
                    },
                  ]}
                  description={t('server.entity-feed-fetch-error')}
                  title={t('label.error')}
                />
              </li>
            ) : tab === 'tasks' ? (
              state.tasks.length === 0 ? (
                <li>
                  <EmptyPlaceholder
                    description={
                      taskStatus === 'open'
                        ? t('message.no-open-tasks-description')
                        : t('message.no-closed-tasks-description')
                    }
                    title={
                      taskStatus === 'open'
                        ? t('message.no-open-tasks-title')
                        : t('message.no-closed-tasks-title')
                    }
                  />
                </li>
              ) : (
                state.tasks.map((task) => (
                  <li key={task.id}>
                    <MetricTaskItem
                      isActive={
                        selection?.kind === 'task' &&
                        selection.value.id === task.id
                      }
                      task={task}
                      onReviewApproval={handleReviewApproval}
                      onSelect={() =>
                        setSelection({ kind: 'task', value: task })
                      }
                    />
                  </li>
                ))
              )
            ) : state.activity.length === 0 ? (
              <li>
                <EmptyPlaceholder
                  description={t('message.no-activity-feed-description')}
                  title={t('message.no-activity-feed-title')}
                />
              </li>
            ) : (
              state.activity.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <MetricActivityItem
                    isActive={
                      selection?.kind === item.kind &&
                      selection.value.id === item.value.id
                    }
                    item={item}
                    onSelect={() =>
                      setSelection(
                        item.kind === 'activity'
                          ? { kind: 'activity', value: item.value }
                          : { kind: 'thread', value: item.value }
                      )
                    }
                  />
                </li>
              ))
            )}
            {((tab === 'tasks' && state.hasMoreTasks) ||
              (tab !== 'tasks' && state.hasMoreActivity)) && (
              <li>
                <Box justify="center">
                  <Button
                    color="secondary"
                    data-testid="metric-activity-load-more"
                    isLoading={
                      tab === 'tasks'
                        ? state.isLoadingMoreTasks
                        : state.isLoadingMoreActivity
                    }
                    size="sm"
                    onPress={
                      tab === 'tasks'
                        ? state.loadMoreTasks
                        : state.loadMoreActivity
                    }>
                    {t('label.load-more')}
                  </Button>
                </Box>
              </li>
            )}
          </ul>
        </section>

        {selection && (
          <MetricActivityDetail
            canComment={canCreateThread}
            canResolveTasks={taskResolutionPermission.canResolve}
            isCommenting={state.isCommenting}
            isResolvePermissionLoading={taskResolutionPermission.isLoading}
            isResolvingTask={state.isResolvingTask}
            resolvePermissionError={taskResolutionPermission.error}
            selection={selection}
            onClose={() => setSelection(undefined)}
            onCreateComment={(about, message) =>
              afterMutation(state.createComment(about, message))
            }
            onReply={(threadId, message) =>
              afterMutation(state.replyToThread(threadId, message))
            }
            onResolveTask={(taskId, transitionId, comment) =>
              afterMutation(
                state
                  .resolveTask(taskId, transitionId, comment)
                  .then((result) => {
                    onUpdateEntityDetails?.();

                    return result;
                  })
              )
            }
            onRetryResolvePermission={() => taskResolutionPermission.refetch()}
            onTaskComment={(taskId, message) =>
              afterMutation(state.addTaskComment(taskId, message))
            }
          />
        )}
      </Box>
      <MetricTaskCreateDialog
        error={state.createTaskError}
        isLoading={state.isCreatingTask}
        metric={metric}
        open={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreate={(task) => afterMutation(state.createTask(task))}
      />
      <span aria-live="polite" className="tw:sr-only">
        {state.isCommenting ||
        state.isResolvingTask ||
        taskResolutionPermission.isLoading
          ? t('label.loading')
          : ''}
      </span>
    </Box>
  );
};

export default MetricActivityTab;
