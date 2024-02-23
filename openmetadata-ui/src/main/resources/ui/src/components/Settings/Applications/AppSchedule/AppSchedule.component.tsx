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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppScheduleClass,
  AppType,
} from '../../../../generated/entity/applications/app';
import { getIngestionPipelineByFqn } from '../../../../rest/ingestionPipelineAPI';
import Loader from '../../../common/Loader/Loader';
import TestSuiteScheduler from '../../../DataQuality/AddDataQualityTest/components/TestSuiteScheduler';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import { AppRunsHistoryRef } from '../AppRunsHistory/AppRunsHistory.interface';
import { AppScheduleProps } from './AppScheduleProps.interface';

const AppSchedule = ({
  appData,
  loading: { isRunLoading, isDeployLoading },
  onSave,
  onDemandTrigger,
  onDeployTrigger,
}: AppScheduleProps) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const appRunsHistoryRef = useRef<AppRunsHistoryRef>(null);
  const [isPipelineDeployed, setIsPipelineDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaveLoading, setIsSaveLoading] = useState(false);

  const fetchPipelineDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      if (
        appData.appType === AppType.External &&
        appData.pipelines &&
        appData.pipelines.length > 0
      ) {
        const fqn = appData.pipelines[0].fullyQualifiedName ?? '';
        const pipelineData = await getIngestionPipelineByFqn(fqn);

        setIsPipelineDeployed(pipelineData.deployed ?? false);
      } else {
        setIsPipelineDeployed(false);
      }
    } catch (error) {
      setIsPipelineDeployed(false);
    } finally {
      setIsLoading(false);
    }
  }, [appData]);

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

  const onDialogSave = async (cron: string) => {
    setIsSaveLoading(true);
    await onSave(cron);
    setIsSaveLoading(false);
    setShowModal(false);
  };

  const onAppTrigger = async () => {
    await onDemandTrigger();
    appRunsHistoryRef.current?.refreshAppHistory();
  };

  const appRunHistory = useMemo(() => {
    if (
      !appData.deleted &&
      (appData.appType === AppType.Internal || isPipelineDeployed)
    ) {
      return (
        <AppRunsHistory
          appData={appData}
          maxRecords={1}
          ref={appRunsHistoryRef}
          showPagination={false}
        />
      );
    }

    if (appData.deleted) {
      return (
        <Typography.Text>
          {t('message.application-disabled-message')}
        </Typography.Text>
      );
    }

    return (
      <Typography.Text>
        {t('message.no-ingestion-pipeline-found')}
      </Typography.Text>
    );
  }, [appData, isPipelineDeployed, appRunsHistoryRef]);

  const initialOptions = useMemo(() => {
    if (appData.name === 'DataInsightsReportApplication') {
      return ['Week'];
    } else if (appData.appType === AppType.External) {
      return ['Day'];
    }

    return undefined;
  }, [appData.name, appData.appType]);

  useEffect(() => {
    fetchPipelineDetails();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

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
                  <Typography.Text
                    className="font-medium"
                    data-testid="cron-string">
                    {cronString}
                  </Typography.Text>
                </Space>
              </div>
            </>
          )}
        </Col>
        {!appData.deleted && (
          <Col className="d-flex items-center justify-end" flex="200px">
            <Space>
              {appData.appType === AppType.External && (
                <Button
                  data-testid="deploy-button"
                  disabled={appData.deleted}
                  loading={isDeployLoading}
                  type="primary"
                  onClick={onDeployTrigger}>
                  {t('label.deploy')}
                </Button>
              )}

              <Button
                data-testid="edit-button"
                disabled={appData.deleted}
                type="primary"
                onClick={() => setShowModal(true)}>
                {t('label.edit')}
              </Button>

              <Button
                data-testid="run-now-button"
                disabled={appData.deleted}
                loading={isRunLoading}
                type="primary"
                onClick={onAppTrigger}>
                {t('label.run-now')}
              </Button>
            </Space>
          </Col>
        )}

        <Divider />

        <Col span={24}>{appRunHistory}</Col>
      </Row>
      <Modal
        destroyOnClose
        className="update-schedule-modal"
        closable={false}
        data-testid="update-schedule-modal"
        footer={null}
        maskClosable={false}
        okText={t('label.save')}
        open={showModal}
        title={t('label.update-entity', { entity: t('label.schedule') })}>
        <TestSuiteScheduler
          buttonProps={{
            cancelText: t('label.cancel'),
            okText: t('label.save'),
          }}
          includePeriodOptions={initialOptions}
          initialData={
            (appData.appSchedule as AppScheduleClass)?.cronExpression ?? ''
          }
          isLoading={isSaveLoading}
          onCancel={onDialogCancel}
          onSubmit={onDialogSave}
        />
      </Modal>
    </>
  );
};

export default AppSchedule;
