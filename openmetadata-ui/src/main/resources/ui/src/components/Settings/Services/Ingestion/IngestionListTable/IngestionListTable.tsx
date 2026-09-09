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
import { SORT_ORDER } from '../../../../../enums/common.enum';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { deleteIngestionPipelineById } from '../../../../../rest/ingestionPipelineAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { highlightSearchText } from '../../../../../utils/EntitySearchUtils';
import { columnSorter } from '../../../../../utils/EntitySortUtils';
import { Transi18next } from '../../../../../utils/i18next/LocalUtil';
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
import DeleteModal from '../../../../common/DeleteModal/DeleteModal';
import RichTextEditorPreviewerNew from '../../../../common/RichTextEditor/RichTextEditorPreviewNew';
import ButtonSkeleton from '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import Table from '../../../../common/Table/Table';
import { ColumnsType } from '../../../../common/Table/Table.interface';
import { SelectedRowDetails } from '../ingestion.interface';
import { IngestionRecentRuns } from '../IngestionRecentRun/IngestionRecentRuns.component';
import './ingestion-list-table.less';
import {
  IngestionListTableProps,
  ModifiedIngestionPipeline,
} from './IngestionListTable.interface';
import IngestionStatusCount from './IngestionStatusCount/IngestionStatusCount';
import PipelineActions from './PipelineActions/PipelineActions';

// Derived from symbols already in scope rather than imported from antd directly: tw-guard blocks
// new antd specifiers, and this file's table is legacy AntD that is not being migrated here.
type AntdSortOrder = ColumnsType<IngestionPipeline>[number]['sortOrder'];
type AntdTableChangeHandler = NonNullable<
  NonNullable<IngestionListTableProps['extraTableProps']>['onChange']
>;

const INGESTION_EMPTY_CARD_CLASS = 'tw:relative tw:py-8';

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
  sortOrder,
  onSortChange,
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

  const data: ModifiedIngestionPipeline[] = useMemo(
    () =>
      ingestionData.map((item) => ({
        ...item,
        runStatus: item.pipelineStatuses?.[0]?.status?.[0],
        runId: item.pipelineStatuses?.[0]?.runId,
      })),
    [ingestionData]
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

  const fetchIngestionPipelineExtraDetails = useCallback(() => {
    const permissionPromises = ingestionData.map((item) =>
      getEntityPermissionByFqn(
        ResourceEntity.INGESTION_PIPELINE,
        item.fullyQualifiedName ?? ''
      )
    );

    Promise.allSettled(permissionPromises).then((permissionResponse) => {
      const permissionData = permissionResponse.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionData?.[index].name]:
            cv.status === 'fulfilled' ? cv.value : {},
        };
      }, {});
      setIngestionPipelinePermissions(permissionData);
    });
  }, [ingestionData]);

  const { isAirflowAvailable, isFetchingStatus, platform } = useMemo(
    () => airflowInformation ?? ({} as AirflowStatusContextType),
    [airflowInformation]
  );

  const isPlatFormDisabled = useMemo(() => platform === DISABLED, [platform]);

  // `isAirflowAvailable` is seeded false, so it only reads as "unreachable" once the status call
  // has answered.
  const isAirflowUnavailable = !isFetchingStatus && !isAirflowAvailable;

  // The pipeline list is fetched independently of the airflow status now, so an empty table here
  // really does mean "none exist". `AirflowMessageBanner` carries the unreachable case.
  const defaultEmptyPlaceholder = useMemo(
    () =>
      getErrorPlaceHolder(
        ingestionData.length,
        isPlatFormDisabled,
        theme,
        pipelineType,
        INGESTION_EMPTY_CARD_CLASS
      ),
    [ingestionData.length, isPlatFormDisabled, pipelineType, theme]
  );

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
          ingestionPipelinePermissions={
            ingestionPipelinePermissions?.[record.name]
          }
          isDisabled={isAirflowUnavailable}
          pipeline={record}
          serviceCategory={serviceCategory}
          serviceName={serviceName}
          triggerIngestion={triggerIngestion}
          onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
        />
      );
    },
    [
      isAirflowUnavailable,
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

  const isServerSorted = !isUndefined(onSortChange);

  const antdSortOrder = useMemo<AntdSortOrder>(() => {
    let order: AntdSortOrder = null;
    if (sortOrder === SORT_ORDER.ASC) {
      order = 'ascend';
    } else if (sortOrder === SORT_ORDER.DESC) {
      order = 'descend';
    }

    return order;
  }, [sortOrder]);

  const toSortOrder = (order?: AntdSortOrder): SORT_ORDER | undefined => {
    let updatedSortOrder: SORT_ORDER | undefined;
    if (order === 'ascend') {
      updatedSortOrder = SORT_ORDER.ASC;
    } else if (order === 'descend') {
      updatedSortOrder = SORT_ORDER.DESC;
    }

    return updatedSortOrder;
  };

  // AntD reports sort, filter and pagination through the same `onChange`. Only the sort action is
  // ours; everything else stays with the caller's handler, which must still receive every action.
  const handleTableChange = useCallback<AntdTableChangeHandler>(
    (pagination, filters, sorter, extra) => {
      extraTableProps?.onChange?.(pagination, filters, sorter, extra);

      if (extra.action === 'sort' && onSortChange) {
        const order = Array.isArray(sorter) ? sorter[0]?.order : sorter.order;
        onSortChange(toSortOrder(order));
      }
    },
    [extraTableProps, onSortChange]
  );

  const tableColumn: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.name'),
        className: 'name-column',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left' as FixedType,
        // Sort on the same value the cell renders (getEntityName), not the raw
        // `name`: agents created from the UI get a machine-generated name that
        // has no relation to the label the user sees. `sorter: true` hands
        // ordering to the server so it spans every page, not just the loaded one.
        ...(isServerSorted
          ? { sorter: true, sortOrder: antdSortOrder }
          : { sorter: columnSorter }),
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
          return isLoading ? (
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
        width: 180,
        render: (_: string, record: IngestionPipeline) => (
          <IngestionRecentRuns
            appRuns={record.pipelineStatuses}
            classNames="align-middle"
            fetchStatus={false}
            handlePipelineIdToFetchStatus={handlePipelineIdToFetchStatus}
            ingestion={record}
            isAppRunsLoading={isLoading}
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
      isLoading,
      isServerSorted,
      antdSortOrder,
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
            emptyText: emptyPlaceholder ?? defaultEmptyPlaceholder,
          }}
          pagination={false}
          rowKey="fullyQualifiedName"
          scroll={data.length > 0 ? { x: 1300 } : undefined}
          size="small"
          {...extraTableProps}
          onChange={handleTableChange}
        />
      </div>

      <DeleteModal
        entityTitle={getEntityName(deleteSelection)}
        isDeleting={deleteSelection.state === 'waiting'}
        message={ingestionDeleteMessage}
        open={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onDelete={handleDeleteConfirm}
      />
    </>
  );
}

export default IngestionListTable;
