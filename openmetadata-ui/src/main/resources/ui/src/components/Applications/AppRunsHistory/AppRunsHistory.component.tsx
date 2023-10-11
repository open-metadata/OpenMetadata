import { Button, Col, Row } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Status } from '../../../generated/entity/applications/appRunRecord';
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
import AppLogsViewer from '../AppLogsViewer/AppLogsViewer.component';
import { AppRunRecordWithId } from './AppRunsHistory.interface';

const AppRunsHistory = () => {
  const { t } = useTranslation();
  const { fqn } = useParams<{ fqn: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [appRunsHistoryData, setAppRunsHistoryData] = useState<
    AppRunRecordWithId[]
  >([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const {
    currentPage,
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    handlePageSizeChange,
  } = usePaging();

  const handleRowExpandable = useCallback(
    (key?: string) => {
      if (key) {
        if (expandedRowKeys.includes(key)) {
          setExpandedRowKeys((prev) => prev.filter((item) => item !== key));
        } else {
          setExpandedRowKeys((prev) => [...prev, key]);
        }
      }
    },
    [expandedRowKeys]
  );

  const tableColumn: ColumnsType<AppRunRecordWithId> = useMemo(
    () => [
      {
        title: t('label.run-at'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (_, record) => formatDateTime(record.timestamp),
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
        render: (_, record: AppRunRecordWithId) => {
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
        render: (_, record) => (
          <Button
            className="p-0"
            data-testid="logs"
            size="small"
            type="link"
            onClick={() => handleRowExpandable(record.id)}>
            {t('label.log-plural')}
          </Button>
        ),
      },
    ],
    [formatDateTime, handleRowExpandable, getStatusTypeForApplication]
  );

  const fetchAppHistory = useCallback(
    async (pagingOffset?: Paging) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getApplicationRuns(fqn, {
          offset: pagingOffset?.offset ?? 0,
          limit: pageSize,
        });

        setAppRunsHistoryData(
          data.map((item) => ({
            ...item,
            id: `${item.appId}-${item.runType}-${item.timestamp}`,
          }))
        );
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
          expandable={{
            expandedRowRender: (record) => <AppLogsViewer data={record} />,
            showExpandColumn: false,
            expandedRowKeys,
          }}
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
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
