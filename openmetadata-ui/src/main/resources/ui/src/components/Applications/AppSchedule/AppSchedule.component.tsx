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
import { Button, Col, Divider, Modal, Row, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppScheduleClass } from '../../../generated/entity/applications/app';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import TestSuiteScheduler from '../../AddDataQualityTest/components/TestSuiteScheduler';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import { AppRunsHistoryRef } from '../AppRunsHistory/AppRunsHistory.interface';
import { AppScheduleProps } from './AppScheduleProps.interface';

const AppSchedule = ({
  appData,
  onSave,
  onDemandTrigger,
}: AppScheduleProps) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const appRunsHistoryRef = useRef<AppRunsHistoryRef>(null);

  const cronString = useMemo(() => {
    if (appData.appSchedule) {
      const cronExp =
        (appData.appSchedule as AppScheduleClass).cronExpression ?? '';

      return cronstrue.toString(cronExp, {
        throwExceptionOnParseError: false,
      });
    }

    return '';
  }, [appData]);

  const onDialogCancel = () => {
    setShowModal(false);
  };

  const onDialogSave = (cron: string) => {
    onSave(cron);
    setShowModal(false);
  };

  const onAppTrigger = async () => {
    await onDemandTrigger();
    appRunsHistoryRef.current?.refreshAppHistory();
  };

  return (
    <>
      <Row>
        <Col className="flex-col" flex="auto">
          {appData.appSchedule && (
            <>
              <div>
                <Space size={8}>
                  <Typography.Text className="right-panel-label">
                    {t('label.schedule-type')}
                  </Typography.Text>
                  <Typography.Text className="font-medium">
                    {(appData.appSchedule as AppScheduleClass).scheduleType ??
                      ''}
                  </Typography.Text>
                </Space>
              </div>
              <div>
                <Space size={8}>
                  <Typography.Text className="right-panel-label">
                    {t('label.schedule-interval')}
                  </Typography.Text>
                  <Typography.Text className="font-medium">
                    {cronString}
                  </Typography.Text>
                </Space>
              </div>
            </>
          )}
        </Col>
        <Col className="d-flex items-center justify-end" flex="200px">
          <Space>
            <Button
              data-testid="edit-button"
              type="primary"
              onClick={() => setShowModal(true)}>
              {t('label.edit')}
            </Button>
            <Button
              data-testid="deploy-button"
              type="primary"
              onClick={onAppTrigger}>
              {t('label.run-now')}
            </Button>
          </Space>
        </Col>

        <Divider />

        <Col span={24}>
          <AppRunsHistory
            maxRecords={1}
            ref={appRunsHistoryRef}
            showPagination={false}
          />
        </Col>
      </Row>
      <Modal
        destroyOnClose
        className="update-schedule-modal"
        data-testid="update-schedule-modal"
        footer={null}
        maskClosable={false}
        open={showModal}
        title={t('label.update-entity', { entity: t('label.schedule') })}>
        <TestSuiteScheduler
          isQuartzCron
          initialData={getIngestionFrequency(PipelineType.Application)}
          onCancel={onDialogCancel}
          onSubmit={onDialogSave}
        />
      </Modal>
    </>
  );
};

export default AppSchedule;
