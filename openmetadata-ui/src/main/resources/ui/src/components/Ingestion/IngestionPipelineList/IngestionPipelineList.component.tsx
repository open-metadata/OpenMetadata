/*
 *  Copyright 2023 Collate.
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
import { Button, Col, Row, Tooltip } from 'antd';
import { ColumnsType, TableProps } from 'antd/lib/table';
import { AxiosError } from 'axios';
import cronstrue from 'cronstrue';
import { isNil, map, startCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import {
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../rest/ingestionPipelineAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServiceUtils';
import { FilterIcon } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import NextPrevious from '../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../common/NextPrevious/NextPrevious.interface';
import Table from '../../common/Table/Table';
import Loader from '../../Loader/Loader';
import { ColumnFilter } from '../../Table/ColumnFilter/ColumnFilter.component';
import { IngestionRecentRuns } from '../IngestionRecentRun/IngestionRecentRuns.component';

export const IngestionPipelineList = ({
  serviceName,
}: {
  serviceName: ServiceCategory;
}) => {
  const [pipelines, setPipelines] = useState<Array<IngestionPipeline>>();

  const { isAirflowAvailable, isFetchingStatus } = useAirflowStatus();

  const [selectedPipelines, setSelectedPipelines] = useState<
    Array<IngestionPipeline>
  >([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<React.Key>>([]);
  const [deploying, setDeploying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipelineTypeFilter, setPipelineTypeFilter] =
    useState<PipelineType[]>();

  const {
    currentPage,
    handlePageChange,
    paging,
    handlePagingChange,
    pageSize,
    handlePageSizeChange,
    showPagination,
  } = usePaging();

  const { t } = useTranslation();

  const renderNameField = (_: string, record: IngestionPipeline) => {
    return getEntityName(record);
  };

  const renderScheduleField = (_: string, record: IngestionPipeline) => {
    return record.airflowConfig?.scheduleInterval ? (
      <Tooltip
        placement="bottom"
        title={cronstrue.toString(record.airflowConfig.scheduleInterval, {
          use24HourTimeFormat: true,
          verbose: true,
        })}>
        {record.airflowConfig.scheduleInterval}
      </Tooltip>
    ) : (
      <span>--</span>
    );
  };

  const tableColumn: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 500,
        render: renderNameField,
      },
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
        filterDropdown: ColumnFilter,
        filterIcon: FilterIcon,
        filters: map(PipelineType, (value) => ({
          text: startCase(value),
          value,
        })),
        filtered: !isNil(pipelineTypeFilter),
        filteredValue: pipelineTypeFilter,
      },
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        render: renderScheduleField,
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        width: 180,
        render: (_, record) => (
          <IngestionRecentRuns classNames="align-middle" ingestion={record} />
        ),
      },
    ],
    [renderScheduleField, renderNameField]
  );

  const handleBulkRedeploy = async () => {
    const selectedPipelines =
      pipelines?.filter(
        (p) =>
          p.fullyQualifiedName &&
          selectedRowKeys.indexOf(p.fullyQualifiedName) > -1
      ) ?? [];

    const promises = (selectedPipelines ?? [])?.map((pipeline) =>
      deployIngestionPipelineById(pipeline.id ?? '')
    );

    setDeploying(true);

    try {
      await Promise.all(promises);

      showSuccessToast(
        `${t('label.pipeline-plural')}  ${t('label.re-deploy')}  ${t(
          'label.successfully-lowercase'
        )}`
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.ingestion-workflow-operation-error', {
          operation: 'updating',
          displayName: '',
        })
      );
    } finally {
      setPipelineTypeFilter(undefined);
      setSelectedRowKeys([]);
      setDeploying(false);
    }
  };

  const fetchPipelines = async ({
    cursor,
    pipelineType,
    limit,
  }: {
    cursor?: string;
    pipelineType?: PipelineType[];
    limit?: number;
  }) => {
    setLoading(true);
    try {
      const { data, paging } = await getIngestionPipelines({
        arrQueryFields: ['owner'],
        serviceType: getEntityTypeFromServiceCategory(serviceName),
        paging: cursor,
        pipelineType,
        limit,
      });

      setPipelines(data);
      handlePagingChange(paging);
    } catch {
      // Error
    } finally {
      setLoading(false);
    }
  };

  const handlePipelinePageChange = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      const pagingString = `&${cursorType}=${paging[cursorType]}`;

      fetchPipelines({ cursor: pagingString, limit: pageSize });
      handlePageChange(currentPage);
    }
  };

  useEffect(() => {
    isAirflowAvailable && fetchPipelines({ limit: pageSize });
  }, [serviceName, isAirflowAvailable]);

  const handleTableChange: TableProps<IngestionPipeline>['onChange'] = (
    _pagination,
    filters
  ) => {
    const pipelineType = filters.pipelineType as PipelineType[];
    setPipelineTypeFilter(pipelineType);
    fetchPipelines({
      pipelineType,
      limit: pageSize,
    });
  };

  const handlePipelinePageSizeChange = (size: number) => {
    handlePageSizeChange(size);
    fetchPipelines({ pipelineType: pipelineTypeFilter, limit: size });
  };

  if (isFetchingStatus) {
    return <Loader />;
  }

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <Row gutter={[16, 16]}>
      <Col className="text-right" span={24}>
        <Button
          disabled={selectedPipelines?.length === 0}
          loading={deploying}
          type="primary"
          onClick={handleBulkRedeploy}>
          {t('label.re-deploy')}
        </Button>
      </Col>
      <Col span={24}>
        <Table
          bordered
          columns={tableColumn}
          dataSource={pipelines}
          loading={loading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="fullyQualifiedName"
          rowSelection={{
            type: 'checkbox',
            onChange: (
              selectedRowKeys: React.Key[],
              selectedRows: IngestionPipeline[]
            ) => {
              setSelectedPipelines(selectedRows);
              setSelectedRowKeys(selectedRowKeys);
            },
            getCheckboxProps: (record: IngestionPipeline) => ({
              name: record.fullyQualifiedName,
            }),
            selectedRowKeys,
          }}
          size="small"
          onChange={handleTableChange}
        />
      </Col>
      <Col span={24}>
        {showPagination && (
          <NextPrevious
            currentPage={currentPage}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={handlePipelinePageChange}
            onShowSizeChange={handlePipelinePageSizeChange}
          />
        )}
      </Col>
    </Row>
  );
};
