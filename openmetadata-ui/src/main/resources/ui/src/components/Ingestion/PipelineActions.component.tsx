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
import { Button } from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import KillIngestionModal from 'components/Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { IngestionPipeline } from 'generated/entity/services/ingestionPipelines/ingestionPipeline';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getLoadingStatus } from 'utils/CommonUtils';
import { getEditIngestionPath, getLogsViewerPath } from 'utils/RouterUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';
import { PipelineActionsProps } from './PipelineActions.interface';

function PipelineActions({
  record,
  servicePermission,
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
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();

  const getEditPermission = (service: string): boolean =>
    !servicePermission?.[service]?.EditAll;

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

  const handleUpdate = (ingestion: IngestionPipeline) => {
    history.push(
      getEditIngestionPath(
        serviceCategory,
        serviceName,
        ingestion.fullyQualifiedName || `${serviceName}.${ingestion.name}`,
        ingestion.pipelineType
      )
    );
  };

  const ConfirmDelete = (id: string, name: string) => {
    handleDeleteSelection({
      id,
      name,
      state: '',
    });
    handleIsConfirmationModalOpen(true);
  };

  const separator = (
    <span className="tw-inline-block tw-text-gray-400 tw-self-center">|</span>
  );

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
            data-testid="run"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() =>
              handleTriggerIngestion(ingestion.id as string, ingestion.name)
            }>
            {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
          </Button>
          {separator}

          <Button
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
      <div className="tw-flex">
        {record.enabled ? (
          <>
            {getTriggerDeployButton(record)}
            {separator}
            <Button
              data-testid="pause"
              disabled={getIngestionPermission(record.name)}
              type="link"
              onClick={() => handleEnableDisableIngestion(record.id || '')}>
              {t('label.pause')}
            </Button>
          </>
        ) : (
          <Button
            data-testid="unpause"
            disabled={getIngestionPermission(record.name)}
            type="link"
            onClick={() => handleEnableDisableIngestion(record.id || '')}>
            {t('label.unpause')}
          </Button>
        )}
        {separator}
        <Button
          data-testid="edit"
          disabled={getIngestionPermission(record.name)}
          type="link"
          onClick={() => handleUpdate(record)}>
          {t('label.edit')}
        </Button>
        {separator}
        <Button
          data-testid="delete"
          disabled={!servicePermission?.[record.name]?.Delete}
          type="link"
          onClick={() => ConfirmDelete(record.id as string, record.name)}>
          {getDeleteButton()}
        </Button>
        {separator}
        <Button
          data-testid="kill"
          disabled={getIngestionPermission(record.name)}
          type="link"
          onClick={() => {
            setIsKillModalOpen(true);
            setSelectedPipeline(record);
          }}>
          {t('label.kill')}
        </Button>
        {separator}
        <Button
          data-testid="logs"
          disabled={!isRequiredDetailsAvailable}
          href={getLogsViewerPath(
            serviceCategory,
            record.service?.name || '',
            record?.fullyQualifiedName || record?.name || ''
          )}
          type="link"
          onClick={() => {
            setSelectedPipeline(record);
          }}>
          {t('label.log-plural')}
        </Button>
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
            onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          />
        )}
    </>
  );
}

export default PipelineActions;
