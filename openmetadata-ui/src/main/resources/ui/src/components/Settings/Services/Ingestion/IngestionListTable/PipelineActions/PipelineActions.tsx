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
import { Box, Button, Tooltip } from '@openmetadata/ui-core-components';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LogsIcon } from '../../../../../../assets/svg/logs.svg';
import { ReactComponent as PauseIcon } from '../../../../../../assets/svg/pause.svg';
import { ReactComponent as ResumeIcon } from '../../../../../../assets/svg/resume.svg';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/rule';
import { PipelineType } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useLogsModal } from '../../../../../../hooks/useLogsModal';
import { getLoadingStatus } from '../../../../../../utils/EntityDisplayPureUtils';
import { PipelineActionsProps } from './PipelineActions.interface';
import PipelineActionsDropdown from './PipelineActionsDropdown';

function PipelineActions({
  pipeline,
  ingestionPipelinePermissions,
  isDisabled,
  triggerIngestion,
  deployIngestion,
  handleEnableDisableIngestion,
  serviceCategory,
  serviceName,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  onIngestionWorkflowsUpdate,
  handleEditClick,
  moreActionButtonProps,
}: Readonly<PipelineActionsProps>) {
  const { t } = useTranslation();
  const { openLogs, logsModal } = useLogsModal();
  const [currPauseId, setCurrPauseId] = useState({ id: '', state: '' });

  const pipelineId = pipeline.id ?? '';

  const {
    editPermission,
    deletePermission,
    deployPermission,
    triggerPermission,
    editStatusPermission,
  } = useMemo(() => {
    return {
      editPermission: ingestionPipelinePermissions?.[Operation.EditAll],
      deletePermission: ingestionPipelinePermissions?.[Operation.Delete],
      deployPermission:
        ingestionPipelinePermissions?.[Operation.EditAll] ||
        ingestionPipelinePermissions?.[Operation.Deploy],
      triggerPermission: ingestionPipelinePermissions?.[Operation.Trigger],
      editStatusPermission:
        ingestionPipelinePermissions?.[Operation.EditAll] ||
        ingestionPipelinePermissions?.[Operation.EditIngestionPipelineStatus],
    };
  }, [ingestionPipelinePermissions]);

  const canDeploy = pipeline.enabled && deployPermission;
  const canTrigger = pipeline.enabled && pipeline.deployed && triggerPermission;
  const hasDropdownPermission =
    editPermission || deletePermission || canDeploy || canTrigger;

  const onPauseUnpauseClick = useCallback(
    async (id: string) => {
      try {
        setCurrPauseId({ id, state: 'waiting' });
        await handleEnableDisableIngestion?.(id);
      } finally {
        setCurrPauseId({ id: '', state: '' });
      }
    },
    [handleEnableDisableIngestion]
  );

  const handleLogsClick = useCallback(
    () =>
      openLogs({
        logEntityType:
          pipeline.pipelineType === PipelineType.TestSuite
            ? EntityType.TEST_SUITE
            : serviceCategory ?? '',
        fqn: pipeline?.fullyQualifiedName ?? pipeline?.name ?? '',
      }),
    [pipeline, serviceCategory, openLogs]
  );

  const playPauseButton = useMemo(() => {
    if (!editStatusPermission) {
      return null;
    }

    const label = pipeline.enabled ? t('label.pause') : t('label.resume');
    const StatusIcon = pipeline.enabled ? PauseIcon : ResumeIcon;

    return (
      <Tooltip
        title={pipeline.deployed ? label : t('message.pipeline-not-deployed')}>
        <Button
          color="secondary"
          data-testid={pipeline.enabled ? 'pause-button' : 'resume-button'}
          iconLeading={getLoadingStatus(
            currPauseId,
            pipeline.id,
            <StatusIcon height={12} width={12} />
          )}
          isDisabled={
            isDisabled || !pipeline.deployed || currPauseId.id === pipeline.id
          }
          onPress={() => onPauseUnpauseClick(pipelineId)}>
          {label}
        </Button>
      </Tooltip>
    );
  }, [editStatusPermission, isDisabled, pipeline, currPauseId, pipelineId]);

  return (
    <Box
      align="center"
      className="pipeline-actions-container"
      data-tesid="pipeline-actions"
      gap={2}
      justify="between"
      wrap="nowrap">
      {playPauseButton}
      <Box align="center" gap={2} wrap="nowrap">
        <Button
          color="secondary"
          data-testid="logs-button"
          iconLeading={<LogsIcon height={12} width={12} />}
          isDisabled={isDisabled}
          onPress={handleLogsClick}>
          {t('label.log-plural')}
        </Button>
        {hasDropdownPermission && (
          <PipelineActionsDropdown
            deployIngestion={deployIngestion}
            handleDeleteSelection={handleDeleteSelection}
            handleEditClick={handleEditClick}
            handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
            ingestion={pipeline}
            ingestionPipelinePermissions={ingestionPipelinePermissions}
            moreActionButtonProps={{
              disabled: isDisabled || moreActionButtonProps?.disabled,
            }}
            serviceCategory={serviceCategory}
            serviceName={serviceName}
            triggerIngestion={triggerIngestion}
            onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          />
        )}
      </Box>
      {logsModal}
    </Box>
  );
}

export default PipelineActions;
