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

import { Col, Row } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DISABLED,
  MAX_CHAR_LIMIT_ENTITY_SUMMARY,
  NO_DATA_PLACEHOLDER,
  pagingObject,
} from '../../../../../constants/constants';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { UseAirflowStatusProps } from '../../../../../hooks/useAirflowStatus';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { deleteIngestionPipelineById } from '../../../../../rest/ingestionPipelineAPI';
import { Transi18next } from '../../../../../utils/CommonUtils';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../../utils/EntityUtils';
import {
  renderNameField,
  renderScheduleField,
  renderStatusField,
  renderTypeField,
} from '../../../../../utils/IngestionListTableUtils';
import { getErrorPlaceHolder } from '../../../../../utils/IngestionUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import NextPrevious from '../../../../common/NextPrevious/NextPrevious';
import RichTextEditorPreviewerV1 from '../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import ButtonSkeleton from '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import Table from '../../../../common/Table/Table';
import EntityDeleteModal from '../../../../Modals/EntityDeleteModal/EntityDeleteModal';
import { SelectedRowDetails } from '../ingestion.interface';
import { IngestionRecentRuns } from '../IngestionRecentRun/IngestionRecentRuns.component';
import { IngestionListTableProps } from './IngestionListTable.interface';
import PipelineActions from './PipelineActions/PipelineActions';

