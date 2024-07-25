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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as LogsIcon } from '../../../../../../assets/svg/logs.svg';
import { ReactComponent as PauseIcon } from '../../../../../../assets/svg/pause.svg';
import { ReactComponent as ResumeIcon } from '../../../../../../assets/svg/resume.svg';
import { EntityType } from '../../../../../../enums/entity.enum';
import { Operation } from '../../../../../../generated/entity/policies/accessControl/rule';
import { PipelineType } from '../../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../../../../../utils/CommonUtils';
import { getLogsViewerPath } from '../../../../../../utils/RouterUtils';
import { PipelineActionsProps } from '../../PipelineActions.interface';
import './pipeline-actions.less';
import PipelineActionsDropdown from './PipelineActionsDropdown';

function PipelineActions({
  record,
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
}: Readonly<PipelineActionsProps>) {
  const history = useHistory();
  const { t } = useTranslation();

  const [currPauseId, setCurrPauseId] = useState({ id: '', state: '' });

  const { pipelineId, pipelineName } = useMemo(
    () => ({
      pipelineId: record.id ?? '',
      pipelineName: record.name ?? '',
    }),
    [record]
  );

  const { editStatusPermission } = useMemo(() => {
    const pipelinePermission = ingestionPipelinePermissions?.[pipelineName];

    return {
      editStatusPermission:
        pipelinePermission?.[Operation.EditAll] ||
        pipelinePermission?.[Operation.EditIngestionPipelineStatus],
    };
  }, [ingestionPipelinePermissions, pipelineName]);

  const onPauseUnpauseClick = useCallback(
    async (id: string) => {
      try {
        setCurrPauseId({ id, state: 'waiting' });
        await handleEnableDisableIngestion(id);
      } finally {
        setCurrPauseId({ id: '', state: '' });
      }
    },
    [handleEnableDisableIngestion]
  );

  const handleLogsClick = useCallback(
    () =>
      history.push(
        getLogsViewerPath(
          record.pipelineType === PipelineType.TestSuite
            ? EntityType.TEST_SUITE
            : serviceCategory,
          record.service?.name ?? '',
          record?.fullyQualifiedName ?? record?.name ?? ''
        )
      ),
    [record, serviceCategory]
  );

  return (
    <Row
      align="middle"
      className="pipeline-actions-container"
      gutter={[12, 12]}
      justify="space-between"
      wrap={false}>
      <Col>
        {record.enabled ? (
          <Tooltip
            title={
              record.deployed
                ? t('label.pause')
                : t('message.pipeline-not-deployed')
            }>
            <Button
              data-testid="pause-button"
              disabled={!editStatusPermission || !record.deployed}
              icon={getLoadingStatus(
                currPauseId,
                record.id,
                <PauseIcon height={12} width={12} />
              )}
              onClick={() => onPauseUnpauseClick(pipelineId)}>
              {t('label.pause')}
            </Button>
          </Tooltip>
        ) : (
          <Tooltip
            title={
              record.deployed
                ? t('label.resume')
                : t('message.pipeline-not-deployed')
            }>
            <Button
              data-testid="resume-button"
              disabled={!editStatusPermission}
              icon={getLoadingStatus(
                currPauseId,
                record.id,
                <ResumeIcon height={12} width={12} />
              )}
              onClick={() => onPauseUnpauseClick(pipelineId)}>
              {t('label.resume')}
            </Button>
          </Tooltip>
        )}
      </Col>
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
          <Col>
            <PipelineActionsDropdown
              deployIngestion={deployIngestion}
              handleDeleteSelection={handleDeleteSelection}
              handleEditClick={handleEditClick}
              handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
              ingestion={record}
              ingestionPipelinePermissions={ingestionPipelinePermissions}
              serviceCategory={serviceCategory}
              serviceName={serviceName}
              triggerIngestion={triggerIngestion}
              onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
            />
          </Col>
        </Row>
      </Col>
    </Row>
  );
}

export default PipelineActions;
