/*
 *  Copyright 2024 Collate.
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
import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../hooks/useFqn';
import {
  getLiveIndexingQueue,
  SearchIndexRetryRecord,
} from '../../../../rest/applicationAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import { AppLiveIndexingProps } from './AppLiveIndexing.interface';

const STATUS_TYPE_MAP: Record<string, StatusType> = {
  PENDING: StatusType.Warning,
  PENDING_RETRY_1: StatusType.Warning,
  PENDING_RETRY_2: StatusType.Warning,
  IN_PROGRESS: StatusType.Success,
  COMPLETED: StatusType.Success,
  FAILED: StatusType.Failure,
};

const PAGE_SIZE = 15;

const AppLiveIndexing = ({ appData: _appData }: AppLiveIndexingProps) => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const [isLoading, setIsLoading] = useState(true);
  const [records, setRecords] = useState<SearchIndexRetryRecord[]>([]);

  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging(PAGE_SIZE);

  const fetchRetryQueue = useCallback(
    async (offset = 0) => {
      setIsLoading(true);
      try {
        const response = await getLiveIndexingQueue(fqn, {
          limit: pageSize,
          offset,
        });
        setRecords(response.data);
        handlePagingChange({
          total: response.paging?.total ?? 0,
        } as Paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setRecords([]);
      } finally {
        setIsLoading(false);
      }
    },
    [fqn, pageSize]
  );

  const handlePageChangeHandler = useCallback(
    ({ currentPage: page }: PagingHandlerParams) => {
      handlePageChange(page);
      fetchRetryQueue((page - 1) * pageSize);
    },
    [fetchRetryQueue, pageSize]
  );

  useEffect(() => {
    if (fqn) {
      fetchRetryQueue();
    }
  }, [fqn]);

  const columns: ColumnsType<SearchIndexRetryRecord> = useMemo(
    () => [
      {
        title: t('label.entity-type'),
        dataIndex: 'entityType',
        key: 'entityType',
        width: 140,
        render: (entityType: string) => (
          <Typography.Text>{entityType || NO_DATA_PLACEHOLDER}</Typography.Text>
        ),
      },
      {
        title: t('label.entity-fqn'),
        dataIndex: 'entityFqn',
        key: 'entityFqn',
        ellipsis: true,
        render: (entityFqn: string) => (
          <Typography.Text
            ellipsis={{ tooltip: entityFqn }}
            style={{ maxWidth: 300 }}>
            {entityFqn || NO_DATA_PLACEHOLDER}
          </Typography.Text>
        ),
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        width: 150,
        render: (status: string) => (
          <StatusBadge
            dataTestId="retry-status"
            label={status}
            status={STATUS_TYPE_MAP[status] ?? StatusType.Warning}
          />
        ),
      },
      {
        title: t('label.retry-count'),
        dataIndex: 'retryCount',
        key: 'retryCount',
        width: 120,
        render: (count: number) => <Typography.Text>{count}</Typography.Text>,
      },
      {
        title: t('label.failure-reason'),
        dataIndex: 'failureReason',
        key: 'failureReason',
        ellipsis: true,
        render: (reason: string) => (
          <Typography.Text
            ellipsis={{ tooltip: reason }}
            style={{ maxWidth: 300 }}>
            {reason || NO_DATA_PLACEHOLDER}
          </Typography.Text>
        ),
      },
    ],
    [t]
  );

  return (
    <Table
      bordered
      columns={columns}
      currentPage={currentPage}
      dataSource={records}
      loading={isLoading}
      locale={{
        emptyText: (
          <div className="tw:py-8 tw:text-center">
            <Typography.Text className="tw:text-text-secondary">
              {t('message.no-retry-queue-records')}
            </Typography.Text>
          </div>
        ),
      }}
      pageSize={pageSize}
      pagination={{
        total: paging.total,
        pageSize,
        current: currentPage,
        showSizeChanger: true,
        pageSizeOptions: ['10', '15', '25', '50'],
        onChange: (page) =>
          handlePageChangeHandler({ currentPage: page, cursorType: '' }),
        onShowSizeChange: (_, size) => {
          handlePageSizeChange(size);
          fetchRetryQueue(0);
        },
      }}
      paginationVisible={records.length > 0 && paging.total > pageSize}
      rowKey={(record) => `${record.entityId}-${record.entityFqn}`}
      size="small"
    />
  );
};

export default AppLiveIndexing;
