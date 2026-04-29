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

import { Badge, Tabs } from '@openmetadata/ui-core-components';
import { Button, Input, Select, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataAccessType,
  listMyAssignedTasks,
  listMyCreatedTasks,
  Task,
  TaskCategory,
  TaskEntityType,
} from '../../../rest/tasksAPI';
import {
  formatDuration,
  formatExpirationDate,
  getDataAccessPayload,
  getDisplayStatus,
} from '../../../utils/DataAccessRequest/DataAccessRequestUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { DataAccessTab } from '../DataAccessRequest.interface';
import DataAccessRequestDetailDrawer from '../DataAccessRequestDetailDrawer/DataAccessRequestDetailDrawer.component';

const { Text } = Typography;

interface DataAccessRequestListProps {
  activeTab: DataAccessTab;
  onTabChange: (tab: DataAccessTab) => void;
}

const PAGE_SIZE = 13;

const STATUS_FILTER_OPTIONS = [
  'Pending',
  'Approved',
  'Rejected',
  'Expired',
  'Revoked',
];

const ACCESS_TYPE_LABELS: Record<DataAccessType, string> = {
  [DataAccessType.FullAccess]: 'Full Access',
  [DataAccessType.ColumnLevel]: 'Column-level',
  [DataAccessType.Masked]: 'Masked',
};

// Maps the displayed status label to the Badge color from the OM design system.
// Tokens map directly to the Figma's Component colors/Utility palette.
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

