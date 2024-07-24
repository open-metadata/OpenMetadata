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

import { Space } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DISABLED,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE,
} from '../../../../../constants/constants';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { usePaging } from '../../../../../hooks/paging/usePaging';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import {
  renderNameField,
  renderScheduleField,
  renderStatusField,
  renderTypeField,
} from '../../../../../utils/IngestionListTableUtils';
import { getErrorPlaceHolder } from '../../../../../utils/IngestionUtils';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import ButtonSkeleton from '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import Table from '../../../../common/Table/Table';
import { IngestionRecentRuns } from '../IngestionRecentRun/IngestionRecentRuns.component';
import { IngestionListTableProps } from './IngestionListTable.interface';
import PipelineActions from './PipelineActions/PipelineActions';

function IngestionListTable({
  triggerIngestion,
  deployIngestion,
  paging,
  handleEnableDisableIngestion,
  onIngestionWorkflowsUpdate,
  ingestionPipelinesPermission,
  serviceCategory,
  serviceName,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  ingestionData,
  pipelineType,
  isLoading = false,
  pipelineIdToFetchStatus = '',
  handlePipelineIdToFetchStatus,
  onPageChange,
  currentPage,
  airflowInformation,
}: Readonly<IngestionListTableProps>) {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const { pageSize, handlePageSizeChange, handlePagingChange, showPagination } =
    usePaging(PAGE_SIZE);

  useEffect(() => {
    handlePagingChange(paging);
  }, [paging]);

  const { isFetchingStatus, platform } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const isPlatFormDisabled = useMemo(() => platform === DISABLED, [platform]);

  const renderActionsField = (_: string, record: IngestionPipeline) => {
    if (isFetchingStatus) {
      return <ButtonSkeleton size="default" />;
    }

    if (isPlatFormDisabled) {
      return NO_DATA_PLACEHOLDER;
    }

    return (
      <PipelineActions
        deployIngestion={deployIngestion}
        handleDeleteSelection={handleDeleteSelection}
        handleEnableDisableIngestion={handleEnableDisableIngestion}
        handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
        ingestionPipelinesPermission={ingestionPipelinesPermission}
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
        render: renderNameField,
      },
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
        render: renderTypeField,
      },
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        width: 250,
        render: renderScheduleField,
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        width: 160,
        render: (_: string, record: IngestionPipeline) => (
          <IngestionRecentRuns
            classNames="align-middle"
            handlePipelineIdToFetchStatus={handlePipelineIdToFetchStatus}
            ingestion={record}
            pipelineIdToFetchStatus={pipelineIdToFetchStatus}
          />
        ),
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: renderStatusField,
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 180,
        render: renderActionsField,
      },
    ],
    [pipelineIdToFetchStatus, renderActionsField, handlePipelineIdToFetchStatus]
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
            ingestionData.length,
            isPlatFormDisabled,
            theme,
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
          pagingHandler={onPageChange}
          onShowSizeChange={handlePageSizeChange}
        />
      )}
    </Space>
  );
}

export default IngestionListTable;