function IngestionListTable({
  afterDeleteAction,
  airflowInformation,
  deployIngestion,
  emptyPlaceholder,
  enableActions = true,
  extraTableProps,
  handleEditClick,
  handleEnableDisableIngestion,
  handleIngestionListUpdate,
  handlePipelineIdToFetchStatus,
  ingestionData,
  ingestionPagingInfo,
  isLoading = false,
  isNumberBasedPaging = false,
  onIngestionWorkflowsUpdate,
  onPageChange,
  pipelineIdToFetchStatus = '',
  pipelineType,
  pipelineTypeColumnObj,
  serviceCategory,
  serviceName,
  showDescriptionCol,
  triggerIngestion,
  customRenderNameField,
  tableClassName,
  searchText,
}: Readonly<IngestionListTableProps>) {
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [deleteSelection, setDeleteSelection] = useState<SelectedRowDetails>({
    id: '',
    name: '',
    state: '',
  });
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [ingestionPipelinePermissions, setIngestionPipelinePermissions] =
    useState<IngestionServicePermission>();

  const handleDeleteSelection = useCallback((row: SelectedRowDetails) => {
    setDeleteSelection(row);
  }, []);

  const handleIsConfirmationModalOpen = useCallback(
    (value: boolean) => setIsConfirmationModalOpen(value),
    []
  );

  const deleteIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await deleteIngestionPipelineById(id);
        handleIngestionListUpdate?.((pipelines) =>
          pipelines.filter((ing) => ing.id !== id)
        );
        // Update the paging total count to reflect on tab count
        ingestionPagingInfo?.handlePagingChange?.((prevData) => ({
          ...prevData,
          total: prevData.total > 0 ? prevData.total - 1 : 0,
        }));
        showSuccessToast(
          t('message.pipeline-action-success-message', {
            action: t('label.deleted-lowercase'),
          })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.ingestion-workflow-operation-error', {
            operation: t('label.deleting-lowercase'),
            displayName,
          })
        );
      }
    },
    [handleIngestionListUpdate, ingestionPagingInfo]
  );

  const handleCancelConfirmationModal = useCallback(() => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
      state: '',
    });
  }, []);

  const handleDelete = useCallback(
    async (id: string, displayName: string) => {
      try {
        setDeleteSelection({ id, name: displayName, state: 'waiting' });
        await deleteIngestion(id, displayName);
      } finally {
        handleCancelConfirmationModal();
      }
    },
    [handleCancelConfirmationModal]
  );

  const fetchIngestionPipelinesPermission = useCallback(async () => {
    try {
      const promises = ingestionData.map((item) =>
        getEntityPermissionByFqn(
          ResourceEntity.INGESTION_PIPELINE,
          item.fullyQualifiedName ?? ''
        )
      );
      const response = await Promise.allSettled(promises);

      const permissionData = response.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionData?.[index].name]:
            cv.status === 'fulfilled' ? cv.value : {},
        };
      }, {});

      setIngestionPipelinePermissions(permissionData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [ingestionData]);

  const { isFetchingStatus, platform } = useMemo(
    () => airflowInformation ?? ({} as UseAirflowStatusProps),
    [airflowInformation]
  );

  const isPlatFormDisabled = useMemo(() => platform === DISABLED, [platform]);

  const handleDeleteConfirm = useCallback(async () => {
    await handleDelete(deleteSelection.id, getEntityName(deleteSelection));
    afterDeleteAction?.();
  }, [handleDelete, deleteSelection]);

  useEffect(() => {
    fetchIngestionPipelinesPermission();
  }, [ingestionData]);

  useEffect(() => {
    if (!isUndefined(ingestionPagingInfo)) {
      ingestionPagingInfo.handlePagingChange(
        ingestionPagingInfo.paging ?? pagingObject
      );
    }
  }, [ingestionPagingInfo?.paging]);

  const renderActionsField = useCallback(
    (_: string, record: IngestionPipeline) => {
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
          handleEditClick={handleEditClick}
          handleEnableDisableIngestion={handleEnableDisableIngestion}
          handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
          ingestionPipelinePermissions={ingestionPipelinePermissions}
          pipeline={record}
          serviceCategory={serviceCategory}
          serviceName={serviceName}
          triggerIngestion={triggerIngestion}
          onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
        />
      );
    },
    [
      isFetchingStatus,
      isPlatFormDisabled,
      deployIngestion,
      handleDeleteSelection,
      handleEnableDisableIngestion,
      handleIsConfirmationModalOpen,
      ingestionPipelinePermissions,
      serviceCategory,
      serviceName,
      triggerIngestion,
      onIngestionWorkflowsUpdate,
      handleEditClick,
    ]
  );

  const tableColumn: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: customRenderNameField ?? renderNameField(searchText),
      },
      ...(showDescriptionCol
        ? [
            {
              title: t('label.description'),
              dataIndex: 'description',
              key: 'description',
              render: (description: string) =>
                !isUndefined(description) && description.trim() ? (
                  <RichTextEditorPreviewerV1
                    markdown={highlightSearchText(description, searchText)}
                    maxLength={MAX_CHAR_LIMIT_ENTITY_SUMMARY}
                  />
                ) : (
                  <span className="text-grey-muted">
                    {t('label.no-entity', {
                      entity: t('label.description'),
                    })}
                  </span>
                ),
            },
          ]
        : []),
      ...(pipelineTypeColumnObj ?? [
        {
          title: t('label.type'),
          dataIndex: 'pipelineType',
          key: 'pipelineType',
          width: 120,
          render: renderTypeField(searchText),
        },
      ]),
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        width: 240,
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
        width: 100,
        render: renderStatusField,
      },
      ...(enableActions
        ? [
            {
              title: t('label.action-plural'),
              dataIndex: 'actions',
              key: 'actions',
              width: 180,
              render: renderActionsField,
            },
          ]
        : []),
    ],
    [
      pipelineIdToFetchStatus,
      renderActionsField,
      enableActions,
      handlePipelineIdToFetchStatus,
      pipelineTypeColumnObj,
    ]
  );

  const ingestionDeleteMessage = useMemo(
    () => (
      <Transi18next
        i18nKey="message.permanently-delete-ingestion-pipeline"
        renderElement={
          <span className="font-medium" data-testid="entityName" />
        }
        values={{
          entityName: getEntityName(deleteSelection),
        }}
      />
    ),
    [deleteSelection]
  );

  return (
    <>
      <Row className="m-b-md" data-testid="ingestion-table" gutter={[16, 16]}>
        <Col span={24}>
          <Table
            bordered
            className={tableClassName}
            columns={tableColumn}
            data-testid="ingestion-list-table"
            dataSource={ingestionData}
            loading={isLoading}
            locale={{
              emptyText:
                emptyPlaceholder ??
                getErrorPlaceHolder(
                  ingestionData.length,
                  isPlatFormDisabled,
                  theme,
                  pipelineType
                ),
            }}
            pagination={false}
            rowKey="fullyQualifiedName"
            size="small"
            {...extraTableProps}
          />
        </Col>

        {!isUndefined(ingestionPagingInfo) &&
          ingestionPagingInfo.showPagination &&
          onPageChange && (
            <Col span={24}>
              <NextPrevious
                currentPage={ingestionPagingInfo.currentPage}
                isLoading={isLoading}
                isNumberBased={isNumberBasedPaging}
                pageSize={ingestionPagingInfo.pageSize}
                paging={ingestionPagingInfo.paging}
                pagingHandler={onPageChange}
                onShowSizeChange={ingestionPagingInfo.handlePageSizeChange}
              />
            </Col>
          )}
      </Row>

      <EntityDeleteModal
        bodyText={ingestionDeleteMessage}
        entityName={getEntityName(deleteSelection)}
        entityType={t('label.ingestion-lowercase')}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}

export default IngestionListTable;
