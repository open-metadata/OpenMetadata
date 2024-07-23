/*
 *  Copyright 2024 Collate.
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

import { Button, Dropdown } from 'antd';
import { isEmpty, isNil, isUndefined } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as KillIcon } from '../../../../../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as DeployIcon } from '../../../../../../assets/svg/deploy.svg';
import { ReactComponent as EditIcon } from '../../../../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../../../../assets/svg/ic-delete.svg';
import { ReactComponent as MoreIcon } from '../../../../../../assets/svg/menu.svg';
import { ReactComponent as ReloadIcon } from '../../../../../../assets/svg/reload.svg';
import { ReactComponent as RunIcon } from '../../../../../../assets/svg/run.svg';
import { IngestionPipeline } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../../../../../utils/CommonUtils';
import { getEntityName } from '../../../../../../utils/EntityUtils';
import { getEditIngestionPath } from '../../../../../../utils/RouterUtils';
import KillIngestionModal from '../../../../../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { PipelineActionsDropdownProps } from './PipelineActionsDropdown.interface';

function PipelineActionsDropdown({
  ingestion,
  triggerIngestion,
  deployIngestion,
  serviceName,
  serviceCategory,
  handleEditClick,
  getIngestionPermission,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  ingestionPipelinesPermission,
  onIngestionWorkflowsUpdate,
}: Readonly<PipelineActionsDropdownProps>) {
  const history = useHistory();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);
  const [currTrigger, setCurrTrigger] = useState({ id: '', state: '' });
  const [currDeploy, setCurrDeploy] = useState({ id: '', state: '' });

  const {
    name = '',
    displayName,
    id = '',
  } = useMemo(() => ingestion, [ingestion]);

  const handleTriggerIngestion = async (id: string, displayName: string) => {
    try {
      setCurrTrigger({ id, state: 'waiting' });
      await triggerIngestion(id, displayName);
    } finally {
      setCurrTrigger({ id: '', state: '' });
      setIsOpen(false);
    }
  };

  const handleDeployIngestion = async (id: string) => {
    try {
      setCurrDeploy({ id, state: 'waiting' });
      await deployIngestion(id);
    } finally {
      setCurrDeploy({ id: '', state: '' });
      setIsOpen(false);
    }
  };

  const handleUpdate = (ingestion: IngestionPipeline) => {
    const fullyQualifiedName =
      isUndefined(ingestion.fullyQualifiedName) ||
      isNil(ingestion.fullyQualifiedName)
        ? `${serviceName}.${ingestion.name}`
        : ingestion.fullyQualifiedName;

    if (isUndefined(handleEditClick)) {
      history.push(
        getEditIngestionPath(
          serviceCategory,
          serviceName,
          fullyQualifiedName,
          ingestion.pipelineType
        )
      );
    } else {
      handleEditClick(fullyQualifiedName);
    }
  };
  const handleConfirmDelete = (
    id: string,
    name: string,
    displayName?: string
  ) => {
    handleDeleteSelection({
      id,
      name,
      displayName,
      state: '',
    });
    handleIsConfirmationModalOpen(true);
  };
  const items = [
    ...(ingestion.deployed
      ? [
          {
            label: t('label.run'),
            icon: getLoadingStatus(
              currTrigger,
              id,
              <RunIcon height={12} width={12} />
            ),
            onClick: () => handleTriggerIngestion(id, name),
            key: 'run-button',
            'data-testid': 'run-button',
          },
          {
            label: t('label.re-deploy'),
            icon: getLoadingStatus(
              currDeploy,
              id,
              <ReloadIcon height={12} width={12} />
            ),
            onClick: () => handleDeployIngestion(id),
            key: 're-deploy-button',
            'data-testid': 're-deploy-button',
          },
        ]
      : [
          {
            label: t('label.deploy'),
            icon: getLoadingStatus(
              currDeploy,
              id,
              <DeployIcon height={12} width={12} />
            ),
            onClick: () => handleDeployIngestion(id),
            key: 'deploy-button',
            'data-testid': 'deploy-button',
          },
        ]),
    {
      label: t('label.edit'),
      disabled: getIngestionPermission(name),
      icon: <EditIcon height={12} width={12} />,
      onClick: () => {
        handleUpdate(ingestion);
        setIsOpen(false);
      },
      key: 'edit-button',
      'data-testid': 'edit-button',
    },
    {
      label: t('label.kill'),
      disabled: getIngestionPermission(name),
      icon: <KillIcon height={12} width={12} />,
      onClick: () => {
        setIsKillModalOpen(true);
        setSelectedPipeline(ingestion);
        setIsOpen(false);
      },
      key: 'kill-button',
      'data-testid': 'kill-button',
    },
    {
      label: t('label.delete'),
      disabled: !ingestionPipelinesPermission?.[name]?.Delete,
      icon: <DeleteIcon height={12} width={12} />,
      onClick: () => {
        handleConfirmDelete(id, name, displayName);
        setIsOpen(false);
      },
      key: 'delete-button',
    },
  ];

  return (
    <>
      <Dropdown
        menu={{ items }}
        open={isOpen || !isEmpty(currTrigger.id) || !isEmpty(currDeploy.id)}
        overlayStyle={{ width: '120px' }}
        trigger={['click']}
        onOpenChange={(value) => setIsOpen(value)}>
        <Button
          data-testid="more-actions"
          icon={<MoreIcon />}
          type="link"
          onClick={() => setIsOpen((value) => !value)}
        />
      </Dropdown>
      {isKillModalOpen && selectedPipeline && id === selectedPipeline?.id && (
        <KillIngestionModal
          isModalOpen={isKillModalOpen}
          pipelineId={selectedPipeline.id}
          pipelineName={getEntityName(selectedPipeline)}
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

export default PipelineActionsDropdown;
