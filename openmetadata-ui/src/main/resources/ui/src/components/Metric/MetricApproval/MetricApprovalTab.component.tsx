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
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  ProgressSteps,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus, Metric } from '../../../generated/entity/data/metric';
import { User } from '../../../generated/entity/teams/user';
import { useEntityApprovalTask } from '../../../hooks/useEntityApprovalTask';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import {
  isMetricAwaitingApproval,
  metricHasApprovalWorkflow,
  permissionForMetricApproval,
} from '../../../utils/MetricEntityUtils/MetricApprovalUtils';
import MetricStatusPill from '../MetricStatusPill/MetricStatusPill.component';
import MetricApprovalHistory from './MetricApprovalHistory';
import MetricStatusAction from './MetricStatusAction.component';
import {
  getMetricApprovalOutcome,
  metricApprovalHistoryQueryKey,
  useMetricApprovalHistory,
} from './useMetricApprovalHistory';

export interface MetricApprovalTabProps {
  metric: Metric;
  currentUser?: User;
  onStatusChange: () => void;
}

type ApprovalTaskQuery = ReturnType<typeof useEntityApprovalTask>;

const ApprovalStatusAlerts = ({
  entityStatus,
  hasWorkflow,
  isRollbackOutcome,
}: {
  entityStatus?: EntityStatus;
  hasWorkflow: boolean;
  isRollbackOutcome: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {!hasWorkflow && (
        <Alert
          data-testid="metric-approval-not-required"
          title={t('message.metric-approval-not-required')}
          variant="gray"
        />
      )}
      {hasWorkflow && entityStatus === EntityStatus.Draft && (
        <Alert
          data-testid="metric-approval-draft"
          title={t('label.draft')}
          variant="brand"
        />
      )}
      {entityStatus === EntityStatus.Approved && !isRollbackOutcome && (
        <Alert
          data-testid="metric-approval-approved"
          title={t('label.approved')}
          variant="success"
        />
      )}
      {entityStatus === EntityStatus.Rejected && (
        <Alert
          data-testid="metric-approval-rejected"
          title={t('label.rejected')}
          variant="error"
        />
      )}
      {isRollbackOutcome && (
        <Alert
          data-testid="metric-approval-rollback"
          title={t('label.rolled-back')}
          variant="warning"
        />
      )}
    </>
  );
};

