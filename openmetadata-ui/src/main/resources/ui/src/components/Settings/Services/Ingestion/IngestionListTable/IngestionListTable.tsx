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

import { Skeleton } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import { FixedType } from 'rc-table/lib/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DISABLED,
  MAX_CHAR_LIMIT_ENTITY_SUMMARY,
  NO_DATA_PLACEHOLDER,
  pagingObject,
} from '../../../../../constants/constants';
import { AirflowStatusContextType } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider.interface';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import {
  deleteIngestionPipelineById,
  getRunHistoryForPipeline,
} from '../../../../../rest/ingestionPipelineAPI';
import { Transi18next } from '../../../../../utils/CommonUtils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../../utils/date-time/DateTimeUtils';
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
import RichTextEditorPreviewerNew from '../../../../common/RichTextEditor/RichTextEditorPreviewNew';
import ButtonSkeleton from '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import Table from '../../../../common/Table/Table';
import EntityDeleteModal from '../../../../Modals/EntityDeleteModal/EntityDeleteModal';
import { SelectedRowDetails } from '../ingestion.interface';
import { IngestionRecentRuns } from '../IngestionRecentRun/IngestionRecentRuns.component';
import './ingestion-list-table.less';
import {
  IngestionListTableProps,
  ModifiedIngestionPipeline,
} from './IngestionListTable.interface';
import IngestionStatusCount from './IngestionStatusCount/IngestionStatusCount';
import PipelineActions from './PipelineActions/PipelineActions';

function IngestionListTable({
  tableContainerClassName = '',
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
  const [recentRunStatuses, setRecentRunStatuses] = useState<
    Record<string, PipelineStatus[]>
  >({});
  const [isIngestionRunsLoading, setIsIngestionRunsLoading] = useState(false);

  const handleDeleteSelection = useCallback((row: SelectedRowDetails) => {
    setDeleteSelection(row);
  }, []);

  const handleIsConfirmationModalOpen = useCallback(
    (value: boolean) => setIsConfirmationModalOpen(value),
    []
  );

  const data: ModifiedIngestionPipeline[] = useMemo(
    () =>
      ingestionData.map((item) => ({
        ...item,
        runStatus: recentRunStatuses?.[item.name]?.[0]?.status?.[0],
        runId: recentRunStatuses?.[item.name]?.[0]?.runId,
      })),
    [ingestionData, recentRunStatuses]
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

  const fetchIngestionPipelineExtraDetails = useCallback(async () => {
    try {
      setIsIngestionRunsLoading(true);
      const queryParams = {
        startTs: getEpochMillisForPastDays(1),
        endTs: getCurrentMillis(),
      };
      const permissionPromises = ingestionData.map((item) =>
        getEntityPermissionByFqn(
          ResourceEntity.INGESTION_PIPELINE,
          item.fullyQualifiedName ?? ''
        )
      );
      const recentRunStatusPromises = ingestionData.map((item) =>
        getRunHistoryForPipeline(item.fullyQualifiedName ?? '', queryParams)
      );
      const permissionResponse = await Promise.allSettled(permissionPromises);
      const recentRunStatusResponse = await Promise.allSettled(
        recentRunStatusPromises
      );

      const permissionData = permissionResponse.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionData?.[index].name]:
            cv.status === 'fulfilled' ? cv.value : {},
        };
      }, {});

      const recentRunStatusData = recentRunStatusResponse.reduce(
        (acc, cv, index) => {
          let value: PipelineStatus[] = [];

          if (cv.status === 'fulfilled') {
            const runs = cv.value.data ?? [];

            const ingestion = ingestionData[index];

            value =
              runs.length === 0 && ingestion?.pipelineStatuses
                ? [ingestion.pipelineStatuses]
                : runs;
          }

          return {
            ...acc,
            [ingestionData?.[index].name]: value,
          };
        },
        {}
      );
      setIngestionPipelinePermissions(permissionData);
      setRecentRunStatuses(recentRunStatusData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsIngestionRunsLoading(false);
    }
  }, [ingestionData]);

  const { isFetchingStatus, platform } = useMemo(
    () => airflowInformation ?? ({} as AirflowStatusContextType),
    [airflowInformation]
  );

  const isPlatFormDisabled = useMemo(() => platform === DISABLED, [platform]);

  const handleDeleteConfirm = useCallback(async () => {
    await handleDelete(deleteSelection.id, getEntityName(deleteSelection));
    afterDeleteAction?.();
  }, [handleDelete, deleteSelection]);

  useEffect(() => {
    if (!isEmpty(ingestionData)) {
      fetchIngestionPipelineExtraDetails();
    }
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
        className: 'name-column',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left' as FixedType,
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
                  <RichTextEditorPreviewerNew
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
          width: 150,
          render: renderTypeField(searchText),
        },
      ]),
      {
        title: t('label.count'),
        dataIndex: 'count',
        key: 'count',
        width: 300,
        render: (_: string, record: ModifiedIngestionPipeline) => {
          return isIngestionRunsLoading ? (
            <Skeleton.Input active size="small" />
          ) : (
            <IngestionStatusCount
              runId={record.runId}
              summary={record.runStatus}
            />
          );
        },
      },
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        width: 150,
        render: renderScheduleField,
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        width: 150,
        render: (_: string, record: IngestionPipeline) => (
          <IngestionRecentRuns
            appRuns={recentRunStatuses[record.name]}
            classNames="align-middle"
            fetchStatus={false}
            handlePipelineIdToFetchStatus={handlePipelineIdToFetchStatus}
            ingestion={record}
            isAppRunsLoading={isIngestionRunsLoading}
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
              width: 240,
              fixed: 'right' as FixedType,
              render: renderActionsField,
            },
          ]
        : []),
    ],
    [
      customRenderNameField,
      showDescriptionCol,
      searchText,
      pipelineIdToFetchStatus,
      renderActionsField,
      enableActions,
      handlePipelineIdToFetchStatus,
      pipelineTypeColumnObj,
      recentRunStatuses,
      isIngestionRunsLoading,
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
      <div
        className={classNames('ingestion-list-table', tableContainerClassName)}
        data-testid="ingestion-table">
        <Table
          columns={tableColumn}
          containerClassName={tableClassName}
          {...(!isUndefined(ingestionPagingInfo) &&
          ingestionPagingInfo.showPagination &&
          onPageChange
            ? {
                customPaginationProps: {
                  ...ingestionPagingInfo,
                  isLoading,
                  isNumberBased: isNumberBasedPaging,
                  pagingHandler: onPageChange,
                  showPagination: true,
                  onShowSizeChange: ingestionPagingInfo.handlePageSizeChange,
                },
              }
            : {})}
          data-testid="ingestion-list-table"
          dataSource={data}
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
          scroll={{ x: 1300 }}
          size="small"
          {...extraTableProps}
        />
      </div>

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
