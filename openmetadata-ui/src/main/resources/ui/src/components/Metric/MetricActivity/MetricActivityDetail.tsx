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
  Badge,
  Box,
  Button,
  Card,
  CloseButton,
  Divider,
  Skeleton,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaskStatus } from '../../../generated/entity/tasks/task';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { MetricActivitySelection } from './MetricActivity.types';
import {
  getMetricActivityEventLabel,
  getMetricActivityFieldLabel,
  getMetricTaskResolutionLabel,
  getMetricTaskStatusLabel,
  getMetricTaskTransitionLabel,
  getMetricTaskTypeLabel,
  getMetricWorkflowLabel,
} from './MetricActivity.utils';
import MetricCommentComposer from './MetricCommentComposer';

export interface MetricActivityDetailProps {
  canComment: boolean;
  canResolveTasks: boolean;
  isCommenting: boolean;
  isResolvePermissionLoading: boolean;
  isResolvingTask: boolean;
  resolvePermissionError?: unknown;
  selection: MetricActivitySelection;
  onClose: () => void;
  onCreateComment: (
    about: string | undefined,
    message: string
  ) => Promise<unknown>;
  onReply: (threadId: string, message: string) => Promise<unknown>;
  onRetryResolvePermission: () => void;
  onResolveTask: (
    taskId: string,
    transitionId?: string,
    comment?: string
  ) => Promise<unknown>;
  onTaskComment: (taskId: string, message: string) => Promise<unknown>;
}

