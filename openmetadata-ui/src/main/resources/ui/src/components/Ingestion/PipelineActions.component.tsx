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
import { CheckOutlined } from '@ant-design/icons';
import { Button, Divider, Space } from 'antd';
import { AxiosError } from 'axios';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import Loader from '../../components/Loader/Loader';
import KillIngestionModal from '../../components/Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../utils/CommonUtils';
import {
  getEditIngestionPath,
  getLogsViewerPath,
} from '../../utils/RouterUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { PipelineActionsProps } from './PipelineActions.interface';

function PipelineActions({
  record,
  ingestionPipelinesPermission,
  triggerIngestion,
  deployIngestion,
  deleteSelection,
  isRequiredDetailsAvailable,
  handleEnableDisableIngestion,
  serviceCategory,
  serviceName,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  onIngestionWorkflowsUpdate,
}: PipelineActionsProps) {
  const history = useHistory();
  const { t } = useTranslation();

  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [currDeployId, setCurrDeployId] = useState({ id: '', state: '' });
  const [currPauseId, setCurrPauseId] = useState({ id: '', state: '' });
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();

  const getEditPermission = (service: string): boolean =>
    !ingestionPipelinesPermission?.[service]?.EditAll;

  const handleTriggerIngestion = async (id: string, displayName: string) => {
    try {
      setCurrTriggerId({ id, state: 'waiting' });
      await triggerIngestion(id, displayName);

      setCurrTriggerId({ id, state: 'success' });
      showSuccessToast(t('message.pipeline-trigger-success-message'));
      setTimeout(() => {
        setCurrTriggerId({ id: '', state: '' });
      }, 1500);
    } catch (error) {
      setCurrTriggerId({ id: '', state: '' });
      showErrorToast(
        error as AxiosError,
        t('message.pipeline-trigger-failed-message')
      );
    }
  };

  const handleDeployIngestion = (id: string) => {
    setCurrDeployId({ id, state: 'waiting' });
    deployIngestion(id)
      .then(() => {
        setCurrDeployId({ id, state: 'success' });
        setTimeout(() => setCurrDeployId({ id: '', state: '' }), 1500);
      })
      .catch(() => setCurrDeployId({ id: '', state: '' }));
  };

  const onPauseUnpauseClick = async (id: string) => {
    setCurrPauseId({ id, state: 'waiting' });
    try {
      await handleEnableDisableIngestion(id);
      setCurrPauseId({ id, state: 'success' });
      setTimeout(() => setCurrPauseId({ id: '', state: '' }), 1000);
    } catch {
      setCurrPauseId({ id: '', state: '' });
    }
  };

  const handleUpdate = (ingestion: IngestionPipeline) => {
    history.push(
      getEditIngestionPath(
        serviceCategory,
        serviceName,
        getEncodedFqn(
          ingestion.fullyQualifiedName || `${serviceName}.${ingestion.name}`
        ),
        ingestion.pipelineType
      )
    );
  };

  const handleConfirmDelete = (id: string, name: string) => {
    handleDeleteSelection({
      id,
      name,
      state: '',
    });
    handleIsConfirmationModalOpen(true);
  };

  const getDeleteButton = () => {
    if (deleteSelection.id !== record.id) {
      return t('label.delete');
    }

    return deleteSelection.state === 'success' ? (
      <CheckOutlined />
    ) : (
      <Loader size="small" type="default" />
    );
  };

  const getIngestionPermission = (name: string): boolean =>
    !isRequiredDetailsAvailable || getEditPermission(name);

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <>
          <Button
            className="p-x-xss"
            data-testid="run"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() =>
              handleTriggerIngestion(ingestion.id as string, ingestion.name)
            }>
            {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
          </Button>
          <Divider className="border-gray" type="vertical" />

          <Button
            className="p-x-xss"
            data-testid="re-deploy-btn"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() => handleDeployIngestion(ingestion.id as string)}>
            {getLoadingStatus(currDeployId, ingestion.id, t('label.re-deploy'))}
          </Button>
        </>
      );
    } else {
      return (
        <Button
          className="p-x-xss"
          data-testid="deploy"
          disabled={getIngestionPermission(ingestion.name)}
          type="link"
          onClick={() => handleDeployIngestion(ingestion.id as string)}>
          {getLoadingStatus(currDeployId, ingestion.id, t('label.deploy'))}
        </Button>
      );
    }
  };

  return (
    <>
      <Space align="center" size={0}>
        {record.enabled ? (
          <>
            {getTriggerDeployButton(record)}
            <Divider className="border-gray" type="vertical" />
            <Button
              className="p-x-xss"
              data-testid="pause"
              disabled={getIngestionPermission(record.name)}
              type="link"
              onClick={() => onPauseUnpauseClick(record.id || '')}>
              {getLoadingStatus(currPauseId, record.id, t('label.pause'))}
            </Button>
          </>
        ) : (
          <Button
            className="p-x-xss"
            data-testid="unpause"
            disabled={getIngestionPermission(record.name)}
            type="link"
            onClick={() => onPauseUnpauseClick(record.id || '')}>
            {getLoadingStatus(currPauseId, record.id, t('label.unpause'))}
          </Button>
        )}
        <Divider className="border-gray" type="vertical" />
        <Button
          className="p-x-xss"
          data-testid="edit"
          disabled={getIngestionPermission(record.name)}
          type="link"
          onClick={() => handleUpdate(record)}>
          {t('label.edit')}
        </Button>
        <Divider className="border-gray" type="vertical" />
        <Button
          className="p-x-xss"
          data-testid="delete"
          disabled={!ingestionPipelinesPermission?.[record.name]?.Delete}
          type="link"
          onClick={() => handleConfirmDelete(record.id as string, record.name)}>
          {getDeleteButton()}
        </Button>
        <Divider className="border-gray" type="vertical" />
        <Button
          className="p-x-xss"
          data-testid="kill"
          disabled={getIngestionPermission(record.name)}
          type="link"
          onClick={() => {
            setIsKillModalOpen(true);
            setSelectedPipeline(record);
          }}>
          {t('label.kill')}
        </Button>
        <Divider className="border-gray" type="vertical" />
        <Link
          to={getLogsViewerPath(
            serviceCategory,
            record.service?.name || '',
            getEncodedFqn(record?.fullyQualifiedName || record?.name || '')
          )}>
          <Button
            className="p-x-xss"
            data-testid="logs"
            disabled={!isRequiredDetailsAvailable}
            type="link"
            onClick={() => {
              setSelectedPipeline(record);
            }}>
            {t('label.log-plural')}
          </Button>
        </Link>
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
            onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          />
        )}
    </>
  );
}

export default PipelineActions;
