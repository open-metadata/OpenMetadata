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
import { Button, Col, Row, Space } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as LogsIcon } from '../../../../../../assets/svg/logs.svg';
import { ReactComponent as PauseIcon } from '../../../../../../assets/svg/pause.svg';
import { ReactComponent as ResumeIcon } from '../../../../../../assets/svg/resume.svg';
import { getLoadingStatus } from '../../../../../../utils/CommonUtils';
import { getLogsViewerPath } from '../../../../../../utils/RouterUtils';
import { PipelineActionsProps } from '../../PipelineActions.interface';
import './pipeline-actions.less';
import PipelineActionsDropdown from './PipelineActionsDropdown';

function PipelineActions({
  record,
  ingestionPipelinesPermission,
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

  const { recordId } = useMemo(
    () => ({
      recordId: record.id ?? '',
    }),
    [record]
  );

  const getEditPermission = (service: string): boolean =>
    !ingestionPipelinesPermission?.[service]?.EditAll;

  const onPauseUnpauseClick = async (id: string) => {
    try {
      setCurrPauseId({ id, state: 'waiting' });
      await handleEnableDisableIngestion(id);
    } finally {
      setCurrPauseId({ id: '', state: '' });
    }
  };

  const handleLogsClick = useCallback(
    () =>
      history.push(
        getLogsViewerPath(
          serviceCategory,
          record.service?.name ?? '',
          record?.fullyQualifiedName ?? record?.name ?? ''
        )
      ),
    [record, serviceCategory]
  );

  const getIngestionPermission = (name: string): boolean =>
    getEditPermission(name);

  return (
    <Row
      align="middle"
      className="pipeline-actions-container"
      gutter={[12, 12]}
      justify="space-between"
      wrap={false}>
      <Col>
        {record.enabled ? (
          <Button
            data-testid="pause-button"
            disabled={getIngestionPermission(record.name)}
            icon={getLoadingStatus(
              currPauseId,
              record.id,
              <PauseIcon height={12} width={12} />
            )}
            onClick={() => onPauseUnpauseClick(recordId)}>
            {t('label.pause')}
          </Button>
        ) : (
          <Button
            data-testid="resume-button"
            disabled={getIngestionPermission(record.name)}
            icon={getLoadingStatus(
              currPauseId,
              record.id,
              <ResumeIcon height={12} width={12} />
            )}
            onClick={() => onPauseUnpauseClick(recordId)}>
            {t('label.resume')}
          </Button>
        )}
      </Col>
      <Col>
        <Space align="center" size={12}>
          <Button
            data-testid="logs-button"
            icon={<LogsIcon height={12} width={12} />}
            onClick={handleLogsClick}>
            {t('label.log-plural')}
          </Button>
          <PipelineActionsDropdown
            deployIngestion={deployIngestion}
            getIngestionPermission={getIngestionPermission}
            handleDeleteSelection={handleDeleteSelection}
            handleEditClick={handleEditClick}
            handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
            ingestion={record}
            ingestionPipelinesPermission={ingestionPipelinesPermission}
            serviceCategory={serviceCategory}
            serviceName={serviceName}
            triggerIngestion={triggerIngestion}
            onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          />
        </Space>
      </Col>
    </Row>
  );
}

export default PipelineActions;
