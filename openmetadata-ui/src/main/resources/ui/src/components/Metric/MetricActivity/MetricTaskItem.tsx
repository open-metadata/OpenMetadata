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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckSquareBroken } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../../generated/entity/tasks/task';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getMetricTaskStatusLabel } from './MetricActivity.utils';

export interface MetricTaskItemProps {
  isActive: boolean;
  task: Task;
  onReviewApproval?: () => void;
  onSelect: () => void;
}

const MetricTaskItem = ({
  isActive,
  task,
  onReviewApproval,
  onSelect,
}: MetricTaskItemProps) => {
  const { t } = useTranslation();
  const isApprovalTask = task.type === TaskType.RequestApproval;
  const statusColor = [
    TaskStatus.Open,
    TaskStatus.InProgress,
    TaskStatus.Pending,
  ].includes(task.status)
    ? 'warning'
    : task.status === TaskStatus.Rejected || task.status === TaskStatus.Failed
    ? 'error'
    : 'success';

  return (
    <Card isSelected={isActive}>
      <Card.Content className="tw:flex tw:items-start tw:gap-3">
        <Box
          align="center"
          className="tw:size-9 tw:shrink-0 tw:justify-center tw:rounded-lg tw:bg-utility-warning-50 tw:text-fg-warning-primary">
          <CheckSquareBroken aria-hidden="true" size={18} />
        </Box>
        <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
          <Box align="center" gap={2} justify="between">
            <Button
              aria-pressed={isActive}
              className="tw:min-w-0 tw:justify-start tw:text-left"
              color="link-gray"
              data-testid={`metric-task-item-${task.id}`}
              onPress={onSelect}>
              <Typography ellipsis size="text-sm" weight="medium">
                {task.displayName ?? task.name}
              </Typography>
            </Button>
            <Badge color={statusColor} size="xs">
              {getMetricTaskStatusLabel(t, task.status)}
            </Badge>
          </Box>
          <Typography
            className="tw:line-clamp-2 tw:text-tertiary"
            size="text-xs">
            {task.description ?? t('label.no-description')}
          </Typography>
          <Box
            align="center"
            className="tw:flex-wrap"
            gap={2}
            justify="between">
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('label.assignee-plural')}:{' '}
              {task.assignees?.map(getEntityName).join(', ') ??
                t('label.empty-dash')}
              {' · '}
              {getShortRelativeTime(task.updatedAt ?? task.createdAt)}
            </Typography>
            {isApprovalTask && onReviewApproval ? (
              <Button
                color="link-color"
                data-testid={`metric-task-review-${task.id}`}
                size="xs"
                onPress={onReviewApproval}>
                {t('label.view-entity', {
                  entity: `${t('label.approval')} ${t('label.workflow')}`,
                })}
              </Button>
            ) : null}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MetricTaskItem;
