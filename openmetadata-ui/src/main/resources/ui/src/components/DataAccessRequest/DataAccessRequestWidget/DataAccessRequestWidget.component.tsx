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

import { Badge } from '@openmetadata/ui-core-components';
import { Button, Card, Empty, Skeleton, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as KeyIcon } from '../../../assets/svg/icon-key.svg';
import {
  listTasks,
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
} from '../../../rest/tasksAPI';
import {
  getDataAccessPayload,
  getDisplayStatus,
} from '../../../utils/DataAccessRequest/DataAccessRequestUtils';

const STATUS_BADGE_COLOR: Record<
  string,
  'success' | 'error' | 'warning' | 'gray' | 'orange'
> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'error',
  Revoked: 'orange',
  Expired: 'gray',
};
import { showErrorToast } from '../../../utils/ToastUtils';
import { DataAccessRequestWidgetProps } from '../DataAccessRequest.interface';
import DataAccessRequestDetailDrawer from '../DataAccessRequestDetailDrawer/DataAccessRequestDetailDrawer.component';
import DataAccessRequestDrawer from '../DataAccessRequestDrawer/DataAccessRequestDrawer.component';

const { Text } = Typography;

const ACTIVE_STATUSES = new Set<TaskEntityStatus>([
  TaskEntityStatus.Open,
  TaskEntityStatus.Pending,
  TaskEntityStatus.InProgress,
]);

const DataAccessRequestWidget = ({
  entityFqn,
  entityType,
  entityDisplayName,
  availableColumns,
  reviewers,
  canRequestAccess = true,
}: DataAccessRequestWidgetProps) => {
  const { t } = useTranslation();
  const [requestDrawerOpen, setRequestDrawerOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | undefined>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!entityFqn) {
      return;
    }
    try {
      setLoading(true);
      const response = await listTasks({
        category: TaskCategory.DataAccess,
        type: TaskEntityType.DataAccessRequest,
        aboutEntity: entityFqn,
        limit: 5,
      });
      setTasks(response.data ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [entityFqn]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const activeTask = useMemo(
    () => tasks.find((task) => ACTIVE_STATUSES.has(task.status)),
    [tasks]
  );

  const renderEmpty = () => (
    <Space
      className="tw:w-full tw:items-center tw:py-4"
      data-testid="dar-widget-empty"
      direction="vertical"
      size="small">
      <Empty
        description={t('message.no-active-data-access-request')}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
      {canRequestAccess && (
        <Button
          data-testid="dar-widget-request-button"
          type="primary"
          onClick={() => setRequestDrawerOpen(true)}>
          {t('label.request-data-access')}
        </Button>
      )}
    </Space>
  );

  const renderActiveRequest = (task: Task) => {
    const payload = getDataAccessPayload(task);
    const displayStatus = getDisplayStatus(task);
    const badgeColor = STATUS_BADGE_COLOR[displayStatus] ?? 'gray';

    return (
      <div
        className="tw:flex tw:flex-col tw:gap-2"
        data-testid={`dar-widget-task-${task.taskId}`}>
        <div className="tw:flex tw:items-center tw:justify-between">
          <Button
            data-testid={`dar-widget-task-id-${task.taskId}`}
            type="link"
            onClick={() => setDetailTaskId(task.id)}>
            {task.taskId}
          </Button>
          <Badge color={badgeColor} size="sm" type="color">
            {displayStatus}
          </Badge>
        </div>

        {payload?.accessType && (
          <Text className="tw:text-xs">
            <Text className="tw:text-xs" type="secondary">
              {t('label.access-type')}:{' '}
            </Text>
            {payload.accessType}
          </Text>
        )}

        {payload?.columns && payload.columns.length > 0 && (
          <Text className="tw:text-xs" data-testid="dar-widget-columns">
            <Text className="tw:text-xs" type="secondary">
              {t('label.column-plural')}:{' '}
            </Text>
            {payload.columns
              .map((c) => c.split('.').pop() ?? c)
              .slice(0, 3)
              .join(', ')}
            {payload.columns.length > 3
              ? ` +${payload.columns.length - 3}`
              : ''}
          </Text>
        )}

        {payload?.reason && (
          <Text className="tw:text-xs" ellipsis={{ tooltip: payload.reason }}>
            <Text className="tw:text-xs" type="secondary">
              {t('label.reason')}:{' '}
            </Text>
            {payload.reason}
          </Text>
        )}

        {canRequestAccess && (
          <Button
            block
            data-testid="dar-widget-add-comment-button"
            type="link"
            onClick={() => setDetailTaskId(task.id)}>
            {t('label.view-and-comment')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <Card
        bodyStyle={{ padding: 16 }}
        data-testid="data-access-request-widget"
        extra={
          activeTask && canRequestAccess ? (
            <Button
              data-testid="dar-widget-new-button"
              size="small"
              type="link"
              onClick={() => setRequestDrawerOpen(true)}>
              {t('label.add-comment')}
            </Button>
          ) : undefined
        }
        size="small"
        title={
          <Space size="small">
            <KeyIcon height={16} width={16} />
            <Text strong>{t('label.data-access-request')}</Text>
          </Space>
        }>
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : activeTask ? (
          renderActiveRequest(activeTask)
        ) : (
          renderEmpty()
        )}
      </Card>

      <DataAccessRequestDrawer
        availableColumns={availableColumns}
        entityDisplayName={entityDisplayName}
        entityFqn={entityFqn}
        entityType={entityType}
        open={requestDrawerOpen}
        reviewers={reviewers}
        onClose={() => setRequestDrawerOpen(false)}
        onCreated={() => {
          setRequestDrawerOpen(false);
          fetchTasks();
        }}
      />

      <DataAccessRequestDetailDrawer
        open={Boolean(detailTaskId)}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(undefined)}
        onResolved={() => {
          setDetailTaskId(undefined);
          fetchTasks();
        }}
      />
    </>
  );
};

export default DataAccessRequestWidget;