const MetricActivityDetail = ({
  canComment,
  canResolveTasks,
  isCommenting,
  isResolvePermissionLoading,
  isResolvingTask,
  resolvePermissionError,
  selection,
  onClose,
  onCreateComment,
  onReply,
  onRetryResolvePermission,
  onResolveTask,
  onTaskComment,
}: MetricActivityDetailProps) => {
  const { t } = useTranslation();
  const [decisionNote, setDecisionNote] = useState('');

  if (selection.kind === 'activity') {
    const activity = selection.value;

    return (
      <Card className="tw:sticky tw:top-4" data-testid="metric-activity-detail">
        <Card.Header
          extra={
            <CloseButton label={t('label.close')} size="sm" onPress={onClose} />
          }
          subtitle={formatDateTime(activity.timestamp)}
          title={
            activity.summary ??
            getMetricActivityEventLabel(t, activity.eventType)
          }
        />
        <Card.Content className="tw:flex tw:flex-col tw:gap-4">
          <Typography className="tw:text-tertiary" size="text-sm">
            {activity.actor ? getEntityName(activity.actor) : t('label.system')}
          </Typography>
          {activity.fieldName && (
            <Badge color="gray" size="sm">
              {getMetricActivityFieldLabel(t, activity.fieldName)}
            </Badge>
          )}
          {(activity.oldValue || activity.newValue) && (
            <Box className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
              <Box direction="col" gap={1}>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.old')}
                </Typography>
                <Typography className="tw:break-words" size="text-sm">
                  {activity.oldValue ?? t('label.unknown')}
                </Typography>
              </Box>
              <Box direction="col" gap={1}>
                <Typography className="tw:text-tertiary" size="text-xs">
                  {t('label.new')}
                </Typography>
                <Typography className="tw:break-words" size="text-sm">
                  {activity.newValue ?? t('label.unknown')}
                </Typography>
              </Box>
            </Box>
          )}
          <Divider />
          <MetricCommentComposer
            isDisabled={!canComment}
            isLoading={isCommenting}
            onSubmit={(message) => onCreateComment(activity.about, message)}
          />
        </Card.Content>
      </Card>
    );
  }

  if (selection.kind === 'thread') {
    const thread = selection.value;

    return (
      <Card className="tw:sticky tw:top-4" data-testid="metric-thread-detail">
        <Card.Header
          extra={
            <CloseButton label={t('label.close')} size="sm" onPress={onClose} />
          }
          subtitle={formatDateTime(thread.updatedAt)}
          title={t('label.conversation')}
        />
        <Card.Content className="tw:flex tw:flex-col tw:gap-4">
          <Box direction="col" gap={1}>
            <Typography size="text-sm" weight="semibold">
              {thread.createdBy
                ? getEntityName(thread.createdBy)
                : t('label.unknown')}
            </Typography>
            <Typography className="tw:whitespace-pre-wrap" size="text-sm">
              {thread.message ?? t('label.no-description')}
            </Typography>
          </Box>
          <Divider />
          <Box direction="col" gap={3}>
            <Typography size="text-sm" weight="semibold">
              {t('label.reply-lowercase-plural')}
            </Typography>
            {(thread.replies ?? []).length === 0 ? (
              <Typography className="tw:text-tertiary" size="text-sm">
                {t('label.no-entity-available', {
                  entity: t('label.reply-lowercase-plural'),
                })}
              </Typography>
            ) : (
              <ul className="tw:flex tw:flex-col tw:gap-3">
                {thread.replies?.map((reply) => (
                  <li
                    className="tw:rounded-lg tw:bg-secondary tw:p-3"
                    key={reply.id}>
                    <Typography size="text-xs" weight="semibold">
                      {getEntityName(reply.author)}
                    </Typography>
                    <Typography
                      className="tw:whitespace-pre-wrap"
                      size="text-sm">
                      {reply.message}
                    </Typography>
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {formatDateTime(reply.createdAt)}
                    </Typography>
                  </li>
                ))}
              </ul>
            )}
          </Box>
          <MetricCommentComposer
            isDisabled={!canComment}
            isLoading={isCommenting}
            labelKey="label.reply"
            onSubmit={(message) => onReply(thread.id, message)}
          />
        </Card.Content>
      </Card>
    );
  }

  const task = selection.value;
  const isTaskOpen = [
    TaskStatus.Open,
    TaskStatus.InProgress,
    TaskStatus.Pending,
  ].includes(task.status);

  return (
    <Card className="tw:sticky tw:top-4" data-testid="metric-task-detail">
      <Card.Header
        extra={
          <CloseButton label={t('label.close')} size="sm" onPress={onClose} />
        }
        subtitle={task.taskId ?? getMetricTaskTypeLabel(t, task.type)}
        title={task.displayName ?? task.name}
      />
      <Card.Content className="tw:flex tw:flex-col tw:gap-4">
        <Box align="center" gap={2}>
          <Badge color={isTaskOpen ? 'warning' : 'success'} size="sm">
            {getMetricTaskStatusLabel(t, task.status)}
          </Badge>
          {task.workflowStageDisplayName && (
            <Badge color="brand" size="sm">
              {getMetricWorkflowLabel(t, task.workflowStageDisplayName)}
            </Badge>
          )}
        </Box>
        <Typography
          className="tw:whitespace-pre-wrap tw:text-tertiary"
          size="text-sm">
          {task.description ?? t('label.no-description')}
        </Typography>
        <Divider />
        <Box direction="col" gap={3}>
          <Typography size="text-sm" weight="semibold">
            {t('label.comment-plural')}
          </Typography>
          {(task.comments ?? []).length === 0 ? (
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('label.no-entity-available', {
                entity: t('label.comment-plural'),
              })}
            </Typography>
          ) : (
            <ul className="tw:flex tw:flex-col tw:gap-3">
              {task.comments?.map((comment) => (
                <li
                  className="tw:rounded-lg tw:bg-secondary tw:p-3"
                  key={comment.id}>
                  <Typography size="text-xs" weight="semibold">
                    {getEntityName(comment.author)}
                  </Typography>
                  <Typography className="tw:whitespace-pre-wrap" size="text-sm">
                    {comment.message}
                  </Typography>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {formatDateTime(comment.createdAt)}
                  </Typography>
                </li>
              ))}
            </ul>
          )}
        </Box>
        {canComment && isTaskOpen && (
          <MetricCommentComposer
            isLoading={isCommenting}
            onSubmit={(message) => onTaskComment(task.id, message)}
          />
        )}
        {task.resolution && (
          <Alert
            title={getMetricTaskResolutionLabel(t, task.resolution.type)}
            variant="gray">
            {task.resolution.comment}
          </Alert>
        )}
        {isResolvePermissionLoading && isTaskOpen && (
          <span aria-label={t('label.loading')} role="status">
            <Skeleton height={36} variant="rounded" />
          </span>
        )}
        {Boolean(resolvePermissionError) && isTaskOpen && (
          <Alert
            title={t('server.fetch-entity-permissions-error', {
              entity: t('label.task'),
            })}
            variant="error">
            <Button
              color="secondary"
              size="sm"
              onPress={onRetryResolvePermission}>
              {t('label.try-again')}
            </Button>
          </Alert>
        )}
        {!isResolvePermissionLoading && canResolveTasks && isTaskOpen && (
          <Box direction="col" gap={3}>
            <TextArea
              aria-label={t('label.note')}
              placeholder={t('label.add-entity', { entity: t('label.note') })}
              rows={2}
              value={decisionNote}
              onChange={setDecisionNote}
            />
            <Box className="tw:flex-wrap" gap={2}>
              {(task.availableTransitions ?? []).length > 0 ? (
                task.availableTransitions?.map((transition) => (
                  <Button
                    color={
                      transition.targetTaskStatus === TaskStatus.Rejected
                        ? 'secondary-destructive'
                        : 'primary'
                    }
                    isDisabled={
                      isResolvingTask ||
                      (transition.requiresComment && !decisionNote.trim())
                    }
                    isLoading={isResolvingTask}
                    key={transition.id}
                    size="sm"
                    onPress={() =>
                      onResolveTask(
                        task.id,
                        transition.id,
                        decisionNote.trim() || undefined
                      )
                    }>
                    {getMetricTaskTransitionLabel(t, transition)}
                  </Button>
                ))
              ) : (
                <Button
                  color="primary"
                  isLoading={isResolvingTask}
                  size="sm"
                  onPress={() =>
                    onResolveTask(task.id, undefined, decisionNote.trim())
                  }>
                  {t('label.resolve')}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Card.Content>
    </Card>
  );
};

export default MetricActivityDetail;