const formatFigmaDate = (timestamp?: number): string => {
  if (!timestamp) {
    return '-';
  }
  const d = new Date(timestamp);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return `${d.getDate()}, ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const DataAccessRequestList = ({
  activeTab,
  onTabChange,
}: DataAccessRequestListProps) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [accessTypeFilter, setAccessTypeFilter] = useState<
    string | undefined
  >();
  const [datasetFilter, setDatasetFilter] = useState<string | undefined>();
  const [requestedByFilter, setRequestedByFilter] = useState<
    string | undefined
  >();
  const [approverFilter, setApproverFilter] = useState<string | undefined>();
  const [detailTaskId, setDetailTaskId] = useState<string | undefined>();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const fetcher =
        activeTab === 'my-requests' ? listMyCreatedTasks : listMyAssignedTasks;
      const response = await fetcher({
        fields: 'about,assignees,resolution,createdBy,reviewers',
        limit: 50,
      });

      const filtered = (response.data ?? []).filter(
        (task) =>
          task.category === TaskCategory.DataAccess &&
          task.type === TaskEntityType.DataAccessRequest
      );
      setTasks(filtered);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const datasetOptions = useMemo(() => {
    const seen = new Set<string>();

    return tasks
      .map((t) => t.about?.displayName ?? t.about?.name ?? '')
      .filter((n) => n && !seen.has(n) && seen.add(n))
      .map((n) => ({ label: n, value: n }));
  }, [tasks]);

  const requestedByOptions = useMemo(() => {
    const seen = new Set<string>();

    return tasks
      .map((t) => t.createdBy?.displayName ?? t.createdBy?.name ?? '')
      .filter((n) => n && !seen.has(n) && seen.add(n))
      .map((n) => ({ label: n, value: n }));
  }, [tasks]);

  const approverOptions = useMemo(() => {
    const seen = new Set<string>();

    return tasks
      .map(
        (t) =>
          t.resolution?.resolvedBy?.displayName ??
          t.resolution?.resolvedBy?.name ??
          ''
      )
      .filter((n) => n && !seen.has(n) && seen.add(n))
      .map((n) => ({ label: n, value: n }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const trimmed = searchText.trim().toLowerCase();

    return tasks.filter((task) => {
      const dataset = task.about?.displayName ?? task.about?.name ?? '';
      if (
        trimmed &&
        !task.taskId.toLowerCase().includes(trimmed) &&
        !dataset.toLowerCase().includes(trimmed)
      ) {
        return false;
      }
      if (statusFilter && getDisplayStatus(task) !== statusFilter) {
        return false;
      }
      if (
        accessTypeFilter &&
        getDataAccessPayload(task)?.accessType !== accessTypeFilter
      ) {
        return false;
      }
      if (datasetFilter && dataset !== datasetFilter) {
        return false;
      }
      const createdByName =
        task.createdBy?.displayName ?? task.createdBy?.name ?? '';
      if (requestedByFilter && createdByName !== requestedByFilter) {
        return false;
      }
      const approverName =
        task.resolution?.resolvedBy?.displayName ??
        task.resolution?.resolvedBy?.name ??
        '';
      if (approverFilter && approverName !== approverFilter) {
        return false;
      }

      return true;
    });
  }, [
    tasks,
    searchText,
    statusFilter,
    accessTypeFilter,
    datasetFilter,
    requestedByFilter,
    approverFilter,
  ]);

  const renderUser = (
    user?: { name?: string; displayName?: string } | null
  ) => {
    if (!user) {
      return <Text type="secondary">--</Text>;
    }

    return (
      <Space size={6}>
        <ProfilePicture
          displayName={user.displayName ?? ''}
          name={user.name ?? ''}
          size={20}
        />
        <Text className="tw:text-sm">
          {user.displayName ?? user.name ?? '--'}
        </Text>
      </Space>
    );
  };

  const columns = useMemo<ColumnsType<Task>>(
    () => [
      {
        dataIndex: 'taskId',
        key: 'taskId',
        title: t('label.task-id'),
        width: 110,
        render: (taskId: string, record) => (
          <Button
            className="tw:!px-0 tw:!font-medium"
            data-testid={`dar-list-task-${taskId}`}
            type="link"
            onClick={() => setDetailTaskId(record.id)}>
            {taskId}
          </Button>
        ),
      },
      {
        key: 'dataset',
        title: t('label.dataset'),
        render: (_v, record) => (
          <Button
            className="tw:!px-0"
            type="link"
            onClick={() => setDetailTaskId(record.id)}>
            {record.about?.displayName ?? record.about?.name ?? '--'}
          </Button>
        ),
      },
      {
        key: 'requestedBy',
        title: t('label.requested-by'),
        render: (_v, record) => renderUser(record.createdBy),
      },
      {
        key: 'accessType',
        title: t('label.access-type'),
        render: (_v, record) => {
          const at = getDataAccessPayload(record)?.accessType;

          return at ? ACCESS_TYPE_LABELS[at] : '--';
        },
      },
      {
        key: 'columns',
        title: t('label.columns-requested'),
        render: (_v, record) => {
          const cols = getDataAccessPayload(record)?.columns ?? [];
          if (cols.length === 0) {
            return <Text type="secondary">--</Text>;
          }
          const first = cols[0].split('.').pop() ?? cols[0];
          if (cols.length === 1) {
            return first;
          }

          return (
            <span className="tw:flex tw:items-center tw:gap-1.5">
              {first}
              <Badge color="brand" size="sm" type="color">
                +{cols.length - 1}
              </Badge>
            </span>
          );
        },
      },
      {
        key: 'reason',
        title: t('label.reason'),
        ellipsis: true,
        render: (_v, record) => {
          const reason = getDataAccessPayload(record)?.reason ?? '';
          if (!reason) {
            return <Text type="secondary">--</Text>;
          }

          return reason.length > 30 ? `${reason.slice(0, 30)}...` : reason;
        },
      },
      {
        dataIndex: 'status',
        key: 'status',
        title: t('label.status'),
        width: 110,
        render: (_v, record) => {
          const display = getDisplayStatus(record);
          const color = STATUS_BADGE_COLOR[display] ?? 'gray';

          return (
            <Badge color={color} size="sm" type="color">
              {display}
            </Badge>
          );
        },
      },
      {
        key: 'requestedOn',
        title: t('label.requested-on'),
        render: (_v, record) => formatFigmaDate(record.createdAt),
      },
      {
        key: 'duration',
        title: t('label.duration'),
        render: (_v, record) =>
          formatDuration(getDataAccessPayload(record)?.duration),
      },
      {
        key: 'expiresOn',
        title: t('label.expires-on'),
        render: (_v, record) => {
          const payload = getDataAccessPayload(record);
          if (payload?.expirationDate) {
            return formatFigmaDate(payload.expirationDate);
          }
          const computed = formatExpirationDate(
            record.createdAt,
            payload?.duration
          );

          return formatFigmaDate(computed);
        },
      },
    ],
    [t]
  );

  return (
    <div className="tw:bg-(--color-bg-primary) tw:rounded-xl tw:shadow-xs tw:overflow-hidden">
      <div className="tw:flex tw:items-center tw:justify-between tw:p-4 tw:gap-3 tw:flex-wrap">
        <div className="tw:flex tw:items-center tw:gap-3">
          <Tabs
            data-testid="dar-tabs"
            selectedKey={activeTab}
            onSelectionChange={(key) =>
              onTabChange(String(key) as DataAccessTab)
            }>
            <Tabs.List size="sm" type="button-gray">
              <Tabs.Item id="my-requests">
                {t('label.my-request-plural')}
              </Tabs.Item>
              <Tabs.Item id="my-approvals">
                {t('label.my-approval-plural')}
              </Tabs.Item>
            </Tabs.List>
          </Tabs>
          <Input.Search
            allowClear
            className="tw:max-w-xs"
            data-testid="dar-list-search"
            placeholder={t('label.search-by-id-or-dataset')}
            style={{ width: 280 }}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Space size="small" wrap>
          <Select
            allowClear
            data-testid="dar-list-dataset-filter"
            options={datasetOptions}
            placeholder={t('label.dataset')}
            style={{ minWidth: 110 }}
            value={datasetFilter}
            onChange={setDatasetFilter}
          />
          <Select
            allowClear
            data-testid="dar-list-status-filter"
            options={STATUS_FILTER_OPTIONS.map((s) => ({
              label: s,
              value: s,
            }))}
            placeholder={t('label.status')}
            style={{ minWidth: 110 }}
            value={statusFilter}
            onChange={setStatusFilter}
          />
          <Select
            allowClear
            data-testid="dar-list-requested-by-filter"
            options={requestedByOptions}
            placeholder={t('label.requested-by')}
            style={{ minWidth: 130 }}
            value={requestedByFilter}
            onChange={setRequestedByFilter}
          />
          <Select
            allowClear
            data-testid="dar-list-approver-filter"
            options={approverOptions}
            placeholder={t('label.approver')}
            style={{ minWidth: 110 }}
            value={approverFilter}
            onChange={setApproverFilter}
          />
          <Select
            allowClear
            data-testid="dar-list-access-type-filter"
            options={Object.values(DataAccessType).map((a) => ({
              label: ACCESS_TYPE_LABELS[a],
              value: a,
            }))}
            placeholder={t('label.access-type')}
            style={{ minWidth: 130 }}
            value={accessTypeFilter}
            onChange={setAccessTypeFilter}
          />
        </Space>
      </div>

      <Table<Task>
        columns={columns}
        data-testid="dar-list-table"
        dataSource={filteredTasks}
        loading={loading}
        pagination={{
          pageSize: PAGE_SIZE,
          showSizeChanger: false,
          position: ['bottomRight'],
          size: 'small',
        }}
        rowKey="id"
        size="middle"
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
    </div>
  );
};

export default DataAccessRequestList;
