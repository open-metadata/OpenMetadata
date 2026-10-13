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

import { ButtonUtility, Dropdown } from '@openmetadata/ui-core-components';
import { isEmpty, isNil, isUndefined } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as KillIcon } from '../../../../../../assets/svg/close-circle-outlined.svg';
import { ReactComponent as DeployIcon } from '../../../../../../assets/svg/deploy.svg';
import { ReactComponent as EditIcon } from '../../../../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../../../../assets/svg/ic-delete.svg';
import { ReactComponent as MoreIcon } from '../../../../../../assets/svg/menu.svg';
import { ReactComponent as ReloadIcon } from '../../../../../../assets/svg/reload.svg';
import { ReactComponent as RunIcon } from '../../../../../../assets/svg/run.svg';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/resourceDescriptor';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../../../../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  getEditIngestionPath,
  getTestSuiteIngestionPath,
} from '../../../../../../utils/RouterUtils';
import { getTestSuiteFQN } from '../../../../../../utils/TestSuiteUtils';
import KillIngestionModal from '../../../../../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { PipelineActionsDropdownProps } from './PipelineActionsDropdown.interface';

function PipelineActionsDropdown({
  ingestion,
  triggerIngestion,
  deployIngestion,
  serviceName,
  serviceCategory,
  handleEditClick,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  onIngestionWorkflowsUpdate,
  ingestionPipelinePermissions,
  moreActionButtonProps,
}: Readonly<PipelineActionsDropdownProps>) {
  const navigate = useNavigate();
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

  const {
    editPermission,
    deletePermission,
    deployPermission,
    triggerPermission,
  } = useMemo(() => {
    return {
      editPermission: ingestionPipelinePermissions?.[Operation.EditAll],
      deletePermission: ingestionPipelinePermissions?.[Operation.Delete],
      deployPermission:
        ingestionPipelinePermissions?.[Operation.EditAll] ||
        ingestionPipelinePermissions?.[Operation.Deploy] ||
        false,
      triggerPermission:
        ingestionPipelinePermissions?.[Operation.Trigger] ?? false,
    };
  }, [ingestionPipelinePermissions]);

  const handleTriggerIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        setCurrTrigger({ id, state: 'waiting' });
        await triggerIngestion?.(id, displayName);
      } finally {
        setCurrTrigger({ id: '', state: '' });
        setIsOpen(false);
      }
    },
    []
  );

  const handleDeployIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        setCurrDeploy({ id, state: 'waiting' });
        await deployIngestion?.(id, displayName);
      } finally {
        setCurrDeploy({ id: '', state: '' });
        setIsOpen(false);
      }
    },
    []
  );

  const handleUpdate = useCallback(
    (ingestion: IngestionPipeline) => {
      const fullyQualifiedName = isNil(ingestion.fullyQualifiedName)
        ? `${serviceName}.${ingestion.name}`
        : ingestion.fullyQualifiedName;

      if (ingestion.pipelineType === PipelineType.TestSuite) {
        navigate(
          getTestSuiteIngestionPath(
            getTestSuiteFQN(fullyQualifiedName),
            fullyQualifiedName
          )
        );

        return;
      }

      if (isUndefined(handleEditClick)) {
        navigate(
          getEditIngestionPath(
            serviceCategory ?? '',
            serviceName ?? '',
            fullyQualifiedName,
            ingestion.pipelineType
          )
        );
      } else {
        handleEditClick(fullyQualifiedName);
      }
    },
    [ingestion, serviceCategory, serviceName, handleEditClick]
  );

  const handleConfirmDelete = useCallback(
    (id: string, name: string, displayName?: string) => {
      handleDeleteSelection?.({
        id,
        name,
        displayName,
        state: '',
      });
      handleIsConfirmationModalOpen(true);
    },
    [handleDeleteSelection, handleIsConfirmationModalOpen]
  );

  const deployItems = useMemo(
    () =>
      ingestion.deployed
        ? [
            {
              label: t('label.run'),
              icon: getLoadingStatus(
                currTrigger,
                id,
                <RunIcon height={12} width={12} />
              ),
              hidden: !triggerPermission,
              onClick: () =>
                handleTriggerIngestion(id, getEntityName(ingestion)),
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
              hidden: !deployPermission,
              onClick: () =>
                handleDeployIngestion(id, getEntityName(ingestion)),
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
              hidden: !deployPermission,
              onClick: () =>
                handleDeployIngestion(id, getEntityName(ingestion)),
              key: 'deploy-button',
              'data-testid': 'deploy-button',
            },
          ],
    [
      ingestion,
      currTrigger,
      id,
      currDeploy,
      triggerPermission,
      deployPermission,
    ]
  );

  const menuItems = useMemo(() => {
    const items = [
      ...(ingestion.enabled ? deployItems : []),
      {
        label: t('label.edit'),
        hidden: !editPermission,
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
        hidden: !editPermission,
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
        hidden: !deletePermission,
        icon: <DeleteIcon height={12} width={12} />,
        onClick: () => {
          handleConfirmDelete(id, name, displayName);
          setIsOpen(false);
        },
        key: 'delete-button',
        'data-testid': 'delete-button',
      },
    ];

    return items.filter((item) => !item.hidden);
  }, [
    ingestion,
    deployItems,
    editPermission,
    handleUpdate,
    handleConfirmDelete,
    id,
    name,
    displayName,
    deletePermission,
  ]);

  return (
    <>
      <Dropdown.Root
        isOpen={isOpen || !isEmpty(currTrigger.id) || !isEmpty(currDeploy.id)}
        onOpenChange={setIsOpen}>
        <ButtonUtility
          aria-label={t('label.more-action-plural')}
          color="tertiary"
          data-testid="more-actions"
          icon={MoreIcon}
          isDisabled={moreActionButtonProps?.disabled}
          size="sm"
        />
        <Dropdown.Popover className="tw:w-30">
          <Dropdown.Menu
            aria-label={t('label.action-plural')}
            data-testid="actions-dropdown"
            selectionMode="none">
            {menuItems.map((item) => (
              <Dropdown.Item
                data-testid={item['data-testid']}
                id={item.key}
                key={item.key}
                textValue={item.label}
                onAction={item.onClick}>
                <span className="tw:flex tw:items-center tw:gap-2 tw:font-medium">
                  {item.icon}
                  {item.label}
                </span>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
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
