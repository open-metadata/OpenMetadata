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

import { CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Row, Space, Tooltip } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import cronstrue from 'cronstrue';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../../../../assets/svg/external-links.svg';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { PipelineType } from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { Table as TableType } from '../../../../generated/entity/data/table';
import { Operation } from '../../../../generated/entity/policies/policy';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from '../../../../hooks/useAirflowStatus';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { fetchAirflowConfig } from '../../../../rest/miscAPI';
import { getLoadingStatus } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  checkPermission,
  userPermissions,
} from '../../../../utils/PermissionsUtils';
import {
  getLogsViewerPath,
  getTestSuiteIngestionPath,
} from '../../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Loader from '../../../common/Loader/Loader';
import Table from '../../../common/Table/Table';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import KillIngestionModal from '../../../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { IngestionRecentRuns } from '../../../Settings/Services/Ingestion/IngestionRecentRun/IngestionRecentRuns.component';

interface Props {
  testSuite: TableType['testSuite'];
}

const TestSuitePipelineTab = ({ testSuite }: Props) => {
  const { isAirflowAvailable, isFetchingStatus } = useAirflowStatus();
  const { t } = useTranslation();
  const testSuiteFQN = testSuite?.fullyQualifiedName ?? testSuite?.name ?? '';

  const { permissions } = usePermissionProvider();
  const history = useHistory();

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

  const getAllIngestionWorkflows = async () => {
    try {
      setIsLoading(true);
      const response = await getIngestionPipelines({
        arrQueryFields: ['owner', 'pipelineStatuses'],
        testSuite: testSuiteFQN,
        pipelineType: [PipelineType.TestSuite],
      });
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
        }  ${t('label.successfully-lowercase')}`
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
              className="p-0"
              data-testid="run"
              disabled={!editPermission}
              size="small"
              type="link"
              onClick={() =>
                handleTriggerIngestion(ingestion.id as string, ingestion.name)
              }>
              {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
            </Button>
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip
            title={
              editPermission
                ? t('label.re-deploy')
                : t('message.no-permission-for-action')
            }>
            <Button
              className="p-0"
              data-testid="re-deploy-btn"
              disabled={!editPermission}
              size="small"
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
        width: 300,
        render: (_, record) => {
          const name = getEntityName(record);

          return (
            <Tooltip
              title={
                viewPermission ? name : t('message.no-permission-to-view')
              }>
              <a
                className="link-text"
                data-testid="airflow-tree-view"
                href={`${airFlowEndPoint}`}
                rel="noopener noreferrer"
                target="_blank">
                <Space align="center">
                  {name}
                  <ExternalLinkIcon className="align-middle" width={16} />
                </Space>
              </a>
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
                <Tooltip
                  placement="bottom"
                  title={cronstrue.toString(
                    record.airflowConfig.scheduleInterval || '',
                    {
                      use24HourTimeFormat: true,
                      verbose: true,
                    }
                  )}>
                  <span>{record.airflowConfig.scheduleInterval ?? '--'}</span>
                </Tooltip>
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
              <Space align="start">
                {record.enabled ? (
                  <Fragment>
                    {getTriggerDeployButton(record)}
                    <Divider type="vertical" />
                    <Tooltip
                      title={
                        editPermission
                          ? t('label.pause')
                          : t('message.no-permission-for-action')
                      }>
                      <Button
                        className="p-0"
                        data-testid="pause"
                        disabled={!editPermission}
                        size="small"
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
                      className="p-0"
                      data-testid="unpause"
                      disabled={!editPermission}
                      size="small"
                      type="link"
                      onClick={() =>
                        handleEnableDisableIngestion(record.id || '')
                      }>
                      {t('label.unpause')}
                    </Button>
                  </Tooltip>
                )}
                <Divider type="vertical" />
                <Tooltip
                  title={
                    editPermission
                      ? t('label.edit')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    className="p-0"
                    data-testid="edit"
                    disabled={!editPermission}
                    size="small"
                    type="link"
                    onClick={() => {
                      history.push(
                        getTestSuiteIngestionPath(
                          testSuiteFQN,
                          record.fullyQualifiedName ?? ''
                        )
                      );
                    }}>
                    {t('label.edit')}
                  </Button>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip
                  title={
                    deletePermission
                      ? t('label.delete')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    className="p-0"
                    data-testid="delete"
                    disabled={!deletePermission}
                    size="small"
                    type="link"
                    onClick={() =>
                      confirmDelete(record.id as string, record.name)
                    }>
                    {deleteSelection.id === record.id ? (
                      deleteSelection.state === 'success' ? (
                        <CheckOutlined />
                      ) : (
                        <Loader size="small" type="default" />
                      )
                    ) : (
                      t('label.delete')
                    )}
                  </Button>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip
                  title={
                    editPermission
                      ? t('label.kill')
                      : t('message.no-permission-for-action')
                  }>
                  <Button
                    className="p-0"
                    data-testid="kill"
                    disabled={!editPermission}
                    size="small"
                    type="link"
                    onClick={() => {
                      setIsKillModalOpen(true);
                      setSelectedPipeline(record);
                    }}>
                    {t('label.kill')}
                  </Button>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip
                  title={
                    viewPermission
                      ? t('label.log-plural')
                      : t('message.no-permission-for-action')
                  }>
                  <Link
                    to={getLogsViewerPath(
                      EntityType.TEST_SUITE,
                      record.service?.name || '',
                      record.fullyQualifiedName || ''
                    )}>
                    <Button
                      className="p-0"
                      data-testid="logs"
                      disabled={!viewPermission}
                      size="small"
                      type="link"
                      onClick={() => {
                        setSelectedPipeline(record);
                      }}>
                      {t('label.log-plural')}
                    </Button>
                  </Link>
                </Tooltip>
              </Space>

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
    isConfirmationModalOpen,
  ]);

  const errorPlaceholder = useMemo(
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
              onClick={() => {
                history.push(getTestSuiteIngestionPath(testSuiteFQN));
              }}>
              {t('label.add')}
            </Button>
          }
          heading={t('label.pipeline')}
          permission={createPermission}
          type={ERROR_PLACEHOLDER_TYPE.ASSIGN}>
          {t('message.no-table-pipeline')}
        </ErrorPlaceHolder>
      ) : (
        <ErrorPlaceHolder
          placeholderText={t('message.no-test-suite-table-pipeline')}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      ),
    [testSuiteFQN]
  );

  if (!isAirflowAvailable && !(isLoading || isFetchingStatus)) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <div className="m-t-md">
      <Table
        bordered
        columns={pipelineColumns}
        dataSource={testSuitePipelines.map((test) => ({
          ...test,
          key: test.name,
        }))}
        loading={isLoading || isFetchingStatus}
        locale={{ emptyText: errorPlaceholder }}
        pagination={false}
        rowKey="name"
        scroll={{ x: 1200 }}
        size="small"
      />
      <EntityDeleteModal
        entityName={deleteSelection.name}
        entityType={t('label.ingestion-lowercase')}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={() => handleDelete(deleteSelection.id, deleteSelection.name)}
      />
    </div>
  );
};

export default TestSuitePipelineTab;