const ApprovalActionResult = ({
  actionResult,
  onClose,
}: {
  actionResult?: 'error' | 'success';
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  if (!actionResult) {
    return null;
  }

  const isSuccess = actionResult === 'success';

  return (
    <Alert
      closable
      data-testid={`metric-approval-action-${actionResult}`}
      title={
        isSuccess
          ? t('server.task-resolved-successfully')
          : t('server.api-error')
      }
      variant={isSuccess ? 'success' : 'error'}
      onClose={onClose}
    />
  );
};

interface ApprovalTaskStateProps {
  hasWorkflow: boolean;
  note: string;
  showActions: boolean;
  status?: EntityStatus;
  taskQuery: ApprovalTaskQuery;
  onApprove: () => void;
  onNoteChange: (note: string) => void;
  onReject: () => void;
}

const ApprovalTaskState = ({
  hasWorkflow,
  note,
  showActions,
  status,
  taskQuery,
  onApprove,
  onNoteChange,
  onReject,
}: ApprovalTaskStateProps) => {
  const { t } = useTranslation();
  const showWaiting = [
    !taskQuery.isPending,
    !taskQuery.error,
    status === EntityStatus.InReview,
    !showActions,
  ].every(Boolean);

  return (
    <>
      {taskQuery.isPending && hasWorkflow && (
        <Box direction="col" gap={3}>
          <Skeleton height={48} variant="rounded" />
          <Skeleton height={92} variant="rounded" />
        </Box>
      )}
      {taskQuery.error && (
        <Alert
          data-testid="metric-approval-task-error"
          rightContent={
            <Button
              color="link-gray"
              size="sm"
              onPress={() => taskQuery.refetch()}>
              {t('label.try-again')}
            </Button>
          }
          title={t('message.temporary-error-try-reloading')}
          variant="error"
        />
      )}
      {showWaiting && (
        <Alert
          data-testid="metric-approval-waiting"
          title={t('label.in-review')}
          variant="warning"
        />
      )}
      {showActions && (
        <MetricStatusAction
          dataTestId="metric-approval"
          isLoading={taskQuery.isResolving}
          note={note}
          onApprove={onApprove}
          onNoteChange={onNoteChange}
          onReject={onReject}
        />
      )}
    </>
  );
};

const ApprovalReviewers = ({
  hasWorkflow,
  metric,
}: {
  hasWorkflow: boolean;
  metric: Metric;
}) => {
  const { t } = useTranslation();
  const reviewers = metric.reviewers ?? [];

  if (!hasWorkflow || reviewers.length === 0) {
    return null;
  }

  return (
    <Card data-testid="metric-approval-reviewers">
      <Card.Header
        extra={
          <Badge color="gray" size="sm">
            {reviewers.length}
          </Badge>
        }
        title={t('label.reviewer-plural')}
      />
      <Card.Content>
        <ul className="tw:grid tw:grid-cols-1 tw:gap-3 tw:sm:grid-cols-2">
          {reviewers.map((reviewer) => {
            const name = getEntityName(reviewer);

            return (
              <li
                className="tw:flex tw:items-center tw:gap-3"
                key={reviewer.id}>
                <Avatar
                  alt={name}
                  placeholder={name.slice(0, 1).toLocaleUpperCase()}
                  size="sm"
                />
                <Box className="tw:min-w-0" direction="col">
                  <Typography ellipsis size="text-sm" weight="medium">
                    {name}
                  </Typography>
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {getEntityNameLabel(reviewer.type)}
                  </Typography>
                </Box>
              </li>
            );
          })}
        </ul>
      </Card.Content>
    </Card>
  );
};

const ApprovalHistorySection = ({
  hasWorkflow,
  metricFqn,
}: {
  hasWorkflow: boolean;
  metricFqn?: string;
}) => {
  if (!hasWorkflow) {
    return null;
  }

  return <MetricApprovalHistory metricFqn={metricFqn} />;
};

const MetricApprovalTab: FC<MetricApprovalTabProps> = ({
  currentUser,
  metric,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [actionResult, setActionResult] = useState<'error' | 'success'>();
  const hasWorkflow = metricHasApprovalWorkflow(metric);
  const historyQuery = useMetricApprovalHistory(
    hasWorkflow ? metric.fullyQualifiedName : undefined
  );
  const latestOutcome = getMetricApprovalOutcome(historyQuery.data);
  const isRollbackOutcome =
    metric.entityStatus === EntityStatus.Approved &&
    (latestOutcome === 'rollback' || latestOutcome === 'rejected');
  const taskQuery = useEntityApprovalTask({
    entityFqn: metric.fullyQualifiedName ?? '',
    enabled: hasWorkflow,
  });
  const { canApprove, taskId } = useMemo(
    () =>
      permissionForMetricApproval(
        metric,
        currentUser,
        taskQuery.task ?? undefined
      ),
    [metric, currentUser, taskQuery.task]
  );
  const showActions =
    isMetricAwaitingApproval(metric.entityStatus) &&
    canApprove &&
    Boolean(taskId);
  const { currentStep, steps } = useMemo(() => {
    if (metric.entityStatus === EntityStatus.Rejected) {
      return {
        currentStep: 2,
        steps: [
          { id: 'draft', title: t('label.draft') },
          { id: 'review', title: t('label.in-review') },
          { id: 'rejected', title: t('label.rejected') },
        ],
      };
    }
    if (isRollbackOutcome) {
      return {
        currentStep: 2,
        steps: [
          { id: 'approved', title: t('label.approved') },
          { id: 'review', title: t('label.in-review') },
          { id: 'rollback', title: t('label.rolled-back') },
        ],
      };
    }

    let currentStep = 0;
    if (metric.entityStatus === EntityStatus.Approved) {
      currentStep = 2;
    } else if (metric.entityStatus === EntityStatus.InReview) {
      currentStep = 1;
    }

    return {
      currentStep,
      steps: [
        { id: 'draft', title: t('label.draft') },
        { id: 'review', title: t('label.in-review') },
        { id: 'approved', title: t('label.approved') },
      ],
    };
  }, [isRollbackOutcome, metric.entityStatus, t]);

  const refreshApproval = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: metricApprovalHistoryQueryKey(metric.fullyQualifiedName ?? ''),
    });
    onStatusChange();
  }, [metric.fullyQualifiedName, onStatusChange, queryClient]);

  const handleApprove = useCallback(async () => {
    try {
      await taskQuery.approve(taskId, note.trim() || undefined);
      setNote('');
      setActionResult('success');
      refreshApproval();
    } catch {
      setActionResult('error');
    }
  }, [note, refreshApproval, t, taskId, taskQuery.approve]);

  const handleReject = useCallback(async () => {
    if (!note.trim()) {
      return;
    }
    try {
      await taskQuery.reject(taskId, note.trim());
      setNote('');
      setActionResult('success');
      refreshApproval();
    } catch {
      setActionResult('error');
    }
  }, [note, refreshApproval, t, taskId, taskQuery.reject]);

  return (
    <Box
      className="tw:flex tw:flex-col tw:gap-4 tw:px-4 tw:py-6 tw:md:px-8"
      data-testid="metric-approval-tab">
      <Card data-testid="metric-approval-status">
        <Card.Header
          className="tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:gap-4"
          data-testid="metric-approval-status-header"
          extra={
            <MetricStatusPill
              data-testid="metric-approval-status-pill"
              status={metric.entityStatus}
            />
          }
          subtitle={t('message.metric-approval-automatic-workflow')}
          title={t('label.approval')}
        />
        <Card.Content className="tw:flex tw:flex-col tw:gap-6">
          <ProgressSteps
            aria-label={t('label.approval')}
            currentStep={currentStep}
            labelPlacement="attach"
            orientation="horizontal"
            size="sm"
            steps={steps}
            type="number"
          />

          <ApprovalStatusAlerts
            entityStatus={metric.entityStatus}
            hasWorkflow={hasWorkflow}
            isRollbackOutcome={isRollbackOutcome}
          />
          <ApprovalActionResult
            actionResult={actionResult}
            onClose={() => setActionResult(undefined)}
          />
          <ApprovalTaskState
            hasWorkflow={hasWorkflow}
            note={note}
            showActions={showActions}
            status={metric.entityStatus}
            taskQuery={taskQuery}
            onApprove={handleApprove}
            onNoteChange={setNote}
            onReject={handleReject}
          />
        </Card.Content>
      </Card>

      <ApprovalReviewers hasWorkflow={hasWorkflow} metric={metric} />
      <ApprovalHistorySection
        hasWorkflow={hasWorkflow}
        metricFqn={metric.fullyQualifiedName}
      />
      <span aria-live="polite" className="tw:sr-only">
        {taskQuery.isResolving ? t('label.loading') : ''}
      </span>
    </Box>
  );
};

export default MetricApprovalTab;
