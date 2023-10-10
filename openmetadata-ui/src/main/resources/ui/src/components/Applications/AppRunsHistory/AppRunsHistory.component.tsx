import { Button, Col, Row, Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  AppRunRecord,
  AppScheduleClass,
  Status,
} from '../../../generated/entity/applications/appRunRecord';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getApplicationRuns } from '../../../rest/applicationAPI';
import { getStatusTypeForApplication } from '../../../utils/ApplicationUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import Table from '../../common/Table/Table';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../common/next-previous/NextPrevious';
import { PagingHandlerParams } from '../../common/next-previous/NextPrevious.interface';

const AppRunsHistory = () => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appRunsHistoryData, setAppRunsHistoryData] = useState<AppRunRecord[]>(
    []
  );

  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging();

  const tableColumn: ColumnsType<AppRunRecord> = useMemo(
    () => [
      {
        title: t('label.scheduled-at'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (_, record) => {
          const date = formatDateTime(record.timestamp);
          return date;
        },
      },
      {
        title: t('label.schedule-type'),
        dataIndex: 'scheduleType',
        key: 'scheduleType',
        render: (_, record) => {
          return (record?.scheduleInfo as AppScheduleClass)?.scheduleType ?? '';
        },
      },
      {
        title: t('label.schedule-interval'),
        dataIndex: 'cronExpression',
        key: 'cronExpression',
        render: (_, record) => {
          return (
            (record?.scheduleInfo as AppScheduleClass)?.cronExpression ?? ''
          );
        },
      },
      {
        title: t('label.run-type'),
        dataIndex: 'runType',
        key: 'runType',
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        render: (_, record: AppRunRecord) => {
          const status: StatusType = getStatusTypeForApplication(
            record.status ?? Status.Failed
          );

          return (
            <StatusBadge
              dataTestId={record.appId + '-status'}
              label={capitalize(record.status)}
              status={status}
            />
          );
        },
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        render: () => {
          return (
            <Space align="start">
              <Tooltip title={t('label.log-plural')}>
                <Button
                  className="p-0"
                  data-testid="logs"
                  size="small"
                  type="link">
                  {t('label.log-plural')}
                </Button>
              </Tooltip>
            </Space>
          );
        },
      },
    ],
    []
  );

  const fetchAppHistory = useCallback(
    async (pagingOffset?: Paging) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getApplicationRuns(fqn, {
          offset: pagingOffset?.offset ?? 0,
          limit: pageSize,
        });

        setAppRunsHistoryData(data);
        handlePagingChange(paging);
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fqn, pageSize]
  );

  const handleAppHistoryPageChange = ({ currentPage }: PagingHandlerParams) => {
    handlePageChange(currentPage);
    fetchAppHistory({
      offset: currentPage * pageSize,
    } as Paging);
  };

  useEffect(() => {
    fetchAppHistory();
  }, [fqn]);

  return (
    <Row>
      <Col span={24}>
        <Table
          bordered
          columns={tableColumn}
          data-testid="app-run-history-table"
          dataSource={appRunsHistoryData}
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="name"
          size="small"
        />
      </Col>
      <Col span={20}>
        {paging.total > pageSize && (
          <div className="p-y-md">
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handleAppHistoryPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </Col>
    </Row>
  );
};

export default AppRunsHistory;
