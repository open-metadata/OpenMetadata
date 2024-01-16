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

import { Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cronstrue from 'cronstrue';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../components/common/Table/Table';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { usePaging } from '../../hooks/paging/usePaging';
import { getEntityName } from '../../utils/EntityUtils';
import { getErrorPlaceHolder } from '../../utils/IngestionUtils';
import NextPrevious from '../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { IngestionListTableProps } from './IngestionListTable.interface';
import { IngestionRecentRuns } from './IngestionRecentRun/IngestionRecentRuns.component';
import PipelineActions from './PipelineActions.component';

function IngestionListTable({
  airflowEndpoint,
  triggerIngestion,
  deployIngestion,
  isRequiredDetailsAvailable,
  paging,
  handleEnableDisableIngestion,
  onIngestionWorkflowsUpdate,
  ingestionPipelinesPermission,
  serviceCategory,
  serviceName,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  ingestionData,
  deleteSelection,
  permissions,
  pipelineType,
  isLoading = false,
}: IngestionListTableProps) {
  const { t } = useTranslation();

  const {
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    showPagination,
  } = usePaging(10);

  useEffect(() => {
    handlePagingChange(paging);
  }, [paging]);

  const ingestionPagingHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        onIngestionWorkflowsUpdate(
          { [cursorType]: paging[cursorType] },
          pageSize
        );
        handlePageChange(currentPage);
      }
    },
    [paging, handlePageChange, onIngestionWorkflowsUpdate, pageSize]
  );

  const handlePipelinePageSizeChange = useCallback((pageSize: number) => {
    handlePageSizeChange(pageSize);
    onIngestionWorkflowsUpdate({}, pageSize);
  }, []);

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

  const renderActionsField = (_: string, record: IngestionPipeline) => {
    return (
      <PipelineActions
        deleteSelection={deleteSelection}
        deployIngestion={deployIngestion}
        handleDeleteSelection={handleDeleteSelection}
        handleEnableDisableIngestion={handleEnableDisableIngestion}
        handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
        ingestionPipelinesPermission={ingestionPipelinesPermission}
        isRequiredDetailsAvailable={isRequiredDetailsAvailable}
        record={record}
        serviceCategory={serviceCategory}
        serviceName={serviceName}
        triggerIngestion={triggerIngestion}
        onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
      />
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
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        render: renderActionsField,
      },
    ],
    [
      permissions,
      airflowEndpoint,
      deployIngestion,
      triggerIngestion,
      isRequiredDetailsAvailable,
      handleEnableDisableIngestion,
      ingestionPipelinesPermission,
      serviceName,
      deleteSelection,
      handleDeleteSelection,
      serviceCategory,
      handleIsConfirmationModalOpen,
      onIngestionWorkflowsUpdate,
      ingestionData,
    ]
  );

  return (
    <Space
      className="m-b-md w-full"
      data-testid="ingestion-table"
      direction="vertical"
      size="large">
      <Table
        bordered
        columns={tableColumn}
        data-testid="ingestion-list-table"
        dataSource={ingestionData}
        loading={isLoading}
        locale={{
          emptyText: getErrorPlaceHolder(
            isRequiredDetailsAvailable,
            ingestionData.length,
            pipelineType
          ),
        }}
        pagination={false}
        rowKey="name"
        size="small"
      />

      {showPagination && (
        <NextPrevious
          currentPage={currentPage}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={ingestionPagingHandler}
          onShowSizeChange={handlePipelinePageSizeChange}
        />
      )}
    </Space>
  );
}

export default IngestionListTable;
