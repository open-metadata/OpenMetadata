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
import { Button, Col, Row, Tooltip } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LogsIcon from '../../../../../../assets/svg/logs.svg?react';
import PauseIcon from '../../../../../../assets/svg/pause.svg?react';
import ResumeIcon from '../../../../../../assets/svg/resume.svg?react';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/rule';
import { PipelineType } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../../../../../utils/CommonUtils';
import { getLogsViewerPath } from '../../../../../../utils/RouterUtils';
import './pipeline-actions.less';
import { PipelineActionsProps } from './PipelineActions.interface';
import PipelineActionsDropdown from './PipelineActionsDropdown';

function PipelineActions({
  pipeline,
  ingestionPipelinePermissions,
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [currPauseId, setCurrPauseId] = useState({ id: '', state: '' });

  const { pipelineId, pipelineName } = useMemo(
    () => ({
      pipelineId: pipeline.id ?? '',
      pipelineName: pipeline.name ?? '',
    }),
    [pipeline]
  );

  const { editPermission, deletePermission, editStatusPermission } =
    useMemo(() => {
      const pipelinePermission = ingestionPipelinePermissions?.[pipelineName];

      return {
        editPermission: pipelinePermission?.[Operation.EditAll],
        deletePermission: pipelinePermission?.[Operation.Delete],
        editStatusPermission:
          pipelinePermission?.[Operation.EditAll] ||
          pipelinePermission?.[Operation.EditIngestionPipelineStatus],
      };
    }, [ingestionPipelinePermissions, pipelineName]);

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
      navigate(
        getLogsViewerPath(
          pipeline.pipelineType === PipelineType.TestSuite
            ? EntityType.TEST_SUITE
            : serviceCategory ?? '',
          pipeline.service?.name ?? '',
          pipeline?.fullyQualifiedName ?? pipeline?.name ?? ''
        )
      ),
    [pipeline, serviceCategory]
  );

  const playPauseButton = useMemo(() => {
    if (editStatusPermission) {
      return (
        <Col>
          {pipeline.enabled ? (
            <Tooltip
              title={
                pipeline.deployed
                  ? t('label.pause')
                  : t('message.pipeline-not-deployed')
              }>
              <Button
                data-testid="pause-button"
                disabled={!pipeline.deployed}
                icon={getLoadingStatus(
                  currPauseId,
                  pipeline.id,
                  <PauseIcon height={12} width={12} />
                )}
                onClick={() => onPauseUnpauseClick(pipelineId)}>
                {t('label.pause')}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                pipeline.deployed
                  ? t('label.resume')
                  : t('message.pipeline-not-deployed')
              }>
              <Button
                data-testid="resume-button"
                disabled={!pipeline.deployed}
                icon={getLoadingStatus(
                  currPauseId,
                  pipeline.id,
                  <ResumeIcon height={12} width={12} />
                )}
                onClick={() => onPauseUnpauseClick(pipelineId)}>
                {t('label.resume')}
              </Button>
            </Tooltip>
          )}
        </Col>
      );
    }

    return null;
  }, [editStatusPermission, pipeline, currPauseId, pipelineId]);

  return (
    <Row
      align="middle"
      className="pipeline-actions-container"
      data-tesid="pipeline-actions"
      gutter={[8, 8]}
      justify="space-between"
      wrap={false}>
      {playPauseButton}
      <Col>
        <Row align="middle" gutter={[8, 8]} wrap={false}>
          <Col>
            <Button
              data-testid="logs-button"
              icon={<LogsIcon height={12} width={12} />}
              onClick={handleLogsClick}>
              {t('label.log-plural')}
            </Button>
          </Col>
          {(editPermission || deletePermission) && (
            <Col>
              <PipelineActionsDropdown
                deployIngestion={deployIngestion}
                handleDeleteSelection={handleDeleteSelection}
                handleEditClick={handleEditClick}
                handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
                ingestion={pipeline}
                ingestionPipelinePermissions={ingestionPipelinePermissions}
                moreActionButtonProps={moreActionButtonProps}
                serviceCategory={serviceCategory}
                serviceName={serviceName}
                triggerIngestion={triggerIngestion}
                onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
              />
            </Col>
          )}
        </Row>
      </Col>
    </Row>
  );
}

export default PipelineActions;
