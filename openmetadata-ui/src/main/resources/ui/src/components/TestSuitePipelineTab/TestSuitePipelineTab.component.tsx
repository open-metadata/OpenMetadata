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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Col, Popover, Row, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import cronstrue from 'cronstrue';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from 'rest/ingestionPipelineAPI';
import { fetchAirflowConfig } from 'rest/miscAPI';
import { Operation } from '../../generated/entity/policies/policy';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { getLoadingStatus } from '../../utils/CommonUtils';
import { checkPermission, userPermissions } from '../../utils/PermissionsUtils';
import {
  getLogsViewerPath,
  getTestSuiteIngestionPath,
} from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../common/error-with-placeholder/ErrorPlaceHolderIngestion';
import { IngestionRecentRuns } from '../Ingestion/IngestionRecentRun/IngestionRecentRuns.component';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import KillIngestionModal from '../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import TestCaseCommonTabContainer from '../TestCaseCommonTabContainer/TestCaseCommonTabContainer.component';

const TestSuitePipelineTab = () => {
  const { isAirflowAvailable, isFetchingStatus } = useAirflowStatus();
  const { t } = useTranslation();
  const { testSuiteFQN } = useParams<Record<string, string>>();
  const { permissions } = usePermissionProvider();
  const history = useHistory();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [testSuitePipelines, setTestSuitePipelines] = useState<
    IngestionPipeline[]
  >([]);
  const [airFlowEndPoint, setAirFlowEndPoint] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
    state: '',
  });
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [currDeployId, setCurrDeployId] = useState({ id: '', state: '' });

  const testSuitePath = useMemo(
    () => location.pathname.split('/')[1],
    [location]
  );

  const viewPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(
        ResourceEntity.INGESTION_PIPELINE,
        permissions
      ),
    [permissions]
  );
  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.INGESTION_PIPELINE,
        permissions
      ),
    [permissions]
  );

  const deletePermission = useMemo(
    () =>
      checkPermission(
        Operation.Delete,
        ResourceEntity.INGESTION_PIPELINE,
        permissions
      ),
    [permissions]
  );

  const editPermission = useMemo(
    () =>
      checkPermission(
        Operation.EditAll,
        ResourceEntity.INGESTION_PIPELINE,
        permissions
      ),
    [permissions]
  );

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
      state: '',
    });
  };

  const getAllIngestionWorkflows = async (paging?: string) => {
    try {
      setIsLoading(true);
      const response = await getIngestionPipelines(
        ['owner', 'pipelineStatuses'],
        testSuiteFQN,
        paging
      );
      setTestSuitePipelines(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, displayName: string) => {
    setDeleteSelection({ id, name: displayName, state: 'waiting' });
    try {
      await deleteIngestionPipelineById(id);
      setDeleteSelection({ id, name: displayName, state: 'success' });
      getAllIngestionWorkflows();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.ingestion-workflow-operation-error', {
          operation: 'deleting',
          displayName,
        })
      );
    } finally {
      handleCancelConfirmationModal();
    }
  };

  const fetchAirFlowEndPoint = async () => {
    try {
      const response = await fetchAirflowConfig();
      setAirFlowEndPoint(response.apiEndpoint);
    } catch {
      setAirFlowEndPoint('');
    }
  };

  const handleEnableDisableIngestion = async (id: string) => {
    try {
      await enableDisableIngestionPipelineById(id);
      getAllIngestionWorkflows();
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  };

  const separator = (
    <span className="tw-inline-block tw-text-gray-400 tw-self-center">|</span>
  );

  const confirmDelete = (id: string, name: string) => {
    setDeleteSelection({
      id,
      name,
      state: '',
    });
    setIsConfirmationModalOpen(true);
  };

  const handleTriggerIngestion = async (id: string, displayName: string) => {
    setCurrTriggerId({ id, state: 'waiting' });

    try {
      await triggerIngestionPipelineById(id);
      setCurrTriggerId({ id, state: 'success' });
      setTimeout(() => {
        setCurrTriggerId({ id: '', state: '' });
        showSuccessToast('Pipeline triggered successfully');
      }, 1500);
      getAllIngestionWorkflows();
    } catch (error) {
      showErrorToast(
        t('server.ingestion-workflow-operation-error', {
          operation: 'triggering',
          displayName,
        })
      );
      setCurrTriggerId({ id: '', state: '' });
    }
  };

  const handleDeployIngestion = async (id: string, reDeployed: boolean) => {
    setCurrDeployId({ id, state: 'waiting' });

    try {
      await deployIngestionPipelineById(id);
      setCurrDeployId({ id, state: 'success' });
      setTimeout(() => setCurrDeployId({ id: '', state: '' }), 1500);
      showSuccessToast(
        `${t('label.pipeline')}  ${
          reDeployed ? t('label.re-deploy') : t('label.deployed')
        }  ${t('label.successfully-small')}`
      );
    } catch (error) {
      setCurrDeployId({ id: '', state: '' });
      showErrorToast(
        error as AxiosError,
        t('server.ingestion-workflow-operation-error', {
          operation: 'updating',
          displayName: '',
        })
      );
    }
  };

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <>
          <Tooltip
            title={
              editPermission
                ? t('label.run')
                : t('message.no-permission-for-action')
            }>
            <Button
              data-testid="run"
              disabled={!editPermission}
              type="link"
              onClick={() =>
                handleTriggerIngestion(ingestion.id as string, ingestion.name)
              }>
              {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
            </Button>
          </Tooltip>
          {separator}
          <Tooltip
            title={
              editPermission
                ? t('label.re-deploy')
                : t('message.no-permission-for-action')
            }>
            <Button
              data-testid="re-deploy-btn"
              disabled={!editPermission}
              type="link"
              onClick={() =>
                handleDeployIngestion(ingestion.id as string, true)
              }>
              {getLoadingStatus(
                currDeployId,
                ingestion.id,
                t('label.re-deploy')
              )}
            </Button>
          </Tooltip>
        </>
      );
    } else {
      return (
        <Tooltip
          title={
            editPermission
              ? t('label.deploy')
              : t('message.no-permission-for-action')
          }>
          <Button
            data-testid="deploy"
            disabled={!editPermission}
            type="link"
            onClick={() =>
              handleDeployIngestion(ingestion.id as string, false)
            }>
            {getLoadingStatus(currDeployId, ingestion.id, t('label.deploy'))}
          </Button>
        </Tooltip>
      );
    }
  };

  useEffect(() => {
    getAllIngestionWorkflows();
    fetchAirFlowEndPoint();
  }, []);

  const pipelineColumns = useMemo(() => {
    const column: ColumnsType<IngestionPipeline> = [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => {
          return (
            <Tooltip
              title={
                viewPermission ? name : t('message.no-permission-to-view')
              }>
              <Button type="link">
                <a
                  className="link-text tw-mr-2"
                  data-testid="airflow-tree-view"
                  href={`${airFlowEndPoint}`}
                  rel="noopener noreferrer"
                  target="_blank">
                  {name}
                  <SVGIcons
                    alt="external-link"
                    className="tw-align-middle tw-ml-1"
                    icon={Icons.EXTERNAL_LINK}
                    width="16px"
                  />
                </a>
              </Button>
            </Tooltip>
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
      },
      {
        title: t('label.schedule'),
        dataIndex: 'airflowConfig',
        key: 'airflowEndpoint',
        render: (_, record) => {
          return (
            <>
              {record?.airflowConfig.scheduleInterval ? (
                <Popover
                  content={
                    <div>
                      {cronstrue.toString(
                        record.airflowConfig.scheduleInterval || '',
                        {
                          use24HourTimeFormat: true,
                          verbose: true,
                        }
                      )}
                    </div>
                  }
                  placement="bottom"
                  trigger="hover">
                  <span>{record.airflowConfig.scheduleInterval ?? '--'}</span>
                </Popover>
              ) : (
                <span>--</span>
              )}
            </>
          );
        },
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'pipelineStatuses',
        key: 'recentRuns',
        render: (_, record) => (
          <Row align="middle">
            <IngestionRecentRuns ingestion={record} />
          </Row>
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => {
          return (
            <>
              <div className="tw-flex">
                {record.enabled ? (
                  <Fragment>
                    {getTriggerDeployButton(record)}
                    {separator}
                    <Tooltip
                      title={
                        editPermission
                          ? t('label.pause')
                          : t('message.no-permission-for-action')
                      }>
                      <Button
                        data-testid="pause"
                        disabled={!editPermission}
                        type="link"
                        onClick={() =>
                          handleEnableDisableIngestion(record.id || '')
                        }>
                        {t('label.pause')}
                      </Button>
                    </Tooltip>
                  </Fragment>
                ) : (
                  <Tooltip
                    title={
                      editPermission
                        ? t('label.unpause')
                        : t('message.no-permission-for-action')
                    }>
                    <Button
                      data-testid="unpause"
                      disabled={!editPermission}
                      type="link"
                      onClick={() =>
                        handleEnableDisableIngestion(record.id || '')
                      }>
                      {t('label.unpause')}
                    </Button>
                  </Tooltip>
                )}
                {separator}
                <Tooltip
                  title={
                    editPermission
                      ? t('label.edit')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    data-testid="edit"
                    disabled={!editPermission}
                    type="link"
                    onClick={() => {
                      history.push(
                        getTestSuiteIngestionPath(
                          testSuiteFQN,
                          record.fullyQualifiedName
                        )
                      );
                    }}>
                    Edit
                  </Button>
                </Tooltip>
                {separator}
                <Tooltip
                  title={
                    deletePermission
                      ? t('label.delete')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    data-testid="delete"
                    disabled={!deletePermission}
                    type="link"
                    onClick={() =>
                      confirmDelete(record.id as string, record.name)
                    }>
                    {deleteSelection.id === record.id ? (
                      deleteSelection.state === 'success' ? (
                        <FontAwesomeIcon icon="check" />
                      ) : (
                        <Loader size="small" type="default" />
                      )
                    ) : (
                      t('label.delete')
                    )}
                  </Button>
                </Tooltip>
                {separator}
                <Tooltip
                  title={
                    editPermission
                      ? t('label.kill')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    data-testid="kill"
                    disabled={!editPermission}
                    type="link"
                    onClick={() => {
                      setIsKillModalOpen(true);
                      setSelectedPipeline(record);
                    }}>
                    Kill
                  </Button>
                </Tooltip>
                {separator}
                <Tooltip
                  title={
                    viewPermission
                      ? t('label.log-plural')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    data-testid="logs"
                    disabled={!viewPermission}
                    href={getLogsViewerPath(
                      testSuitePath,
                      record.service?.name || '',
                      record.fullyQualifiedName || ''
                    )}
                    type="link"
                    onClick={() => {
                      setSelectedPipeline(record);
                    }}>
                    Logs
                  </Button>
                </Tooltip>
              </div>

              {isKillModalOpen &&
                selectedPipeline &&
                record.id === selectedPipeline?.id && (
                  <KillIngestionModal
                    isModalOpen={isKillModalOpen}
                    pipelinName={selectedPipeline.name}
                    pipelineId={selectedPipeline.id as string}
                    onClose={() => {
                      setIsKillModalOpen(false);
                      setSelectedPipeline(undefined);
                    }}
                    onIngestionWorkflowsUpdate={getAllIngestionWorkflows}
                  />
                )}
            </>
          );
        },
      },
    ];

    return column;
  }, [
    airFlowEndPoint,
    isKillModalOpen,
    selectedPipeline,
    currDeployId,
    currTriggerId,
  ]);

  if (isLoading || isFetchingStatus) {
    return <Loader />;
  }

  return !isAirflowAvailable ? (
    <ErrorPlaceHolderIngestion />
  ) : (
    <TestCaseCommonTabContainer
      buttonName={t('label.add-entity', {
        entity: t('label.ingestion'),
      })}
      hasAccess={createPermission}
      showButton={testSuitePipelines.length === 0}
      onButtonClick={() => {
        history.push(getTestSuiteIngestionPath(testSuiteFQN));
      }}>
      <Col span={24}>
        <Table
          bordered
          className="table-shadow"
          columns={pipelineColumns}
          dataSource={testSuitePipelines.map((test) => ({
            ...test,
            key: test.name,
          }))}
          pagination={false}
          size="small"
        />
        <EntityDeleteModal
          entityName={deleteSelection.name}
          entityType={t('label.ingestion-lowercase')}
          loadingState={deleteSelection.state}
          visible={isConfirmationModalOpen}
          onCancel={handleCancelConfirmationModal}
          onConfirm={() =>
            handleDelete(deleteSelection.id, deleteSelection.name)
          }
        />
      </Col>
    </TestCaseCommonTabContainer>
  );
};

export default TestSuitePipelineTab;
