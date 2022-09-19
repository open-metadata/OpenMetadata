/*
 *  Copyright 2022 Collate
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
import { Button, Col, Row, Table, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import cronstrue from 'cronstrue';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
  checkAirflowStatus,
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from '../../axiosAPIs/ingestionPipelineAPI';
import { fetchAirflowConfig } from '../../axiosAPIs/miscAPI';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../constants/HelperTextUtil';
import { Operation } from '../../generated/entity/policies/policy';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import jsonData from '../../jsons/en';
import { getIngestionStatuses } from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getTestSuiteIngestionPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../common/error-with-placeholder/ErrorPlaceHolderIngestion';
import PopOver from '../common/popover/PopOver';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import IngestionLogsModal from '../Modals/IngestionLogsModal/IngestionLogsModal';
import KillIngestionModal from '../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../PermissionProvider/PermissionProvider.interface';
import TestCaseCommonTabContainer from '../TestCaseCommonTabContainer/TestCaseCommonTabContainer.component';

const TestSuitePipelineTab = () => {
  const { testSuiteFQN } = useParams<Record<string, string>>();
  const { permissions } = usePermissionProvider();
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [testSuitePipelines, setTestSuitePipelines] = useState<
    IngestionPipeline[]
  >([]);
  const [airFlowEndPoint, setAirFlowEndPoint] = useState('');
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
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
  const [isAirflowRunning, setIsAirflowRunning] = useState(false);

  const viewPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewAll,
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
        `${jsonData['api-error-messages']['delete-ingestion-error']} ${displayName}`
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
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
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
        `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`
      );
      setCurrTriggerId({ id: '', state: '' });
    }
  };

  const handleDeployIngestion = async (id: string) => {
    setCurrDeployId({ id, state: 'waiting' });

    try {
      await deployIngestionPipelineById(id);
      setCurrDeployId({ id, state: 'success' });
      setTimeout(() => setCurrDeployId({ id: '', state: '' }), 1500);
    } catch (error) {
      setCurrDeployId({ id: '', state: '' });
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-ingestion-error']
      );
    }
  };

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <Tooltip title={editPermission ? 'Run' : NO_PERMISSION_FOR_ACTION}>
          <Button
            data-testid="run"
            disabled={!editPermission}
            type="link"
            onClick={() =>
              handleTriggerIngestion(ingestion.id as string, ingestion.name)
            }>
            {currTriggerId.id === ingestion.id ? (
              currTriggerId.state === 'success' ? (
                <FontAwesomeIcon icon="check" />
              ) : (
                <Loader size="small" type="default" />
              )
            ) : (
              'Run'
            )}
          </Button>
        </Tooltip>
      );
    } else {
      return (
        <Tooltip title={editPermission ? 'Deploy' : NO_PERMISSION_FOR_ACTION}>
          <Button
            data-testid="deploy"
            disabled={!editPermission}
            type="link"
            onClick={() => handleDeployIngestion(ingestion.id as string)}>
            {currDeployId.id === ingestion.id ? (
              currDeployId.state === 'success' ? (
                <FontAwesomeIcon icon="check" />
              ) : (
                <Loader size="small" type="default" />
              )
            ) : (
              'Deploy'
            )}
          </Button>
        </Tooltip>
      );
    }
  };

  useEffect(() => {
    getAllIngestionWorkflows();
    fetchAirFlowEndPoint();
  }, []);

  useEffect(() => {
    checkAirflowStatus()
      .then((res) => {
        if (res.status === 200) {
          setIsAirflowRunning(true);
        } else {
          setIsAirflowRunning(false);
        }
      })
      .catch(() => {
        setIsAirflowRunning(false);
      });
  }, []);

  const pipelineColumns = useMemo(() => {
    const column: ColumnsType<IngestionPipeline> = [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (name: string) => {
          return (
            <Tooltip title={viewPermission ? name : NO_PERMISSION_TO_VIEW}>
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
        title: 'Type',
        dataIndex: 'pipelineType',
        key: 'pipelineType',
      },
      {
        title: 'Schedule',
        dataIndex: 'airflowConfig',
        key: 'airflowEndpoint',
        render: (_, record) => {
          return (
            <>
              {record?.airflowConfig.scheduleInterval ? (
                <PopOver
                  html={
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
                  position="bottom"
                  theme="light"
                  trigger="mouseenter">
                  <span>{record.airflowConfig.scheduleInterval ?? '--'}</span>
                </PopOver>
              ) : (
                <span>--</span>
              )}
            </>
          );
        },
      },
      {
        title: 'Recent Runs',
        dataIndex: 'pipelineStatuses',
        key: 'recentRuns',
        render: (_, record) => (
          <Row align="middle">{getIngestionStatuses(record)}</Row>
        ),
      },
      {
        title: 'Actions',
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
                        editPermission ? 'Pause' : NO_PERMISSION_FOR_ACTION
                      }>
                      <Button
                        data-testid="pause"
                        disabled={!editPermission}
                        type="link"
                        onClick={() =>
                          handleEnableDisableIngestion(record.id || '')
                        }>
                        Pause
                      </Button>
                    </Tooltip>
                  </Fragment>
                ) : (
                  <Tooltip
                    title={
                      editPermission ? 'UnPause' : NO_PERMISSION_FOR_ACTION
                    }>
                    <Button
                      data-testid="unpause"
                      disabled={!editPermission}
                      type="link"
                      onClick={() =>
                        handleEnableDisableIngestion(record.id || '')
                      }>
                      Unpause
                    </Button>
                  </Tooltip>
                )}
                {separator}
                <Tooltip
                  title={editPermission ? 'Edit' : NO_PERMISSION_FOR_ACTION}>
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
                    deletePermission ? 'Delete' : NO_PERMISSION_FOR_ACTION
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
                      'Delete'
                    )}
                  </Button>
                </Tooltip>
                {separator}
                <Tooltip
                  title={editPermission ? 'Kill' : NO_PERMISSION_FOR_ACTION}>
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
                  title={viewPermission ? 'Logs' : NO_PERMISSION_FOR_ACTION}>
                  <Button
                    data-testid="logs"
                    disabled={!viewPermission}
                    type="link"
                    onClick={() => {
                      setIsLogsModalOpen(true);
                      setSelectedPipeline(record);
                    }}>
                    Logs
                  </Button>
                </Tooltip>
              </div>

              {isLogsModalOpen &&
                selectedPipeline &&
                record.id === selectedPipeline?.id && (
                  <IngestionLogsModal
                    isModalOpen={isLogsModalOpen}
                    pipelinName={selectedPipeline.name}
                    pipelineId={selectedPipeline.id as string}
                    pipelineType={selectedPipeline.pipelineType}
                    onClose={() => {
                      setIsLogsModalOpen(false);
                      setSelectedPipeline(undefined);
                    }}
                  />
                )}
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
  }, [airFlowEndPoint, isKillModalOpen, isLogsModalOpen, selectedPipeline]);

  if (isLoading) {
    return <Loader />;
  }

  return !isAirflowRunning ? (
    <ErrorPlaceHolderIngestion />
  ) : (
    <TestCaseCommonTabContainer
      buttonName="Add Ingestion"
      hasAccess={createPermission}
      showButton={testSuitePipelines.length === 0}
      onButtonClick={() => {
        history.push(getTestSuiteIngestionPath(testSuiteFQN));
      }}>
      <Col span={24}>
        <Table
          columns={pipelineColumns}
          dataSource={testSuitePipelines.map((test) => ({
            ...test,
            key: test.name,
          }))}
          pagination={false}
          size="small"
        />
        {isConfirmationModalOpen && (
          <EntityDeleteModal
            entityName={deleteSelection.name}
            entityType="ingestion"
            loadingState={deleteSelection.state}
            onCancel={handleCancelConfirmationModal}
            onConfirm={() =>
              handleDelete(deleteSelection.id, deleteSelection.name)
            }
          />
        )}
      </Col>
    </TestCaseCommonTabContainer>
  );
};

export default TestSuitePipelineTab;
