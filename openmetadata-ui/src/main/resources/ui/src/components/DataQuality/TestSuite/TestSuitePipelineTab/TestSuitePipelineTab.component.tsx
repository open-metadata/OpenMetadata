/*
 *  Copyright 2022 Collate.
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

import { PlusOutlined } from '@ant-design/icons';
import {
  Table,
  TableCard,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { HelpCircle } from '@untitledui/icons';
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { sortBy } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DISABLED, NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineType } from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { Table as TableType } from '../../../../generated/entity/data/table';
import { Operation } from '../../../../generated/entity/policies/accessControl/rule';
import {
  IngestionPipeline,
  StepSummary,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../../../generated/tests/testCase';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import {
  renderNameField,
  renderScheduleField,
  renderStatusField,
} from '../../../../utils/IngestionListTableUtils';
import { checkPermission } from '../../../../utils/PermissionsUtils';
import { getTestSuiteIngestionPath } from '../../../../utils/RouterUtils';
import { getServiceFromTestSuiteFQN } from '../../../../utils/TestSuiteUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import ButtonSkeleton from '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import IngestionStatusCount from '../../../Settings/Services/Ingestion/IngestionListTable/IngestionStatusCount/IngestionStatusCount';
import PipelineActions from '../../../Settings/Services/Ingestion/IngestionListTable/PipelineActions/PipelineActions';
import { IngestionRecentRuns } from '../../../Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component';

interface Props {
  testSuite: TableType['testSuite'] | TestSuite;
  isLogicalTestSuite?: boolean;
}

interface SelectedRowDetails {
  id: string;
  name: string;
  state: string;
}

interface PipelineTableRow extends IngestionPipeline {
  runId?: string;
  runStatus?: StepSummary;
  pipelinePermissions?: OperationPermission;
}

const TestSuitePipelineTab = ({
  testSuite,
  isLogicalTestSuite = false,
}: Props) => {
  const airflowInformation = useAirflowStatus();
  const { t } = useTranslation();
  const testSuiteFQN = testSuite?.fullyQualifiedName ?? testSuite?.name ?? '';

  const { permissions, getEntityPermissionByFqn } = usePermissionProvider();
  const pipelinePaging = usePaging();
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    pageSize,
    paging,
    showPagination,
  } = pipelinePaging;
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [testSuitePipelines, setTestSuitePipelines] = useState<
    IngestionPipeline[]
  >([]);
  const [pipelineIdToFetchStatus, setPipelineIdToFetchStatus] =
    useState<string>();
  const [ingestionPipelinePermissions, setIngestionPipelinePermissions] =
    useState<Map<string, OperationPermission>>();
  const permissionFetchId = useRef(0);
  const [deleteSelection, setDeleteSelection] = useState<SelectedRowDetails>({
    id: '',
    name: '',
    state: '',
  });

  const { isAirflowAvailable, isFetchingStatus, platform } = airflowInformation;

  const isPlatformDisabled = useMemo(() => platform === DISABLED, [platform]);

  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.INGESTION_PIPELINE,
        permissions
      ),
    [permissions]
  );

  const handlePipelineIdToFetchStatus = useCallback((pipelineId?: string) => {
    setPipelineIdToFetchStatus(pipelineId);
  }, []);

  const getAllIngestionWorkflows = useCallback(
    async (pagingValue?: Omit<Paging, 'total'>, limit?: number) => {
      try {
        setIsLoading(true);
        const response = await getIngestionPipelines({
          arrQueryFields: [
            TabSpecificField.OWNERS,
            TabSpecificField.PIPELINE_STATUSES,
          ],
          testSuite: testSuiteFQN,
          pipelineType: [PipelineType.TestSuite],
          paging: pagingValue,
          limit: limit ?? pageSize,
        });
        setTestSuitePipelines(response.data);
        handlePagingChange(response.paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [testSuiteFQN, pageSize, handlePagingChange]
  );

  const fetchIngestionPipelineExtraDetails = useCallback(async () => {
    if (!testSuitePipelines.length) {
      setIngestionPipelinePermissions(new Map<string, OperationPermission>());

      return;
    }

    permissionFetchId.current += 1;
    const fetchId = permissionFetchId.current;

    const permissionPromises = testSuitePipelines.map((item) =>
      getEntityPermissionByFqn(
        ResourceEntity.INGESTION_PIPELINE,
        item.fullyQualifiedName ?? ''
      )
    );

    const permissionResponse = await Promise.allSettled(permissionPromises);

    if (fetchId !== permissionFetchId.current) {
      return;
    }

    const permissionData = permissionResponse.reduce((acc, cv, index) => {
      if (cv.status === 'fulfilled') {
        acc.set(testSuitePipelines[index]?.name ?? '', cv.value);
      }

      return acc;
    }, new Map<string, OperationPermission>());

    setIngestionPipelinePermissions(permissionData);
  }, [testSuitePipelines, getEntityPermissionByFqn]);

  const handlePipelinePageChange = useCallback(
    ({ cursorType, currentPage: page }: PagingHandlerParams) => {
      if (cursorType) {
        getAllIngestionWorkflows(
          { [cursorType]: paging[cursorType] },
          pageSize
        );
        handlePageChange(page);
      }
    },
    [getAllIngestionWorkflows, paging, pageSize, handlePageChange]
  );

  const handleAddPipelineRedirection = () => {
    navigate({
      pathname: getTestSuiteIngestionPath(testSuiteFQN),
      search: isLogicalTestSuite
        ? QueryString.stringify({ testSuiteId: testSuite?.id })
        : undefined,
    });
  };

  const handleEnableDisableIngestion = useCallback(async (id: string) => {
    try {
      const { data } = await enableDisableIngestionPipelineById(id);
      if (data.id) {
        setTestSuitePipelines((list) =>
          list.map((row) =>
            row.id === id ? { ...row, enabled: data.enabled } : row
          )
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  }, []);

  const handleTriggerIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await triggerIngestionPipelineById(id);
        showSuccessToast('Pipeline triggered successfully');

        setPipelineIdToFetchStatus(id);
      } catch {
        showErrorToast(
          t('server.ingestion-workflow-operation-error', {
            operation: 'triggering',
            displayName,
          })
        );
      }
    },
    []
  );

  const handleDeployIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await deployIngestionPipelineById(id);
        showSuccessToast(
          t('message.pipeline-action-success-message', {
            action: t('label.deployed-lowercase'),
          })
        );

        setPipelineIdToFetchStatus(id);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.ingestion-workflow-operation-error', {
            operation: 'updating',
            displayName,
          })
        );
      }
    },
    []
  );

  const deleteIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await deleteIngestionPipelineById(id);
        setTestSuitePipelines((pipelines) =>
          pipelines.filter((ing) => ing.id !== id)
        );
        handlePagingChange((prevData) => ({
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
    [handlePagingChange]
  );

  const handleCancelConfirmationModal = useCallback(() => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({ id: '', name: '', state: '' });
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
    [deleteIngestion, handleCancelConfirmationModal]
  );

  const handleDeleteConfirm = useCallback(async () => {
    await handleDelete(deleteSelection.id, getEntityName(deleteSelection));
  }, [handleDelete, deleteSelection]);

  const dataSource = useMemo<PipelineTableRow[]>(() => {
    const sortedByTestCaseLength = sortBy(testSuitePipelines, (pipeline) => {
      const length = pipeline?.sourceConfig?.config?.testCases?.length;

      return length ? length : -Infinity;
    });

    return sortedByTestCaseLength.map((pipeline) => ({
      ...pipeline,
      key: pipeline.name,
      runStatus: pipeline.pipelineStatuses?.[0]?.status?.[0],
      runId: pipeline.pipelineStatuses?.[0]?.runId,
      pipelinePermissions: ingestionPipelinePermissions?.get(pipeline.name),
    }));
  }, [testSuitePipelines, ingestionPipelinePermissions]);

  const emptyPlaceholder = useMemo(
    () =>
      testSuite ? (
        <ErrorPlaceHolder
          button={
            <Button
              ghost
              className="p-x-lg"
              data-testid="add-placeholder-button"
              icon={<PlusOutlined />}
              type="primary"
              onClick={handleAddPipelineRedirection}>
              {t('label.add')}
            </Button>
          }
          heading={t('label.pipeline')}
          permission={createPermission}
          permissionValue={t('label.create-entity', {
            entity: t('label.test-suite-ingestion'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.ASSIGN}>
          {t('message.no-table-pipeline')}
        </ErrorPlaceHolder>
      ) : (
        <ErrorPlaceHolder
          placeholderText={t('message.no-test-suite-table-pipeline')}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      ),
    [testSuite, createPermission, t]
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

  useEffect(() => {
    getAllIngestionWorkflows(undefined, pageSize);
  }, [pageSize]);

  useEffect(() => {
    fetchIngestionPipelineExtraDetails();
  }, [fetchIngestionPipelineExtraDetails]);

  if (!isAirflowAvailable && !(isLoading || isFetchingStatus)) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <Row className="m-l-0 m-r-0 m-t-md m-b-md" gutter={[16, 16]}>
      {dataSource.length > 0 && (
        <Col className="d-flex justify-end" span={24}>
          <Button
            data-testid="add-pipeline-button"
            type="primary"
            onClick={handleAddPipelineRedirection}>
            {t('label.add-entity', { entity: t('label.pipeline') })}
          </Button>
        </Col>
      )}
      <Col span={24}>
        <TableCard.Root>
          <Table
            aria-label={t('label.pipeline')}
            data-testid="ingestion-list-table">
            <Table.Header
              columns={[
                { id: 'name', name: t('label.name') },
                {
                  id: 'testCases',
                  name: t('label.test-case-plural'),
                  headerContent: (
                    <Tooltip
                      placement="top"
                      title={t('message.test-case-count-info')}>
                      <TooltipTrigger
                        className="tw:flex tw:items-center tw:text-fg-quaternary tw:transition tw:duration-100 tw:ease-linear tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover"
                        data-testid="test-cases-info-tooltip-trigger">
                        <HelpCircle
                          className="tw:size-3"
                          data-testid="test-cases-info-tooltip-icon"
                        />
                      </TooltipTrigger>
                    </Tooltip>
                  ),
                },
                { id: 'count', name: t('label.count') },
                { id: 'schedule', name: t('label.schedule') },
                { id: 'recentRuns', name: t('label.recent-run-plural') },
                { id: 'status', name: t('label.status') },
                { id: 'actions', name: t('label.action-plural') },
              ]}>
              {(column) => (
                <Table.Head id={column.id} key={column.id} label={column.name}>
                  {column.headerContent}
                </Table.Head>
              )}
            </Table.Header>

            <Table.Body
              items={isLoading ? [] : dataSource}
              renderEmptyState={() => (isLoading ? <></> : emptyPlaceholder)}>
              {(item) => {
                const record = item;
                const testCasesCount =
                  record?.sourceConfig?.config?.testCases?.length ??
                  t('label.all');

                const permissions = record.pipelinePermissions;

                return (
                  <Table.Row
                    data-row-key={record.fullyQualifiedName}
                    id={record.id}
                    key={record.id}>
                    <Table.Cell className="tw:align-middle tw:w-72">
                      {renderNameField()(record.name, record)}
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-36">
                      <span data-testid={`test-case-count-${record.name}`}>
                        {testCasesCount}
                      </span>
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-44">
                      <IngestionStatusCount
                        runId={record.runId}
                        summary={record.runStatus}
                      />
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-44">
                      {renderScheduleField(record.name, record)}
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-44">
                      <IngestionRecentRuns
                        appRuns={record.pipelineStatuses}
                        classNames="align-middle"
                        fetchStatus={false}
                        handlePipelineIdToFetchStatus={
                          handlePipelineIdToFetchStatus
                        }
                        ingestion={record}
                        pipelineIdToFetchStatus={pipelineIdToFetchStatus}
                      />
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-28">
                      {renderStatusField(record.name, record)}
                    </Table.Cell>

                    <Table.Cell className="tw:align-middle tw:w-60">
                      {isFetchingStatus ? (
                        <ButtonSkeleton size="default" />
                      ) : isPlatformDisabled ? (
                        NO_DATA_PLACEHOLDER
                      ) : (
                        <PipelineActions
                          deployIngestion={handleDeployIngestion}
                          handleDeleteSelection={(row) =>
                            setDeleteSelection(row)
                          }
                          handleEnableDisableIngestion={
                            handleEnableDisableIngestion
                          }
                          handleIsConfirmationModalOpen={
                            setIsConfirmationModalOpen
                          }
                          ingestionPipelinePermissions={permissions}
                          pipeline={record}
                          serviceCategory={ServiceCategory.DATABASE_SERVICES}
                          serviceName={getServiceFromTestSuiteFQN(testSuiteFQN)}
                          triggerIngestion={handleTriggerIngestion}
                          onIngestionWorkflowsUpdate={getAllIngestionWorkflows}
                        />
                      )}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table>

          {showPagination && (
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handlePipelinePageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </TableCard.Root>
      </Col>

      <EntityDeleteModal
        bodyText={ingestionDeleteMessage}
        entityName={getEntityName(deleteSelection)}
        entityType={t('label.ingestion-lowercase')}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={handleDeleteConfirm}
      />
    </Row>
  );
};

export default TestSuitePipelineTab;
